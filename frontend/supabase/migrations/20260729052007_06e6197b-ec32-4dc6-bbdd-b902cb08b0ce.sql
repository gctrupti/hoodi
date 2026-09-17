ALTER TABLE public.teacher_profiles
  ADD COLUMN IF NOT EXISTS availability_slots jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.teacher_profiles.availability_slots IS
  'Array of {day:0-6, start:"HH:MM", end:"HH:MM"} weekly recurring availability slots.';