-- ============ ENUMS ============
CREATE TYPE public.booking_status AS ENUM ('requested','confirmed','in_progress','completed','cancelled');

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'booking_requested';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'booking_confirmed';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'booking_cancelled';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'booking_completed';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'session_reminder';

-- ============ TEACHER PROFILES ============
CREATE TABLE public.teacher_profiles (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  headline text,
  bio text,
  experience_years integer NOT NULL DEFAULT 0,
  hourly_rate numeric(10,2) NOT NULL DEFAULT 0,
  availability text,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_profiles TO authenticated;
GRANT ALL ON public.teacher_profiles TO service_role;
ALTER TABLE public.teacher_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teacher_profiles read published or self" ON public.teacher_profiles
  FOR SELECT TO authenticated USING (is_published = true OR user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "teacher_profiles insert self" ON public.teacher_profiles
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "teacher_profiles update self" ON public.teacher_profiles
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "teacher_profiles delete self" ON public.teacher_profiles
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============ SKILL OFFERINGS ============
CREATE TABLE public.skill_offerings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'other',
  price_per_session numeric(10,2) NOT NULL DEFAULT 0,
  duration_minutes integer NOT NULL DEFAULT 60,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX skill_offerings_teacher_idx ON public.skill_offerings(teacher_id);
CREATE INDEX skill_offerings_published_idx ON public.skill_offerings(is_published, category);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.skill_offerings TO authenticated;
GRANT ALL ON public.skill_offerings TO service_role;
ALTER TABLE public.skill_offerings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "offerings read published or own" ON public.skill_offerings
  FOR SELECT TO authenticated USING (is_published = true OR teacher_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "offerings insert own" ON public.skill_offerings
  FOR INSERT TO authenticated WITH CHECK (teacher_id = auth.uid());
CREATE POLICY "offerings update own" ON public.skill_offerings
  FOR UPDATE TO authenticated USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());
CREATE POLICY "offerings delete own" ON public.skill_offerings
  FOR DELETE TO authenticated USING (teacher_id = auth.uid());

-- ============ SKILL BOOKINGS ============
CREATE TABLE public.skill_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offering_id uuid NOT NULL REFERENCES public.skill_offerings(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  learner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  scheduled_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 60,
  price numeric(10,2) NOT NULL DEFAULT 0,
  commission_amount numeric(10,2),
  status public.booking_status NOT NULL DEFAULT 'requested',
  notes text,
  payment_id uuid,
  cancelled_by uuid,
  cancelled_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX skill_bookings_teacher_idx ON public.skill_bookings(teacher_id, scheduled_at DESC);
CREATE INDEX skill_bookings_learner_idx ON public.skill_bookings(learner_id, scheduled_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.skill_bookings TO authenticated;
GRANT ALL ON public.skill_bookings TO service_role;
ALTER TABLE public.skill_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bookings read party" ON public.skill_bookings
  FOR SELECT TO authenticated USING (learner_id = auth.uid() OR teacher_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "bookings insert learner" ON public.skill_bookings
  FOR INSERT TO authenticated WITH CHECK (learner_id = auth.uid() AND teacher_id <> auth.uid());
CREATE POLICY "bookings update party" ON public.skill_bookings
  FOR UPDATE TO authenticated
  USING (learner_id = auth.uid() OR teacher_id = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (learner_id = auth.uid() OR teacher_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE TRIGGER trg_teacher_profiles_updated BEFORE UPDATE ON public.teacher_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_skill_offerings_updated BEFORE UPDATE ON public.skill_offerings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_skill_bookings_updated BEFORE UPDATE ON public.skill_bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ BOOKING PARTY HELPER ============
CREATE OR REPLACE FUNCTION public.is_booking_party(_booking_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.skill_bookings b
    WHERE b.id = _booking_id AND (b.learner_id = _user_id OR b.teacher_id = _user_id)
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_booking_party(uuid, uuid) TO authenticated;

-- ============ SHARED CHAT: allow booking threads ============
ALTER TABLE public.chat_threads ALTER COLUMN request_id DROP NOT NULL;
ALTER TABLE public.chat_threads ADD COLUMN booking_id uuid UNIQUE REFERENCES public.skill_bookings(id) ON DELETE CASCADE;
ALTER TABLE public.chat_threads ADD CONSTRAINT chat_threads_one_parent
  CHECK ((request_id IS NOT NULL AND booking_id IS NULL) OR (request_id IS NULL AND booking_id IS NOT NULL));

DROP POLICY "chat_threads read party" ON public.chat_threads;
DROP POLICY "chat_threads insert party" ON public.chat_threads;
CREATE POLICY "chat_threads read party" ON public.chat_threads
  FOR SELECT TO authenticated USING (
    (request_id IS NOT NULL AND public.is_request_party(request_id, auth.uid()))
    OR (booking_id IS NOT NULL AND public.is_booking_party(booking_id, auth.uid()))
    OR public.is_admin(auth.uid())
  );
CREATE POLICY "chat_threads insert party" ON public.chat_threads
  FOR INSERT TO authenticated WITH CHECK (
    (request_id IS NOT NULL AND public.is_request_party(request_id, auth.uid()))
    OR (booking_id IS NOT NULL AND public.is_booking_party(booking_id, auth.uid()))
  );

-- is_thread_party must understand booking threads too
CREATE OR REPLACE FUNCTION public.is_thread_party(_thread_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_threads t
    WHERE t.id = _thread_id
      AND (
        (t.request_id IS NOT NULL AND public.is_request_party(t.request_id, _user_id))
        OR (t.booking_id IS NOT NULL AND public.is_booking_party(t.booking_id, _user_id))
      )
  );
$$;

-- ============ SHARED RATINGS: allow booking ratings ============
ALTER TABLE public.ratings ALTER COLUMN request_id DROP NOT NULL;
ALTER TABLE public.ratings ADD COLUMN booking_id uuid REFERENCES public.skill_bookings(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX ratings_booking_rater_key ON public.ratings(booking_id, rater_id) WHERE booking_id IS NOT NULL;

DROP POLICY "ratings insert party completed" ON public.ratings;
CREATE POLICY "ratings insert party completed" ON public.ratings
  FOR INSERT TO authenticated WITH CHECK (
    rater_id = auth.uid() AND ratee_id <> auth.uid() AND (
      (request_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.help_requests r
        WHERE r.id = ratings.request_id AND r.status = 'completed'
          AND (r.requester_id = auth.uid() OR r.helper_id = auth.uid())
          AND (r.requester_id = ratings.ratee_id OR r.helper_id = ratings.ratee_id)))
      OR
      (booking_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.skill_bookings b
        WHERE b.id = ratings.booking_id AND b.status = 'completed'
          AND (b.learner_id = auth.uid() OR b.teacher_id = auth.uid())
          AND (b.learner_id = ratings.ratee_id OR b.teacher_id = ratings.ratee_id)))
    )
  );

-- ============ SHARED NOTIFICATIONS: booking reference ============
ALTER TABLE public.notifications ADD COLUMN booking_id uuid REFERENCES public.skill_bookings(id) ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION public.insert_booking_notification(
  _user_id uuid, _type public.notification_type, _booking_id uuid, _message text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_booking_party(_booking_id, auth.uid()) THEN
    RAISE EXCEPTION 'not_booking_party';
  END IF;
  INSERT INTO public.notifications(user_id, type, booking_id, message)
  VALUES (_user_id, _type, _booking_id, _message);
END;
$$;
GRANT EXECUTE ON FUNCTION public.insert_booking_notification(uuid, public.notification_type, uuid, text) TO authenticated;

-- ============ SHARED PAYMENTS: booking payments ============
ALTER TABLE public.payments ALTER COLUMN request_id DROP NOT NULL;
ALTER TABLE public.payments ADD COLUMN booking_id uuid REFERENCES public.skill_bookings(id) ON DELETE CASCADE;
DROP POLICY "payments read party or admin" ON public.payments;
CREATE POLICY "payments read party or admin" ON public.payments
  FOR SELECT TO authenticated USING (
    (request_id IS NOT NULL AND public.is_request_party(request_id, auth.uid()))
    OR (booking_id IS NOT NULL AND public.is_booking_party(booking_id, auth.uid()))
    OR public.is_admin(auth.uid())
  );

-- ============ NEARBY TEACHERS ============
CREATE OR REPLACE FUNCTION public.nearby_teachers(
  _lat double precision, _lng double precision, _radius_m integer DEFAULT 5000
)
RETURNS TABLE(
  teacher_id uuid, name text, profile_photo_url text, headline text, bio text,
  experience_years integer, hourly_rate numeric, availability text,
  distance_m double precision, avg_score numeric, rating_count bigint,
  min_price numeric, offering_count bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT tp.user_id, p.name, p.profile_photo_url, tp.headline, tp.bio,
         tp.experience_years, tp.hourly_rate, tp.availability,
         CASE WHEN p.location IS NULL THEN NULL
              ELSE ST_Distance(p.location, ST_SetSRID(ST_MakePoint(_lng, _lat), 4326)::geography) END,
         r.avg_score, COALESCE(r.rating_count, 0),
         o.min_price, COALESCE(o.offering_count, 0)
  FROM public.teacher_profiles tp
  JOIN public.profiles p ON p.id = tp.user_id AND p.is_active
  LEFT JOIN LATERAL (
    SELECT ROUND(AVG(score)::numeric, 2) AS avg_score, COUNT(*) AS rating_count
    FROM public.ratings WHERE ratee_id = tp.user_id
  ) r ON true
  LEFT JOIN LATERAL (
    SELECT MIN(price_per_session) AS min_price, COUNT(*) AS offering_count
    FROM public.skill_offerings WHERE teacher_id = tp.user_id AND is_published
  ) o ON true
  WHERE tp.is_published
    AND (
      _radius_m IS NULL OR p.location IS NULL
      OR ST_DWithin(p.location, ST_SetSRID(ST_MakePoint(_lng, _lat), 4326)::geography, _radius_m)
    );
$$;
GRANT EXECUTE ON FUNCTION public.nearby_teachers(double precision, double precision, integer) TO authenticated;

-- ============ BOOKING PAYMENT CAPTURE (privileged) ============
CREATE OR REPLACE FUNCTION public.capture_booking_payment(_payment_id uuid, _external_payment_id text DEFAULT NULL)
RETURNS TABLE(payment_id uuid, booking_id uuid, amount numeric, commission numeric,
              teacher_credit numeric, teacher_id uuid, wallet_balance numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  v_payment public.payments%ROWTYPE;
  v_booking public.skill_bookings%ROWTYPE;
  v_rate numeric(5,4) := 0.15;
  v_commission numeric(12,2);
  v_credit numeric(12,2);
  v_balance numeric(12,2);
BEGIN
  SELECT * INTO v_payment FROM public.payments WHERE id = _payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'payment_not_found'; END IF;
  IF v_payment.booking_id IS NULL THEN RAISE EXCEPTION 'not_a_booking_payment'; END IF;

  SELECT * INTO v_booking FROM public.skill_bookings b WHERE b.id = v_payment.booking_id FOR UPDATE;

  v_commission := ROUND(v_payment.amount * v_rate, 2);
  v_credit := v_payment.amount - v_commission;

  IF v_payment.status = 'released' THEN
    SELECT w.balance INTO v_balance FROM public.wallets w WHERE w.user_id = v_booking.teacher_id;
    capture_booking_payment.payment_id := v_payment.id;
    capture_booking_payment.booking_id := v_booking.id;
    capture_booking_payment.amount := v_payment.amount;
    capture_booking_payment.commission := v_commission;
    capture_booking_payment.teacher_credit := v_credit;
    capture_booking_payment.teacher_id := v_booking.teacher_id;
    capture_booking_payment.wallet_balance := COALESCE(v_balance, 0);
    RETURN NEXT;
    RETURN;
  END IF;

  UPDATE public.payments
    SET status = 'released',
        razorpay_payment_id = COALESCE(_external_payment_id, razorpay_payment_id),
        updated_at = now()
    WHERE id = v_payment.id RETURNING * INTO v_payment;

  UPDATE public.skill_bookings
    SET commission_amount = v_commission, updated_at = now()
    WHERE id = v_booking.id;

  INSERT INTO public.wallets(user_id, balance) VALUES (v_booking.teacher_id, v_credit)
    ON CONFLICT (user_id) DO UPDATE
      SET balance = public.wallets.balance + EXCLUDED.balance, updated_at = now()
    RETURNING balance INTO v_balance;

  INSERT INTO public.notifications(user_id, type, booking_id, message) VALUES
    (v_booking.teacher_id, 'booking_completed'::public.notification_type, v_booking.id,
     'Session payment released to your wallet: ' || v_credit),
    (v_booking.learner_id, 'booking_completed'::public.notification_type, v_booking.id,
     'Session payment captured. Thank you!');

  capture_booking_payment.payment_id := v_payment.id;
  capture_booking_payment.booking_id := v_booking.id;
  capture_booking_payment.amount := v_payment.amount;
  capture_booking_payment.commission := v_commission;
  capture_booking_payment.teacher_credit := v_credit;
  capture_booking_payment.teacher_id := v_booking.teacher_id;
  capture_booking_payment.wallet_balance := v_balance;
  RETURN NEXT;
END;
$$;
REVOKE ALL ON FUNCTION public.capture_booking_payment(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.capture_booking_payment(uuid, text) TO service_role;