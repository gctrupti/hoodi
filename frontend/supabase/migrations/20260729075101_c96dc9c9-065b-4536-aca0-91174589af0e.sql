ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cover_image_url text;

CREATE POLICY "profile media readable by authenticated"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'profile-media');

CREATE POLICY "users upload own profile media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'profile-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "users update own profile media"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'profile-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "users delete own profile media"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'profile-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE OR REPLACE FUNCTION public.profile_stats(_user_id uuid)
RETURNS TABLE (
  helps_completed bigint,
  requests_posted bigint,
  sessions_taught bigint,
  sessions_learned bigint,
  avg_score numeric,
  rating_count bigint,
  member_since timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT count(*) FROM help_requests WHERE helper_id = _user_id AND status = 'completed'),
    (SELECT count(*) FROM help_requests WHERE requester_id = _user_id),
    (SELECT count(*) FROM skill_bookings WHERE teacher_id = _user_id AND status = 'completed'),
    (SELECT count(*) FROM skill_bookings WHERE learner_id = _user_id AND status = 'completed'),
    (SELECT round(avg(score)::numeric, 2) FROM ratings WHERE ratee_id = _user_id),
    (SELECT count(*) FROM ratings WHERE ratee_id = _user_id),
    (SELECT created_at FROM profiles WHERE id = _user_id);
$$;

GRANT EXECUTE ON FUNCTION public.profile_stats(uuid) TO authenticated;