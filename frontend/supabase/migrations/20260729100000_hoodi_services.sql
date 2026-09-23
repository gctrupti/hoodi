-- =============================================
-- Migration: Hoodi Services — Marketplace Vertical
-- =============================================

-- 1. Service Categories & Subcategories (Dynamic, Admin-managed)
CREATE TABLE IF NOT EXISTS public.service_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  icon text NOT NULL DEFAULT 'Wrench',
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.service_subcategories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.service_categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category_id, slug)
);

CREATE INDEX IF NOT EXISTS service_subcategories_cat_idx ON public.service_subcategories(category_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_categories TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_subcategories TO authenticated, anon;
GRANT ALL ON public.service_categories TO service_role;
GRANT ALL ON public.service_subcategories TO service_role;

ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_subcategories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_categories_read_all" ON public.service_categories
  FOR SELECT USING (true);
CREATE POLICY "service_categories_admin_all" ON public.service_categories
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "service_subcategories_read_all" ON public.service_subcategories
  FOR SELECT USING (true);
CREATE POLICY "service_subcategories_admin_all" ON public.service_subcategories
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER trg_service_categories_updated BEFORE UPDATE ON public.service_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_service_subcategories_updated BEFORE UPDATE ON public.service_subcategories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Service Provider Profiles (Reuses public.profiles)
CREATE TABLE IF NOT EXISTS public.service_provider_profiles (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  business_name text NOT NULL,
  bio text,
  experience_years integer NOT NULL DEFAULT 1,
  service_radius_km numeric(5,2) NOT NULL DEFAULT 15.00,
  is_verified_provider boolean NOT NULL DEFAULT false,
  is_available boolean NOT NULL DEFAULT true,
  is_suspended boolean NOT NULL DEFAULT false,
  working_hours jsonb NOT NULL DEFAULT '{"mon": "09:00-18:00", "tue": "09:00-18:00", "wed": "09:00-18:00", "thu": "09:00-18:00", "fri": "09:00-18:00", "sat": "10:00-16:00", "sun": "closed"}'::jsonb,
  skills text[] NOT NULL DEFAULT '{}',
  languages text[] NOT NULL DEFAULT '{"English", "Hindi"}',
  portfolio_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  certifications jsonb NOT NULL DEFAULT '[]'::jsonb,
  rating numeric(3,2) NOT NULL DEFAULT 5.00,
  completed_jobs_count integer NOT NULL DEFAULT 0,
  location geography(Point, 4326),
  address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sp_profiles_loc_idx ON public.service_provider_profiles USING GIST (location);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_provider_profiles TO authenticated, anon;
GRANT ALL ON public.service_provider_profiles TO service_role;
ALTER TABLE public.service_provider_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_providers_read_all" ON public.service_provider_profiles
  FOR SELECT USING (true);
CREATE POLICY "service_providers_insert_self" ON public.service_provider_profiles
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "service_providers_update_self_or_admin" ON public.service_provider_profiles
  FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE TRIGGER trg_service_providers_updated BEFORE UPDATE ON public.service_provider_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Service Listings (One provider can have multiple listings)
CREATE TABLE IF NOT EXISTS public.service_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.service_provider_profiles(user_id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.service_categories(id) ON DELETE RESTRICT,
  subcategory_id uuid REFERENCES public.service_subcategories(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text NOT NULL,
  pricing_type text NOT NULL DEFAULT 'starting_from', -- 'fixed' | 'starting_from' | 'hourly' | 'custom_quote'
  base_price numeric(10,2) NOT NULL DEFAULT 499.00,
  estimated_duration_mins integer NOT NULL DEFAULT 60,
  service_area_radius_km numeric(5,2) NOT NULL DEFAULT 10.00,
  images jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  rating numeric(3,2) NOT NULL DEFAULT 5.00,
  completed_jobs integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS service_listings_prov_idx ON public.service_listings(provider_id);
CREATE INDEX IF NOT EXISTS service_listings_cat_idx ON public.service_listings(category_id);
CREATE INDEX IF NOT EXISTS service_listings_active_idx ON public.service_listings(is_active);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_listings TO authenticated, anon;
GRANT ALL ON public.service_listings TO service_role;
ALTER TABLE public.service_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_listings_read_all" ON public.service_listings
  FOR SELECT USING (true);
CREATE POLICY "service_listings_insert_owner" ON public.service_listings
  FOR INSERT TO authenticated WITH CHECK (provider_id = auth.uid());
CREATE POLICY "service_listings_update_owner_or_admin" ON public.service_listings
  FOR UPDATE TO authenticated USING (provider_id = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (provider_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "service_listings_delete_owner" ON public.service_listings
  FOR DELETE TO authenticated USING (provider_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE TRIGGER trg_service_listings_updated BEFORE UPDATE ON public.service_listings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Service Bookings Lifecycle
CREATE TABLE IF NOT EXISTS public.service_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES public.service_provider_profiles(user_id) ON DELETE CASCADE,
  listing_id uuid REFERENCES public.service_listings(id) ON DELETE SET NULL,
  category_id uuid REFERENCES public.service_categories(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text NOT NULL,
  scheduled_date date NOT NULL,
  scheduled_time_slot text NOT NULL DEFAULT 'morning', -- 'morning' | 'afternoon' | 'evening' | custom string
  address text NOT NULL,
  latitude double precision,
  longitude double precision,
  budget numeric(10,2),
  notes text,
  photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'requested', -- 'requested' | 'provider_review' | 'quote_sent' | 'accepted' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'rejected' | 'disputed'
  final_price numeric(10,2),
  commission_amount numeric(10,2) NOT NULL DEFAULT 0.00,
  chat_thread_id uuid REFERENCES public.chat_threads(id) ON DELETE SET NULL,
  cancellation_reason text,
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS service_bookings_cust_idx ON public.service_bookings(customer_id);
CREATE INDEX IF NOT EXISTS service_bookings_prov_idx ON public.service_bookings(provider_id);
CREATE INDEX IF NOT EXISTS service_bookings_status_idx ON public.service_bookings(status);

GRANT SELECT, INSERT, UPDATE ON public.service_bookings TO authenticated;
GRANT ALL ON public.service_bookings TO service_role;
ALTER TABLE public.service_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_bookings_read_party" ON public.service_bookings
  FOR SELECT TO authenticated
  USING (customer_id = auth.uid() OR provider_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "service_bookings_insert_customer" ON public.service_bookings
  FOR INSERT TO authenticated
  WITH CHECK (customer_id = auth.uid());
CREATE POLICY "service_bookings_update_party_or_admin" ON public.service_bookings
  FOR UPDATE TO authenticated
  USING (customer_id = auth.uid() OR provider_id = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (customer_id = auth.uid() OR provider_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE TRIGGER trg_service_bookings_updated BEFORE UPDATE ON public.service_bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. Quotation System (Itemized quotes from provider)
CREATE TABLE IF NOT EXISTS public.service_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.service_bookings(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES public.service_provider_profiles(user_id) ON DELETE CASCADE,
  itemized_items jsonb NOT NULL DEFAULT '[]'::jsonb, -- e.g. [{"description": "Inspection", "amount": 200}, {"description": "Labor", "amount": 800}]
  total_amount numeric(10,2) NOT NULL,
  estimated_duration text NOT NULL DEFAULT '1-2 hours',
  notes text,
  status text NOT NULL DEFAULT 'pending', -- 'pending' | 'accepted' | 'rejected' | 'modified'
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS service_quotes_booking_idx ON public.service_quotes(booking_id);

GRANT SELECT, INSERT, UPDATE ON public.service_quotes TO authenticated;
GRANT ALL ON public.service_quotes TO service_role;
ALTER TABLE public.service_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_quotes_read_party" ON public.service_quotes
  FOR SELECT TO authenticated
  USING (
    provider_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.service_bookings b WHERE b.id = booking_id AND b.customer_id = auth.uid()) OR
    public.is_admin(auth.uid())
  );
CREATE POLICY "service_quotes_insert_provider" ON public.service_quotes
  FOR INSERT TO authenticated
  WITH CHECK (provider_id = auth.uid());
CREATE POLICY "service_quotes_update_party" ON public.service_quotes
  FOR UPDATE TO authenticated
  USING (
    provider_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.service_bookings b WHERE b.id = booking_id AND b.customer_id = auth.uid()) OR
    public.is_admin(auth.uid())
  );

CREATE TRIGGER trg_service_quotes_updated BEFORE UPDATE ON public.service_quotes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6. Service Reviews & Detailed Ratings
CREATE TABLE IF NOT EXISTS public.service_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL UNIQUE REFERENCES public.service_bookings(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES public.service_provider_profiles(user_id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  quality_rating smallint CHECK (quality_rating BETWEEN 1 AND 5),
  punctuality_rating smallint CHECK (punctuality_rating BETWEEN 1 AND 5),
  communication_rating smallint CHECK (communication_rating BETWEEN 1 AND 5),
  value_rating smallint CHECK (value_rating BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS service_reviews_prov_idx ON public.service_reviews(provider_id);

GRANT SELECT, INSERT ON public.service_reviews TO authenticated, anon;
GRANT ALL ON public.service_reviews TO service_role;
ALTER TABLE public.service_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_reviews_read_all" ON public.service_reviews
  FOR SELECT USING (true);
CREATE POLICY "service_reviews_insert_reviewer" ON public.service_reviews
  FOR INSERT TO authenticated
  WITH CHECK (
    reviewer_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.service_bookings b
      WHERE b.id = booking_id AND b.customer_id = auth.uid() AND b.status = 'completed'
    )
  );

-- 7. Service Disputes
CREATE TABLE IF NOT EXISTS public.service_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.service_bookings(id) ON DELETE CASCADE,
  raised_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open', -- 'open' | 'under_review' | 'resolved' | 'dismissed'
  resolution_note text,
  resolved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.service_disputes TO authenticated;
GRANT ALL ON public.service_disputes TO service_role;
ALTER TABLE public.service_disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_disputes_read_party_or_admin" ON public.service_disputes
  FOR SELECT TO authenticated
  USING (
    raised_by = auth.uid() OR
    EXISTS (SELECT 1 FROM public.service_bookings b WHERE b.id = booking_id AND (b.customer_id = auth.uid() OR b.provider_id = auth.uid())) OR
    public.is_admin(auth.uid())
  );
CREATE POLICY "service_disputes_insert_party" ON public.service_disputes
  FOR INSERT TO authenticated
  WITH CHECK (raised_by = auth.uid());
CREATE POLICY "service_disputes_admin_manage" ON public.service_disputes
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- 8. Hyperlocal PostGIS function for nearby service listings
CREATE OR REPLACE FUNCTION public.nearby_service_listings(
  user_lat double precision,
  user_lon double precision,
  max_distance_km double precision DEFAULT 20.0,
  filter_category_id uuid DEFAULT NULL,
  search_query text DEFAULT NULL
)
RETURNS TABLE (
  listing_id uuid,
  provider_id uuid,
  provider_name text,
  business_name text,
  is_verified_provider boolean,
  provider_rating numeric,
  category_id uuid,
  category_name text,
  title text,
  description text,
  pricing_type text,
  base_price numeric,
  estimated_duration_mins integer,
  service_area_radius_km numeric,
  images jsonb,
  distance_km double precision
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
  SELECT
    l.id AS listing_id,
    p.user_id AS provider_id,
    prof.name AS provider_name,
    p.business_name,
    p.is_verified_provider,
    p.rating AS provider_rating,
    c.id AS category_id,
    c.name AS category_name,
    l.title,
    l.description,
    l.pricing_type,
    l.base_price,
    l.estimated_duration_mins,
    l.service_area_radius_km,
    l.images,
    CASE 
      WHEN p.location IS NOT NULL AND user_lat IS NOT NULL AND user_lon IS NOT NULL THEN
        ROUND((ST_Distance(p.location, ST_SetSRID(ST_MakePoint(user_lon, user_lat), 4326)::geography) / 1000.0)::numeric, 2)::double precision
      ELSE 0.0
    END AS distance_km
  FROM public.service_listings l
  JOIN public.service_provider_profiles p ON p.user_id = l.provider_id
  JOIN public.profiles prof ON prof.id = p.user_id
  JOIN public.service_categories c ON c.id = l.category_id
  WHERE l.is_active = true
    AND p.is_available = true
    AND p.is_suspended = false
    AND (filter_category_id IS NULL OR l.category_id = filter_category_id)
    AND (
      search_query IS NULL 
      OR search_query = ''
      OR l.title ILIKE '%' || search_query || '%'
      OR l.description ILIKE '%' || search_query || '%'
      OR p.business_name ILIKE '%' || search_query || '%'
      OR c.name ILIKE '%' || search_query || '%'
    )
    AND (
      p.location IS NULL
      OR user_lat IS NULL 
      OR user_lon IS NULL
      OR ST_DWithin(p.location, ST_SetSRID(ST_MakePoint(user_lon, user_lat), 4326)::geography, max_distance_km * 1000.0)
    )
  ORDER BY distance_km ASC, p.rating DESC;
$$;

GRANT EXECUTE ON FUNCTION public.nearby_service_listings(double precision, double precision, double precision, uuid, text) TO authenticated, anon;

-- 9. Seed Default Service Categories & Subcategories
INSERT INTO public.service_categories (name, slug, icon, description, sort_order) VALUES
  ('Home Services', 'home-services', 'Wrench', 'Plumbing, electrical, carpentry, painting, cleaning, appliance & AC repair', 1),
  ('Personal Services', 'personal-services', 'Sparkles', 'Barbers, makeup artists, yoga instructors, fitness trainers', 2),
  ('Professional Services', 'professional-services', 'Briefcase', 'Web development, graphic design, content writing, tutoring, accounting', 3),
  ('Event Services', 'event-services', 'Camera', 'Photography, videography, DJs, event decor, catering, hosting', 4)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  description = EXCLUDED.description;

-- Subcategories for Home Services
INSERT INTO public.service_subcategories (category_id, name, slug, description)
SELECT id, 'Plumbing', 'plumbing', 'Water leaks, pipe fittings, drain cleaning'
FROM public.service_categories WHERE slug = 'home-services'
ON CONFLICT (category_id, slug) DO NOTHING;

INSERT INTO public.service_subcategories (category_id, name, slug, description)
SELECT id, 'Electrical', 'electrical', 'Wiring, switchboard repair, light fixtures, MCB'
FROM public.service_categories WHERE slug = 'home-services'
ON CONFLICT (category_id, slug) DO NOTHING;

INSERT INTO public.service_subcategories (category_id, name, slug, description)
SELECT id, 'AC & Appliance Repair', 'ac-appliance', 'AC servicing, gas refill, washing machine, refrigerator'
FROM public.service_categories WHERE slug = 'home-services'
ON CONFLICT (category_id, slug) DO NOTHING;

INSERT INTO public.service_subcategories (category_id, name, slug, description)
SELECT id, 'Carpentry & Furniture', 'carpentry', 'Door repair, locks, custom furniture, woodwork'
FROM public.service_categories WHERE slug = 'home-services'
ON CONFLICT (category_id, slug) DO NOTHING;

INSERT INTO public.service_subcategories (category_id, name, slug, description)
SELECT id, 'Deep Cleaning & Pest Control', 'cleaning', 'Full home cleaning, bathroom scrubbing, pest eradication'
FROM public.service_categories WHERE slug = 'home-services'
ON CONFLICT (category_id, slug) DO NOTHING;

-- Subcategories for Personal Services
INSERT INTO public.service_subcategories (category_id, name, slug, description)
SELECT id, 'Fitness & Yoga', 'fitness-yoga', 'Personal training, yoga sessions at home'
FROM public.service_categories WHERE slug = 'personal-services'
ON CONFLICT (category_id, slug) DO NOTHING;

INSERT INTO public.service_subcategories (category_id, name, slug, description)
SELECT id, 'Beauty & Makeup', 'beauty-makeup', 'Bridal makeup, hairstyling, salon at home'
FROM public.service_categories WHERE slug = 'personal-services'
ON CONFLICT (category_id, slug) DO NOTHING;

-- Subcategories for Professional Services
INSERT INTO public.service_subcategories (category_id, name, slug, description)
SELECT id, 'Tech & Web Development', 'web-dev', 'Websites, mobile apps, bug fixes, IT support'
FROM public.service_categories WHERE slug = 'professional-services'
ON CONFLICT (category_id, slug) DO NOTHING;

INSERT INTO public.service_subcategories (category_id, name, slug, description)
SELECT id, 'Academic Tutoring', 'tutoring', 'Maths, science, languages for K-12 and college'
FROM public.service_categories WHERE slug = 'professional-services'
ON CONFLICT (category_id, slug) DO NOTHING;

-- Subcategories for Event Services
INSERT INTO public.service_subcategories (category_id, name, slug, description)
SELECT id, 'Event Photography', 'event-photo', 'Weddings, birthdays, corporate event shoots'
FROM public.service_categories WHERE slug = 'event-services'
ON CONFLICT (category_id, slug) DO NOTHING;

-- 10. Platform Settings: Default Services Commission (10%)
INSERT INTO public.platform_settings (key, value)
VALUES ('services_commission', '{"percentage": 10.0, "currency": "INR", "min_fee": 25.0}'::jsonb)
ON CONFLICT (key) DO NOTHING;
