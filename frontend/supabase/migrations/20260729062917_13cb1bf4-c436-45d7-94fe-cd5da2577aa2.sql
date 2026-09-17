ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS formatted_address text,
  ADD COLUMN IF NOT EXISTS location_updated_at timestamptz;

DO $$ BEGIN
  CREATE TYPE public.teaching_mode AS ENUM ('online','offline','both');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.teacher_profiles
  ADD COLUMN IF NOT EXISTS teaching_mode public.teaching_mode NOT NULL DEFAULT 'both',
  ADD COLUMN IF NOT EXISTS location geography(Point,4326),
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS formatted_address text;

CREATE INDEX IF NOT EXISTS teacher_profiles_location_gix ON public.teacher_profiles USING gist (location);
CREATE INDEX IF NOT EXISTS profiles_location_gix ON public.profiles USING gist (location);

CREATE OR REPLACE FUNCTION public.sync_profile_location()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
    NEW.location_updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_sync_location ON public.profiles;
CREATE TRIGGER profiles_sync_location
BEFORE INSERT OR UPDATE OF latitude, longitude ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_location();

CREATE OR REPLACE FUNCTION public.sync_teacher_location()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS teacher_profiles_sync_location ON public.teacher_profiles;
CREATE TRIGGER teacher_profiles_sync_location
BEFORE INSERT OR UPDATE OF latitude, longitude ON public.teacher_profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_teacher_location();

DROP FUNCTION IF EXISTS public.nearby_teachers(double precision, double precision, integer);

CREATE FUNCTION public.nearby_teachers(_lat double precision, _lng double precision, _radius_m integer)
RETURNS TABLE(
  teacher_id uuid,
  name text,
  profile_photo_url text,
  headline text,
  bio text,
  experience_years integer,
  hourly_rate numeric,
  availability text,
  teaching_mode public.teaching_mode,
  city text,
  formatted_address text,
  latitude double precision,
  longitude double precision,
  distance_m double precision
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT ST_SetSRID(ST_MakePoint(_lng, _lat), 4326)::geography AS g
  )
  SELECT
    tp.user_id,
    p.name,
    p.profile_photo_url,
    tp.headline,
    tp.bio,
    tp.experience_years,
    tp.hourly_rate,
    tp.availability,
    tp.teaching_mode,
    COALESCE(tp.city, p.city),
    COALESCE(tp.formatted_address, p.formatted_address),
    COALESCE(tp.latitude, p.latitude),
    COALESCE(tp.longitude, p.longitude),
    ST_Distance(COALESCE(tp.location, p.location), me.g) AS distance_m
  FROM public.teacher_profiles tp
  JOIN public.profiles p ON p.id = tp.user_id
  CROSS JOIN me
  WHERE tp.is_published = true
    AND p.is_active = true
    AND (
      tp.teaching_mode = 'online'
      OR (
        COALESCE(tp.location, p.location) IS NOT NULL
        AND ST_DWithin(COALESCE(tp.location, p.location), me.g, _radius_m)
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public.nearby_teachers(double precision, double precision, integer) TO authenticated;