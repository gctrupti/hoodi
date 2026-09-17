ALTER TABLE public.teacher_profiles
  ADD COLUMN IF NOT EXISTS meeting_provider text,
  ADD COLUMN IF NOT EXISTS meeting_link text,
  ADD COLUMN IF NOT EXISTS languages text[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS public.category_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  suggested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module text NOT NULL CHECK (module IN ('help', 'skills')),
  name text NOT NULL,
  note text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.category_suggestions TO authenticated;
GRANT UPDATE ON public.category_suggestions TO authenticated;
GRANT ALL ON public.category_suggestions TO service_role;

ALTER TABLE public.category_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "suggestions read approved or own or admin"
  ON public.category_suggestions FOR SELECT TO authenticated
  USING (status = 'approved' OR suggested_by = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "suggestions insert own"
  ON public.category_suggestions FOR INSERT TO authenticated
  WITH CHECK (suggested_by = auth.uid());

CREATE POLICY "suggestions admin update"
  ON public.category_suggestions FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER category_suggestions_updated_at
  BEFORE UPDATE ON public.category_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS category_suggestions_module_status_idx
  ON public.category_suggestions (module, status);