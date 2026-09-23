import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "./admin.server";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

export type ServiceCategoryItem = {
  id: string;
  name: string;
  slug: string;
  icon: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  subcategories?: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
  }[];
};

export type ServiceListingItem = {
  id: string;
  title: string;
  description: string;
  pricing_type: string;
  base_price: number;
  estimated_duration_mins: number;
  service_area_radius_km: number;
  images: string[];
  is_active: boolean;
  rating: number;
  completed_jobs: number;
  category: {
    id: string;
    name: string;
    slug: string;
    icon: string;
  };
  subcategory?: {
    id: string;
    name: string;
  } | null;
  provider: {
    user_id: string;
    business_name: string;
    rating: number;
    completed_jobs_count: number;
    is_verified_provider: boolean;
    experience_years: number;
    profile?: {
      name: string | null;
      profile_photo_url: string | null;
      phone_verified: boolean;
    } | null;
  };
  distance_km?: number | null;
};

export type ServiceBookingItem = {
  id: string;
  title: string;
  description: string;
  scheduled_date: string;
  scheduled_time_slot: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  budget: number | null;
  notes: string | null;
  photos: string[];
  status: string;
  final_price: number | null;
  commission_amount: number;
  cancellation_reason: string | null;
  completed_at: string | null;
  created_at: string;
  provider: {
    user_id: string;
    business_name: string;
    rating: number;
    is_verified_provider: boolean;
  };
  customer?: {
    id: string;
    name: string | null;
    profile_photo_url: string | null;
  } | null;
  listing?: {
    id: string;
    title: string;
  } | null;
  quotes?: {
    id: string;
    total_amount: number;
    estimated_duration: string;
    itemized_items: { description: string; amount: number }[];
    notes: string | null;
    status: string;
    created_at: string;
  }[];
};

/* ------------------------------------------------------------------ */
/* Discovery & Public APIs                                            */
/* ------------------------------------------------------------------ */

export const listServiceCategories = createServerFn({ method: "GET" }).handler(
  async ({ context }) => {
    // If context doesn't have supabase (unauthenticated call), fall back or fetch
    const supabase = context.supabase;
    if (!supabase) {
      return [];
    }

    const { data: categories, error } = await supabase
      .from("service_categories" as any)
      .select("id, name, slug, icon, description, sort_order, is_active, service_subcategories(id, name, slug, description)")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("Error fetching categories:", error);
      return [];
    }

    return (categories ?? []) as ServiceCategoryItem[];
  },
);

const SearchServicesInput = z.object({
  query: z.string().trim().max(100).optional(),
  categorySlug: z.string().optional(),
  pricingType: z.string().optional(),
  minRating: z.number().min(0).max(5).optional(),
  verifiedOnly: z.boolean().optional(),
  radiusKm: z.number().min(1).max(50).optional(),
  userLat: z.number().optional(),
  userLon: z.number().optional(),
});

export const searchServices = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SearchServicesInput.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    if (!supabase) return [];

    let q = supabase
      .from("service_listings" as any)
      .select(`
        id,
        title,
        description,
        pricing_type,
        base_price,
        estimated_duration_mins,
        service_area_radius_km,
        images,
        is_active,
        rating,
        completed_jobs,
        category:service_categories(id, name, slug, icon),
        subcategory:service_subcategories(id, name),
        provider:service_provider_profiles(
          user_id,
          business_name,
          rating,
          completed_jobs_count,
          is_verified_provider,
          experience_years,
          is_available,
          is_suspended,
          profile:profiles(name, profile_photo_url, phone_verified)
        )
      `)
      .eq("is_active", true);

    if (data.query) {
      q = q.or(`title.ilike.%${data.query}%,description.ilike.%${data.query}%`);
    }

    if (data.pricingType && data.pricingType !== "all") {
      q = q.eq("pricing_type", data.pricingType);
    }

    const { data: rows, error } = await q.limit(50);
    if (error) {
      console.error("Error searching services:", error);
      return [];
    }

    // Filter by category slug if provided
    let results = (rows ?? []) as unknown as ServiceListingItem[];
    if (data.categorySlug && data.categorySlug !== "all") {
      results = results.filter((r) => r.category?.slug === data.categorySlug);
    }

    // Filter verified provider
    if (data.verifiedOnly) {
      results = results.filter((r) => r.provider?.is_verified_provider);
    }

    // Filter minimum rating
    if (data.minRating) {
      results = results.filter((r) => Number(r.rating) >= data.minRating!);
    }

    return results;
  });

export const getServiceDetail = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ serviceId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    if (!supabase) throw new Error("Database client not available");

    const { data: listing, error } = await supabase
      .from("service_listings" as any)
      .select(`
        id,
        title,
        description,
        pricing_type,
        base_price,
        estimated_duration_mins,
        service_area_radius_km,
        images,
        is_active,
        rating,
        completed_jobs,
        category:service_categories(id, name, slug, icon),
        subcategory:service_subcategories(id, name),
        provider:service_provider_profiles(
          user_id,
          business_name,
          bio,
          skills,
          languages,
          portfolio_items,
          certifications,
          working_hours,
          service_radius_km,
          rating,
          completed_jobs_count,
          is_verified_provider,
          experience_years,
          is_available,
          profile:profiles(name, profile_photo_url, phone_verified, phone_number)
        )
      `)
      .eq("id", data.serviceId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!listing) throw new Error("Service not found");

    // Fetch recent reviews for this provider
    const { data: reviews } = await supabase
      .from("service_reviews" as any)
      .select(`
        id,
        rating,
        comment,
        quality_rating,
        punctuality_rating,
        communication_rating,
        value_rating,
        created_at,
        reviewer:profiles(name, profile_photo_url)
      `)
      .eq("provider_id", (listing.provider as unknown as { user_id: string }).user_id)
      .order("created_at", { ascending: false })
      .limit(10);

    return {
      listing: listing as unknown as ServiceListingItem,
      reviews: reviews ?? [],
    };
  });

export const getProviderPublicProfile = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ providerId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    if (!supabase) throw new Error("Database client not available");

    const { data: provider, error } = await supabase
      .from("service_provider_profiles" as any)
      .select(`
        user_id,
        business_name,
        bio,
        skills,
        languages,
        portfolio_items,
        certifications,
        working_hours,
        service_radius_km,
        rating,
        completed_jobs_count,
        is_verified_provider,
        experience_years,
        is_available,
        address,
        profile:profiles(name, profile_photo_url, phone_verified)
      `)
      .eq("user_id", data.providerId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!provider) throw new Error("Provider not found");

    // Fetch provider's active listings
    const { data: listings } = await supabase
      .from("service_listings" as any)
      .select(`
        id,
        title,
        description,
        pricing_type,
        base_price,
        estimated_duration_mins,
        rating,
        completed_jobs,
        category:service_categories(name, slug, icon)
      `)
      .eq("provider_id", data.providerId)
      .eq("is_active", true);

    // Fetch reviews
    const { data: reviews } = await supabase
      .from("service_reviews" as any)
      .select(`
        id,
        rating,
        comment,
        quality_rating,
        punctuality_rating,
        communication_rating,
        value_rating,
        created_at,
        reviewer:profiles(name, profile_photo_url)
      `)
      .eq("provider_id", data.providerId)
      .order("created_at", { ascending: false })
      .limit(20);

    return {
      provider,
      listings: listings ?? [],
      reviews: reviews ?? [],
    };
  });

/* ------------------------------------------------------------------ */
/* Provider Account Management                                        */
/* ------------------------------------------------------------------ */

export const getMyProviderProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile } = await context.supabase
      .from("service_provider_profiles" as any)
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();

    return profile as any;
  });

const SaveProviderProfileInput = z.object({
  businessName: z.string().min(2).max(150),
  bio: z.string().max(2000).optional(),
  experienceYears: z.number().int().min(0).max(60),
  serviceRadiusKm: z.number().min(1).max(50),
  skills: z.array(z.string()).default([]),
  languages: z.array(z.string()).default(["English"]),
  address: z.string().max(500).optional(),
  isAvailable: z.boolean().default(true),
  workingHours: z.record(z.string()).optional(),
});

export const saveProviderProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SaveProviderProfileInput.parse(input))
  .handler(async ({ data, context }) => {
    const payload = {
      user_id: context.userId,
      business_name: data.businessName,
      bio: data.bio ?? "",
      experience_years: data.experienceYears,
      service_radius_km: data.serviceRadiusKm,
      skills: data.skills,
      languages: data.languages,
      address: data.address ?? "",
      is_available: data.isAvailable,
      working_hours: data.workingHours ?? {
        mon: "09:00-18:00",
        tue: "09:00-18:00",
        wed: "09:00-18:00",
        thu: "09:00-18:00",
        fri: "09:00-18:00",
        sat: "10:00-16:00",
        sun: "closed",
      },
    };

    const { data: row, error } = await context.supabase
      .from("service_provider_profiles" as any)
      .upsert(payload)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return row;
  });

/* ------------------------------------------------------------------ */
/* Service Listings Management                                        */
/* ------------------------------------------------------------------ */

export const listMyServiceListings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("service_listings" as any)
      .select(`
        id,
        title,
        description,
        pricing_type,
        base_price,
        estimated_duration_mins,
        service_area_radius_km,
        is_active,
        rating,
        completed_jobs,
        category:service_categories(id, name, slug),
        subcategory:service_subcategories(id, name)
      `)
      .eq("provider_id", context.userId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return (data ?? []) as any;
  });

const SaveListingInput = z.object({
  id: z.string().uuid().optional(),
  categoryId: z.string().uuid(),
  subcategoryId: z.string().uuid().optional(),
  title: z.string().min(5).max(200),
  description: z.string().min(20).max(3000),
  pricingType: z.enum(["fixed", "starting_from", "hourly", "custom_quote"]),
  basePrice: z.number().min(0),
  estimatedDurationMins: z.number().int().min(15).max(1440),
  serviceAreaRadiusKm: z.number().min(1).max(50),
  isActive: z.boolean().default(true),
});

export const saveServiceListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SaveListingInput.parse(input))
  .handler(async ({ data, context }) => {
    // Ensure provider profile exists
    const { data: prov } = await context.supabase
      .from("service_provider_profiles" as any)
      .select("user_id")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (!prov) {
      throw new Error("Please complete your Service Provider Profile before publishing listings.");
    }

    const payload = {
      provider_id: context.userId,
      category_id: data.categoryId,
      subcategory_id: data.subcategoryId ?? null,
      title: data.title,
      description: data.description,
      pricing_type: data.pricingType,
      base_price: data.basePrice,
      estimated_duration_mins: data.estimatedDurationMins,
      service_area_radius_km: data.serviceAreaRadiusKm,
      is_active: data.isActive,
    };

    if (data.id) {
      const { data: updated, error } = await context.supabase
        .from("service_listings" as any)
        .update(payload)
        .eq("id", data.id)
        .eq("provider_id", context.userId)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return updated;
    } else {
      const { data: inserted, error } = await context.supabase
        .from("service_listings" as any)
        .insert(payload)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return inserted;
    }
  });

/* ------------------------------------------------------------------ */
/* Booking Request & Lifecycle                                        */
/* ------------------------------------------------------------------ */

const CreateBookingInput = z.object({
  providerId: z.string().uuid(),
  listingId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  title: z.string().min(5).max(200),
  description: z.string().min(10).max(2000),
  scheduledDate: z.string(), // YYYY-MM-DD
  scheduledTimeSlot: z.string().default("morning"),
  address: z.string().min(5).max(500),
  budget: z.number().optional(),
  notes: z.string().max(1000).optional(),
});

export const requestServiceBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CreateBookingInput.parse(input))
  .handler(async ({ data, context }) => {
    if (data.providerId === context.userId) {
      throw new Error("You cannot request your own service.");
    }

    const { data: booking, error } = await context.supabase
      .from("service_bookings" as any)
      .insert({
        customer_id: context.userId,
        provider_id: data.providerId,
        listing_id: data.listingId ?? null,
        category_id: data.categoryId ?? null,
        title: data.title,
        description: data.description,
        scheduled_date: data.scheduledDate,
        scheduled_time_slot: data.scheduledTimeSlot,
        address: data.address,
        budget: data.budget ?? null,
        notes: data.notes ?? null,
        status: "requested",
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return booking;
  });

export const listCustomerBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("service_bookings" as any)
      .select(`
        id,
        title,
        description,
        scheduled_date,
        scheduled_time_slot,
        address,
        budget,
        notes,
        status,
        final_price,
        commission_amount,
        completed_at,
        created_at,
        provider:service_provider_profiles(
          user_id,
          business_name,
          rating,
          is_verified_provider
        ),
        listing:service_listings(id, title),
        quotes:service_quotes(
          id,
          total_amount,
          estimated_duration,
          itemized_items,
          notes,
          status,
          created_at
        )
      `)
      .eq("customer_id", context.userId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return (data ?? []) as any;
  });

export const listProviderBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("service_bookings" as any)
      .select(`
        id,
        title,
        description,
        scheduled_date,
        scheduled_time_slot,
        address,
        budget,
        notes,
        status,
        final_price,
        commission_amount,
        completed_at,
        created_at,
        customer:profiles(id, name, profile_photo_url, phone_verified),
        listing:service_listings(id, title),
        quotes:service_quotes(
          id,
          total_amount,
          estimated_duration,
          itemized_items,
          notes,
          status,
          created_at
        )
      `)
      .eq("provider_id", context.userId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return (data ?? []) as any;
  });

/* ------------------------------------------------------------------ */
/* Quotation Handling                                                 */
/* ------------------------------------------------------------------ */

const SendQuoteInput = z.object({
  bookingId: z.string().uuid(),
  totalAmount: z.number().min(50),
  estimatedDuration: z.string().default("1-2 hours"),
  itemizedItems: z.array(z.object({ description: z.string(), amount: z.number() })),
  notes: z.string().max(1000).optional(),
});

export const sendQuotation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SendQuoteInput.parse(input))
  .handler(async ({ data, context }) => {
    // Verify booking belongs to provider
    const { data: booking } = await context.supabase
      .from("service_bookings" as any)
      .select("id, provider_id, status")
      .eq("id", data.bookingId)
      .eq("provider_id", context.userId)
      .single();

    if (!booking) throw new Error("Booking not found or unauthorized");

    const { data: quote, error } = await context.supabase
      .from("service_quotes" as any)
      .insert({
        booking_id: data.bookingId,
        provider_id: context.userId,
        total_amount: data.totalAmount,
        estimated_duration: data.estimatedDuration,
        itemized_items: data.itemizedItems,
        notes: data.notes ?? null,
        status: "pending",
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    // Update booking status to quote_sent
    await context.supabase
      .from("service_bookings" as any)
      .update({ status: "quote_sent" })
      .eq("id", data.bookingId);

    return quote;
  });

const RespondQuoteInput = z.object({
  bookingId: z.string().uuid(),
  quoteId: z.string().uuid(),
  action: z.enum(["accept", "reject"]),
});

export const respondToQuotation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RespondQuoteInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: booking } = await context.supabase
      .from("service_bookings" as any)
      .select("id, customer_id, status")
      .eq("id", data.bookingId)
      .eq("customer_id", context.userId)
      .single();

    if (!booking) throw new Error("Booking not found or unauthorized");

    if (data.action === "accept") {
      const { data: quote } = await context.supabase
        .from("service_quotes" as any)
        .select("total_amount")
        .eq("id", data.quoteId)
        .single();

      if (!quote) throw new Error("Quote not found");

      // 10% platform commission
      const commission = Math.round(quote.total_amount * 0.1 * 100) / 100;

      await context.supabase
        .from("service_quotes" as any)
        .update({ status: "accepted" })
        .eq("id", data.quoteId);

      await context.supabase
        .from("service_bookings" as any)
        .update({
          status: "accepted",
          final_price: quote.total_amount,
          commission_amount: commission,
        })
        .eq("id", data.bookingId);
    } else {
      await context.supabase
        .from("service_quotes" as any)
        .update({ status: "rejected" })
        .eq("id", data.quoteId);

      await context.supabase
        .from("service_bookings" as any)
        .update({ status: "provider_review" })
        .eq("id", data.bookingId);
    }

    return { success: true };
  });

/* ------------------------------------------------------------------ */
/* Booking Status Transitions                                         */
/* ------------------------------------------------------------------ */

const TransitionInput = z.object({
  bookingId: z.string().uuid(),
  status: z.enum(["in_progress", "completed", "cancelled"]),
  reason: z.string().optional(),
});

export const updateBookingStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => TransitionInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: booking } = await context.supabase
      .from("service_bookings" as any)
      .select("id, customer_id, provider_id, status, final_price, commission_amount")
      .eq("id", data.bookingId)
      .single();

    if (!booking) throw new Error("Booking not found");

    const isCustomer = booking.customer_id === context.userId;
    const isProvider = booking.provider_id === context.userId;

    if (!isCustomer && !isProvider) throw new Error("Unauthorized");

    const updatePayload: Record<string, unknown> = { status: data.status };

    if (data.status === "completed") {
      updatePayload.completed_at = new Date().toISOString();

      // Increment completed jobs on provider
      const { data: prov } = await context.supabase
        .from("service_provider_profiles" as any)
        .select("completed_jobs_count")
        .eq("user_id", booking.provider_id)
        .single();

      if (prov) {
        await context.supabase
          .from("service_provider_profiles" as any)
          .update({ completed_jobs_count: prov.completed_jobs_count + 1 })
          .eq("user_id", booking.provider_id);
      }
    } else if (data.status === "cancelled") {
      updatePayload.cancellation_reason = data.reason ?? "Cancelled by user";
    }

    const { data: updated, error } = await context.supabase
      .from("service_bookings" as any)
      .update(updatePayload)
      .eq("id", data.bookingId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return updated;
  });

/* ------------------------------------------------------------------ */
/* Reviews & Ratings                                                  */
/* ------------------------------------------------------------------ */

const SubmitReviewInput = z.object({
  bookingId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  qualityRating: z.number().int().min(1).max(5).optional(),
  punctualityRating: z.number().int().min(1).max(5).optional(),
  communicationRating: z.number().int().min(1).max(5).optional(),
  valueRating: z.number().int().min(1).max(5).optional(),
  comment: z.string().max(1000).optional(),
});

export const submitServiceReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SubmitReviewInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: booking } = await context.supabase
      .from("service_bookings" as any)
      .select("id, customer_id, provider_id, status")
      .eq("id", data.bookingId)
      .eq("customer_id", context.userId)
      .single();

    if (!booking) throw new Error("Booking not found");
    if (booking.status !== "completed") throw new Error("Can only review completed services");

    const { data: review, error } = await context.supabase
      .from("service_reviews" as any)
      .insert({
        booking_id: data.bookingId,
        reviewer_id: context.userId,
        provider_id: booking.provider_id,
        rating: data.rating,
        quality_rating: data.qualityRating ?? null,
        punctuality_rating: data.punctualityRating ?? null,
        communication_rating: data.communicationRating ?? null,
        value_rating: data.valueRating ?? null,
        comment: data.comment ?? null,
      })
      .select()
      .single();

    if (error) {
      if (error.message.includes("unique") || error.message.includes("duplicate")) {
        throw new Error("You have already reviewed this service.");
      }
      throw new Error(error.message);
    }

    // Recalculate provider rating
    const { data: allReviews } = await context.supabase
      .from("service_reviews" as any)
      .select("rating")
      .eq("provider_id", booking.provider_id);

    if (allReviews && allReviews.length > 0) {
      const avg = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
      await context.supabase
        .from("service_provider_profiles" as any)
        .update({ rating: Math.round(avg * 100) / 100 })
        .eq("user_id", booking.provider_id);
    }

    return review;
  });

/* ------------------------------------------------------------------ */
/* Admin Management                                                   */
/* ------------------------------------------------------------------ */

export const adminListServicesOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);

    const [catRes, provRes, bookRes] = await Promise.all([
      context.supabase.from("service_categories" as any).select("id", { count: "exact" }),
      context.supabase.from("service_provider_profiles" as any).select("user_id", { count: "exact" }),
      context.supabase.from("service_bookings" as any).select("id", { count: "exact" }),
    ]);

    return {
      categoryCount: catRes.count ?? 0,
      providerCount: provRes.count ?? 0,
      bookingCount: bookRes.count ?? 0,
    };
  });
