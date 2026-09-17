DROP FUNCTION IF EXISTS public.nearby_open_requests(double precision, double precision, integer, request_category, urgency_level);

CREATE OR REPLACE FUNCTION public.nearby_open_requests(
  _lat double precision,
  _lng double precision,
  _radius_m integer DEFAULT 5000,
  _category request_category DEFAULT NULL::request_category,
  _urgency urgency_level DEFAULT NULL::urgency_level
)
RETURNS TABLE(
  id uuid, requester_id uuid, title text, description text,
  category request_category, urgency urgency_level, is_paid boolean,
  estimated_fare numeric, photo_url text, address_text text,
  latitude double precision, longitude double precision,
  distance_m double precision, created_at timestamp with time zone
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT
    r.id, r.requester_id, r.title, r.description, r.category, r.urgency,
    r.is_paid, r.estimated_fare, r.photo_url, r.address_text,
    ST_Y(r.location::geometry) AS latitude,
    ST_X(r.location::geometry) AS longitude,
    ST_Distance(r.location, ST_SetSRID(ST_MakePoint(_lng, _lat), 4326)::geography) AS distance_m,
    r.created_at
  FROM public.help_requests r
  WHERE r.status = 'open'
    AND r.location IS NOT NULL
    AND (_category IS NULL OR r.category = _category)
    AND (_urgency  IS NULL OR r.urgency  = _urgency)
    AND ST_DWithin(r.location, ST_SetSRID(ST_MakePoint(_lng, _lat), 4326)::geography, _radius_m)
  ORDER BY
    CASE r.urgency WHEN 'emergency' THEN 0 WHEN 'today' THEN 1 ELSE 2 END,
    distance_m ASC;
$function$;

GRANT EXECUTE ON FUNCTION public.nearby_open_requests(double precision, double precision, integer, request_category, urgency_level) TO authenticated, service_role;