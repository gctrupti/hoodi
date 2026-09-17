CREATE TYPE public.verification_kind AS ENUM ('email','phone','government_id','selfie');
CREATE TYPE public.verification_status AS ENUM ('pending','verified','rejected');
CREATE TYPE public.report_reason AS ENUM ('fake_profile','abuse','spam','harassment','scam','unsafe_behaviour','other');
CREATE TYPE public.report_status AS ENUM ('open','reviewing','actioned','dismissed');

CREATE TABLE public.user_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind public.verification_kind NOT NULL,
  status public.verification_status NOT NULL DEFAULT 'pending',
  document_path text,
  submitted_value text,
  review_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind)
);

GRANT SELECT, INSERT, UPDATE ON public.user_verifications TO authenticated;
GRANT ALL ON public.user_verifications TO service_role;
ALTER TABLE public.user_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own verifications readable"
  ON public.user_verifications FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "own verifications insert"
  ON public.user_verifications FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "own verifications update"
  ON public.user_verifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE TRIGGER user_verifications_updated_at
  BEFORE UPDATE ON public.user_verifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.user_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason public.report_reason NOT NULL,
  details text,
  context_type text,
  context_id uuid,
  status public.report_status NOT NULL DEFAULT 'open',
  resolution_note text,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT no_self_report CHECK (reporter_id <> target_user_id)
);

GRANT SELECT, INSERT, UPDATE ON public.user_reports TO authenticated;
GRANT ALL ON public.user_reports TO service_role;
ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reports readable by reporter or admin"
  ON public.user_reports FOR SELECT TO authenticated
  USING (reporter_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "reports insert by reporter"
  ON public.user_reports FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());

CREATE POLICY "reports update by admin"
  ON public.user_reports FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER user_reports_updated_at
  BEFORE UPDATE ON public.user_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX user_reports_target_idx ON public.user_reports (target_user_id);

CREATE TABLE public.user_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_id),
  CONSTRAINT no_self_block CHECK (blocker_id <> blocked_id)
);

GRANT SELECT, INSERT, DELETE ON public.user_blocks TO authenticated;
GRANT ALL ON public.user_blocks TO service_role;
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own blocks readable"
  ON public.user_blocks FOR SELECT TO authenticated
  USING (blocker_id = auth.uid() OR blocked_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "own blocks insert"
  ON public.user_blocks FOR INSERT TO authenticated
  WITH CHECK (blocker_id = auth.uid());

CREATE POLICY "own blocks delete"
  ON public.user_blocks FOR DELETE TO authenticated
  USING (blocker_id = auth.uid());

CREATE OR REPLACE FUNCTION public.user_trust(_user_id uuid)
RETURNS TABLE (
  email_verified boolean,
  phone_verified boolean,
  id_verified boolean,
  selfie_verified boolean,
  is_verified boolean,
  helps_completed bigint,
  sessions_taught bigint,
  avg_score numeric,
  rating_count bigint,
  badges text[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_email boolean;
  v_phone boolean;
  v_id boolean;
  v_selfie boolean;
  v_helps bigint;
  v_taught bigint;
  v_avg numeric;
  v_count bigint;
  v_badges text[] := '{}';
BEGIN
  SELECT
    COALESCE(bool_or(kind = 'email' AND status = 'verified'), false),
    COALESCE(bool_or(kind = 'phone' AND status = 'verified'), false),
    COALESCE(bool_or(kind = 'government_id' AND status = 'verified'), false),
    COALESCE(bool_or(kind = 'selfie' AND status = 'verified'), false)
  INTO v_email, v_phone, v_id, v_selfie
  FROM public.user_verifications WHERE user_id = _user_id;

  IF NOT COALESCE(v_phone, false) THEN
    SELECT COALESCE(p.phone_verified, false) INTO v_phone FROM public.profiles p WHERE p.id = _user_id;
  END IF;

  SELECT count(*) INTO v_helps
  FROM public.help_requests WHERE helper_id = _user_id AND status = 'completed';

  SELECT count(*) INTO v_taught
  FROM public.skill_bookings WHERE teacher_id = _user_id AND status = 'completed';

  SELECT round(avg(score)::numeric, 2), count(*) INTO v_avg, v_count
  FROM public.ratings WHERE ratee_id = _user_id;

  IF COALESCE(v_phone,false) OR COALESCE(v_id,false) THEN v_badges := array_append(v_badges, 'verified_user'); END IF;
  IF (COALESCE(v_phone,false) OR COALESCE(v_id,false)) AND COALESCE(v_helps,0) >= 1 THEN v_badges := array_append(v_badges, 'verified_helper'); END IF;
  IF (COALESCE(v_phone,false) OR COALESCE(v_id,false)) AND COALESCE(v_taught,0) >= 1 THEN v_badges := array_append(v_badges, 'verified_teacher'); END IF;
  IF COALESCE(v_helps,0) >= 10 AND COALESCE(v_avg, 0) >= 4.5 THEN v_badges := array_append(v_badges, 'super_helper'); END IF;
  IF COALESCE(v_taught,0) >= 10 AND COALESCE(v_avg, 0) >= 4.5 THEN v_badges := array_append(v_badges, 'top_mentor'); END IF;

  RETURN QUERY SELECT
    COALESCE(v_email, false), COALESCE(v_phone, false), COALESCE(v_id, false), COALESCE(v_selfie, false),
    COALESCE(v_phone, false) OR COALESCE(v_id, false),
    COALESCE(v_helps, 0), COALESCE(v_taught, 0), v_avg, COALESCE(v_count, 0), v_badges;
END;
$fn$;

REVOKE ALL ON FUNCTION public.user_trust(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_trust(uuid) TO authenticated, service_role;

CREATE POLICY "own verification docs insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'verification-docs' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "own verification docs read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'verification-docs'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin(auth.uid()))
  );

CREATE POLICY "own verification docs update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'verification-docs' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'verification-docs' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "own verification docs delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'verification-docs' AND (storage.foldername(name))[1] = auth.uid()::text);

-- trust and safety foundation complete</query>
