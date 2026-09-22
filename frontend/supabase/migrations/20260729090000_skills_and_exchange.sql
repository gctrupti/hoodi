-- =============================================
-- Migration: Enhanced Skills System & Peer Skill Exchange
-- =============================================

-- 1. Enhance Teacher Profiles with verification, portfolio, and certifications
ALTER TABLE public.teacher_profiles
  ADD COLUMN IF NOT EXISTS is_verified_teacher boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS portfolio_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS certifications jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 2. Learner Profiles & Preferences
CREATE TABLE IF NOT EXISTS public.learner_profiles (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  learning_goals text[] NOT NULL DEFAULT '{}',
  target_skills text[] NOT NULL DEFAULT '{}',
  skill_level text NOT NULL DEFAULT 'beginner', -- 'beginner' | 'intermediate' | 'advanced' | 'all'
  preferred_schedule text NOT NULL DEFAULT 'flexible', -- 'weekday_evenings' | 'weekend_mornings' | 'weekends' | 'flexible'
  budget_max numeric(10,2) NOT NULL DEFAULT 1000.00,
  mode_preference text NOT NULL DEFAULT 'both', -- 'online' | 'offline' | 'both'
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.learner_profiles TO authenticated;
GRANT ALL ON public.learner_profiles TO service_role;
ALTER TABLE public.learner_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "learner_profiles read own or public" ON public.learner_profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "learner_profiles insert own" ON public.learner_profiles
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "learner_profiles update own" ON public.learner_profiles
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trg_learner_profiles_updated BEFORE UPDATE ON public.learner_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Skill Exchange Preferences (Offers & Wants)
CREATE TABLE IF NOT EXISTS public.skill_exchange_preferences (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  offers_skills text[] NOT NULL DEFAULT '{}',
  wants_skills text[] NOT NULL DEFAULT '{}',
  bio_note text,
  preferred_mode text NOT NULL DEFAULT 'both', -- 'online' | 'offline' | 'both'
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.skill_exchange_preferences TO authenticated;
GRANT ALL ON public.skill_exchange_preferences TO service_role;
ALTER TABLE public.skill_exchange_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "skill_exchange_preferences read all active" ON public.skill_exchange_preferences
  FOR SELECT TO authenticated USING (is_active = true OR user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "skill_exchange_preferences insert own" ON public.skill_exchange_preferences
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "skill_exchange_preferences update own" ON public.skill_exchange_preferences
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trg_skill_exchange_preferences_updated BEFORE UPDATE ON public.skill_exchange_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Skill Exchanges (Active Swaps)
CREATE TABLE IF NOT EXISTS public.skill_exchanges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  proposer_teaches text NOT NULL,
  proposer_learns text NOT NULL,
  recipient_teaches text NOT NULL,
  recipient_learns text NOT NULL,
  teaching_mode text NOT NULL DEFAULT 'both', -- 'online' | 'offline' | 'both'
  status text NOT NULL DEFAULT 'proposed', -- 'proposed' | 'accepted' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'declined'
  session_schedule jsonb DEFAULT '[]'::jsonb,
  meeting_link text,
  location_address text,
  chat_thread_id uuid REFERENCES public.chat_threads(id) ON DELETE SET NULL,
  proposer_completed boolean NOT NULL DEFAULT false,
  recipient_completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS skill_exchanges_parties_idx ON public.skill_exchanges(proposer_id, recipient_id, status);

GRANT SELECT, INSERT, UPDATE ON public.skill_exchanges TO authenticated;
GRANT ALL ON public.skill_exchanges TO service_role;
ALTER TABLE public.skill_exchanges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "skill_exchanges read party" ON public.skill_exchanges
  FOR SELECT TO authenticated USING (
    proposer_id = auth.uid() OR recipient_id = auth.uid() OR public.is_admin(auth.uid())
  );

CREATE POLICY "skill_exchanges insert proposer" ON public.skill_exchanges
  FOR INSERT TO authenticated WITH CHECK (
    proposer_id = auth.uid() AND recipient_id <> auth.uid()
  );

CREATE POLICY "skill_exchanges update party" ON public.skill_exchanges
  FOR UPDATE TO authenticated USING (
    proposer_id = auth.uid() OR recipient_id = auth.uid() OR public.is_admin(auth.uid())
  ) WITH CHECK (
    proposer_id = auth.uid() OR recipient_id = auth.uid() OR public.is_admin(auth.uid())
  );

CREATE TRIGGER trg_skill_exchanges_updated BEFORE UPDATE ON public.skill_exchanges
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. Extend chat_threads for exchange threads
ALTER TABLE public.chat_threads
  ADD COLUMN IF NOT EXISTS exchange_id uuid REFERENCES public.skill_exchanges(id) ON DELETE CASCADE;

CREATE POLICY "chat_threads read exchange party" ON public.chat_threads
  FOR SELECT TO authenticated USING (
    exchange_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.skill_exchanges e
      WHERE e.id = chat_threads.exchange_id AND (e.proposer_id = auth.uid() OR e.recipient_id = auth.uid())
    )
  );

CREATE POLICY "chat_threads insert exchange party" ON public.chat_threads
  FOR INSERT TO authenticated WITH CHECK (
    exchange_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.skill_exchanges e
      WHERE e.id = chat_threads.exchange_id AND (e.proposer_id = auth.uid() OR e.recipient_id = auth.uid())
    )
  );
