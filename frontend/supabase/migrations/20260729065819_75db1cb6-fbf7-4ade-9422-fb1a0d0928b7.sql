DO $$ BEGIN
  CREATE TYPE public.help_request_type AS ENUM ('pickup_delivery','home_assistance','transportation','elder_care','custom');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.help_requests
  ADD COLUMN IF NOT EXISTS request_type public.help_request_type NOT NULL DEFAULT 'custom',
  ADD COLUMN IF NOT EXISTS pickup_name text,
  ADD COLUMN IF NOT EXISTS pickup_address text,
  ADD COLUMN IF NOT EXISTS pickup_lat double precision,
  ADD COLUMN IF NOT EXISTS pickup_lng double precision,
  ADD COLUMN IF NOT EXISTS dropoff_name text,
  ADD COLUMN IF NOT EXISTS dropoff_address text,
  ADD COLUMN IF NOT EXISTS dropoff_lat double precision,
  ADD COLUMN IF NOT EXISTS dropoff_lng double precision;

UPDATE public.help_requests SET request_type =
  CASE
    WHEN category = 'grocery' THEN 'pickup_delivery'::public.help_request_type
    WHEN category = 'transportation' THEN 'transportation'::public.help_request_type
    WHEN category = 'elderly_care' THEN 'elder_care'::public.help_request_type
    WHEN category = 'errand' THEN 'home_assistance'::public.help_request_type
    ELSE 'custom'::public.help_request_type
  END
WHERE request_type = 'custom';