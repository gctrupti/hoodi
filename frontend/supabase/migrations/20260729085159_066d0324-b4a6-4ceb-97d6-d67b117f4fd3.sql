-- 1. Delivery stage -------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.delivery_stage AS ENUM ('accepted','to_pickup','picked_up','on_the_way','delivered');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.help_requests
  ADD COLUMN IF NOT EXISTS delivery_stage public.delivery_stage NOT NULL DEFAULT 'accepted';

-- 2. Live tracking ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.request_tracking (
  request_id uuid PRIMARY KEY REFERENCES public.help_requests(id) ON DELETE CASCADE,
  helper_id uuid NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  heading double precision,
  speed double precision,
  eta_minutes integer,
  distance_meters double precision,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.request_tracking TO authenticated;
GRANT ALL ON public.request_tracking TO service_role;

ALTER TABLE public.request_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can read tracking"
ON public.request_tracking FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.help_requests r
    WHERE r.id = request_tracking.request_id
      AND (r.requester_id = auth.uid() OR r.helper_id = auth.uid())
  )
);

CREATE POLICY "Helper can insert tracking"
ON public.request_tracking FOR INSERT TO authenticated
WITH CHECK (
  helper_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.help_requests r
    WHERE r.id = request_tracking.request_id AND r.helper_id = auth.uid()
  )
);

CREATE POLICY "Helper can update tracking"
ON public.request_tracking FOR UPDATE TO authenticated
USING (helper_id = auth.uid())
WITH CHECK (helper_id = auth.uid());

CREATE TRIGGER request_tracking_set_updated_at BEFORE UPDATE ON public.request_tracking
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Platform settings -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.platform_settings TO anon, authenticated;
GRANT ALL ON public.platform_settings TO service_role;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read settings"
ON public.platform_settings FOR SELECT TO anon, authenticated USING (true);

CREATE TRIGGER platform_settings_set_updated_at BEFORE UPDATE ON public.platform_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.platform_settings (key, value) VALUES
  ('maintenance', '{"enabled": false, "message": ""}'::jsonb),
  ('commission', '{"default_rate": 0.15}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 4. Announcements ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  audience text NOT NULL DEFAULT 'all',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.announcements TO anon, authenticated;
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active announcements"
ON public.announcements FOR SELECT TO anon, authenticated USING (is_active);

CREATE TRIGGER announcements_set_updated_at BEFORE UPDATE ON public.announcements
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. Admin analytics -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_admin boolean;
  _out jsonb;
BEGIN
  SELECT is_admin INTO _is_admin FROM public.profiles WHERE id = auth.uid();
  IF NOT COALESCE(_is_admin, false) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT jsonb_build_object(
    'revenue', (
      SELECT jsonb_build_object(
        'today',   COALESCE(SUM(amount) FILTER (WHERE created_at >= date_trunc('day', now())), 0),
        'week',    COALESCE(SUM(amount) FILTER (WHERE created_at >= date_trunc('week', now())), 0),
        'month',   COALESCE(SUM(amount) FILTER (WHERE created_at >= date_trunc('month', now())), 0),
        'year',    COALESCE(SUM(amount) FILTER (WHERE created_at >= date_trunc('year', now())), 0),
        'all_time',COALESCE(SUM(amount), 0)
      ) FROM public.payments WHERE status IN ('held','released')
    ),
    'commission', (
      SELECT jsonb_build_object(
        'help',   COALESCE((SELECT SUM(commission_amount) FROM public.help_requests), 0),
        'skills', COALESCE((SELECT SUM(commission_amount) FROM public.skill_bookings), 0)
      )
    ),
    'wallets', (
      SELECT jsonb_build_object(
        'balance', COALESCE(SUM(balance), 0),
        'count', COUNT(*)
      ) FROM public.wallets
    ),
    'payouts', (
      SELECT jsonb_build_object(
        'pending_count', COUNT(*) FILTER (WHERE status = 'requested'),
        'pending_amount', COALESCE(SUM(amount) FILTER (WHERE status = 'requested'), 0),
        'paid_amount', COALESCE(SUM(amount) FILTER (WHERE status = 'paid'), 0)
      ) FROM public.payouts
    ),
    'users', (
      SELECT jsonb_build_object(
        'total', COUNT(*),
        'active', COUNT(*) FILTER (WHERE is_active),
        'new_today', COUNT(*) FILTER (WHERE created_at >= date_trunc('day', now())),
        'new_week', COUNT(*) FILTER (WHERE created_at >= now() - interval '7 days')
      ) FROM public.profiles
    ),
    'requests', (
      SELECT jsonb_build_object(
        'total', COUNT(*),
        'today', COUNT(*) FILTER (WHERE created_at >= date_trunc('day', now())),
        'open', COUNT(*) FILTER (WHERE status = 'open'),
        'completed', COUNT(*) FILTER (WHERE status = 'completed'),
        'cancelled', COUNT(*) FILTER (WHERE status = 'cancelled')
      ) FROM public.help_requests
    ),
    'bookings', (
      SELECT jsonb_build_object(
        'total', COUNT(*),
        'today', COUNT(*) FILTER (WHERE created_at >= date_trunc('day', now())),
        'completed', COUNT(*) FILTER (WHERE status = 'completed'),
        'cancelled', COUNT(*) FILTER (WHERE status = 'cancelled')
      ) FROM public.skill_bookings
    ),
    'pending', (
      SELECT jsonb_build_object(
        'verifications', (SELECT COUNT(*) FROM public.user_verifications WHERE status = 'pending'),
        'reports', (SELECT COUNT(*) FROM public.user_reports WHERE status IN ('open','reviewing')),
        'categories', (SELECT COUNT(*) FROM public.category_suggestions WHERE status = 'pending')
      )
    ),
    'growth', (
      SELECT COALESCE(jsonb_agg(row_to_json(g) ORDER BY g.day), '[]'::jsonb) FROM (
        SELECT d::date AS day,
          (SELECT COUNT(*) FROM public.profiles p WHERE p.created_at::date = d::date) AS users,
          (SELECT COUNT(*) FROM public.help_requests r WHERE r.created_at::date = d::date) AS requests,
          (SELECT COUNT(*) FROM public.skill_bookings b WHERE b.created_at::date = d::date) AS bookings,
          (SELECT COALESCE(SUM(amount),0) FROM public.payments pm WHERE pm.created_at::date = d::date AND pm.status IN ('held','released')) AS revenue
        FROM generate_series(now()::date - interval '29 days', now()::date, interval '1 day') d
      ) g
    ),
    'top_cities', (
      SELECT COALESCE(jsonb_agg(row_to_json(c)), '[]'::jsonb) FROM (
        SELECT city, COUNT(*) AS users FROM public.profiles
        WHERE city IS NOT NULL AND city <> '' GROUP BY city ORDER BY COUNT(*) DESC LIMIT 8
      ) c
    ),
    'top_help_categories', (
      SELECT COALESCE(jsonb_agg(row_to_json(c)), '[]'::jsonb) FROM (
        SELECT category::text AS name, COUNT(*) AS total FROM public.help_requests
        GROUP BY category ORDER BY COUNT(*) DESC LIMIT 8
      ) c
    ),
    'top_skills', (
      SELECT COALESCE(jsonb_agg(row_to_json(c)), '[]'::jsonb) FROM (
        SELECT o.category AS name, COUNT(b.id) AS total
        FROM public.skill_offerings o
        LEFT JOIN public.skill_bookings b ON b.offering_id = o.id
        GROUP BY o.category ORDER BY COUNT(b.id) DESC LIMIT 8
      ) c
    ),
    'top_teachers', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
        SELECT b.teacher_id AS user_id, p.name,
               COUNT(*) FILTER (WHERE b.status = 'completed') AS sessions,
               COALESCE(SUM(b.price) FILTER (WHERE b.status = 'completed'), 0) AS earned
        FROM public.skill_bookings b
        JOIN public.profiles p ON p.id = b.teacher_id
        GROUP BY b.teacher_id, p.name
        ORDER BY COUNT(*) FILTER (WHERE b.status = 'completed') DESC LIMIT 8
      ) t
    ),
    'top_helpers', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
        SELECT r.helper_id AS user_id, p.name,
               COUNT(*) FILTER (WHERE r.status = 'completed') AS tasks,
               COALESCE(SUM(r.final_fare) FILTER (WHERE r.status = 'completed'), 0) AS earned
        FROM public.help_requests r
        JOIN public.profiles p ON p.id = r.helper_id
        WHERE r.helper_id IS NOT NULL
        GROUP BY r.helper_id, p.name
        ORDER BY COUNT(*) FILTER (WHERE r.status = 'completed') DESC LIMIT 8
      ) t
    ),
    'activity', (
      SELECT COALESCE(jsonb_agg(row_to_json(h)), '[]'::jsonb) FROM (
        SELECT EXTRACT(dow FROM created_at)::int AS dow,
               EXTRACT(hour FROM created_at)::int AS hour,
               COUNT(*) AS total
        FROM public.help_requests
        WHERE created_at >= now() - interval '60 days'
        GROUP BY 1, 2
      ) h
    )
  ) INTO _out;

  RETURN _out;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_overview() TO authenticated;

-- 6. Realtime --------------------------------------------------------------
ALTER TABLE public.request_tracking REPLICA IDENTITY FULL;
ALTER TABLE public.help_requests REPLICA IDENTITY FULL;
ALTER TABLE public.skill_bookings REPLICA IDENTITY FULL;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.request_tracking;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.help_requests;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.skill_bookings;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;