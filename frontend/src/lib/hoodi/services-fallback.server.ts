import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type {
  ServiceCategoryItem,
  ServiceListingItem,
  ServiceBookingItem,
} from "./services.functions";

export interface FallbackProviderProfile {
  user_id: string;
  business_name: string;
  bio: string;
  experience_years: number;
  service_radius_km: number;
  skills: string[];
  languages: string[];
  address?: string;
  is_available: boolean;
  is_verified_provider: boolean;
  is_suspended: boolean;
  rating: number;
  completed_jobs_count: number;
  working_hours?: Record<string, string>;
  created_at: string;
  updated_at: string;
  profile?: {
    name: string | null;
    profile_photo_url: string | null;
    phone_verified: boolean;
  } | null;
}

export interface FallbackListing {
  id: string;
  provider_id: string;
  category_id: string;
  subcategory_id?: string | null;
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
  created_at: string;
  updated_at: string;
}

export interface FallbackBooking {
  id: string;
  customer_id: string;
  provider_id: string;
  listing_id?: string | null;
  category_id?: string | null;
  title: string;
  description: string;
  scheduled_date: string;
  scheduled_time_slot: string;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  budget?: number | null;
  notes?: string | null;
  photos: string[];
  status: string;
  final_price?: number | null;
  commission_amount: number;
  cancellation_reason?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface FallbackQuote {
  id: string;
  booking_id: string;
  provider_id: string;
  total_amount: number;
  estimated_duration: string;
  itemized_items: { description: string; amount: number }[];
  notes?: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface FallbackReview {
  id: string;
  booking_id: string;
  reviewer_id: string;
  provider_id: string;
  rating: number;
  quality_rating?: number | null;
  punctuality_rating?: number | null;
  communication_rating?: number | null;
  value_rating?: number | null;
  comment?: string | null;
  created_at: string;
}

interface FallbackData {
  categories: ServiceCategoryItem[];
  providers: Record<string, FallbackProviderProfile>;
  listings: Record<string, FallbackListing>;
  bookings: Record<string, FallbackBooking>;
  quotes: Record<string, FallbackQuote>;
  reviews: Record<string, FallbackReview>;
}

const DEFAULT_CATEGORIES: ServiceCategoryItem[] = [
  {
    id: "091ecb3b-cc6d-4357-bcf5-380e10c83f10",
    name: "Home Services",
    slug: "home-services",
    icon: "Wrench",
    description: "Plumbing, electrical, AC repair, cleaning, carpentry",
    sort_order: 1,
    is_active: true,
    subcategories: [
      { id: "e1000001-0000-0000-0000-000000000001", name: "Electrical Repair & Wiring", slug: "electrical", description: "Wiring, switchboard, tripping fixes" },
      { id: "e1000001-0000-0000-0000-000000000002", name: "Plumbing & Leakages", slug: "plumbing", description: "Tap fixes, pipe leaks, drain unclogging" },
      { id: "e1000001-0000-0000-0000-000000000003", name: "AC Service & Repair", slug: "ac-repair", description: "Filter clean, gas refill, installation" },
      { id: "e1000001-0000-0000-0000-000000000004", name: "Deep Home Cleaning", slug: "cleaning", description: "Kitchen, bathroom, sofa & carpet cleaning" },
      { id: "e1000001-0000-0000-0000-000000000005", name: "Carpentry & Furniture", slug: "carpentry", description: "Door alignment, lock installation, shelf setup" },
    ],
  },
  {
    id: "c7464211-063d-4647-80d2-629f7603866c",
    name: "Personal Services",
    slug: "personal-services",
    icon: "Sparkles",
    description: "Barbers, makeup artists, yoga instructors, fitness trainers",
    sort_order: 2,
    is_active: true,
    subcategories: [
      { id: "e2000002-0000-0000-0000-000000000001", name: "Haircut & Grooming at Home", slug: "haircut", description: "Men and women salon services" },
      { id: "e2000002-0000-0000-0000-000000000002", name: "Yoga & Mindfulness Coach", slug: "yoga", description: "1-on-1 private home sessions" },
      { id: "e2000002-0000-0000-0000-000000000003", name: "Personal Fitness Trainer", slug: "fitness", description: "Strength, fat loss, functional conditioning" },
    ],
  },
  {
    id: "be155c8b-db80-4c6a-9d0c-3d88c77ef982",
    name: "Professional Services",
    slug: "professional-services",
    icon: "Briefcase",
    description: "Web dev, graphic design, content writing, tutoring",
    sort_order: 3,
    is_active: true,
    subcategories: [
      { id: "e3000003-0000-0000-0000-000000000001", name: "Web & Mobile Development", slug: "web-dev", description: "Custom sites, bug fixing, app setup" },
      { id: "e3000003-0000-0000-0000-000000000002", name: "Graphic Design & Branding", slug: "graphic-design", description: "Logos, banners, social media kits" },
      { id: "e3000003-0000-0000-0000-000000000003", name: "Academic Tutoring & Test Prep", slug: "tutoring", description: "Math, Science, English for K-12" },
    ],
  },
  {
    id: "d6a5f606-b347-4824-bf88-94c15f5d2cca",
    name: "Event Services",
    slug: "event-services",
    icon: "Camera",
    description: "Event photography, videography, decoration, catering",
    sort_order: 4,
    is_active: true,
    subcategories: [
      { id: "e4000004-0000-0000-0000-000000000001", name: "Event Photography", slug: "photography", description: "Birthdays, ceremonies, corporate events" },
      { id: "e4000004-0000-0000-0000-000000000002", name: "Balloon & Floral Decoration", slug: "decoration", description: "Party decor setup and tear down" },
    ],
  },
];

class FallbackServicesStore {
  private dataFilePath: string;
  private memoryData: FallbackData;

  constructor() {
    const primaryDir = path.resolve(process.cwd(), "..", "scratch");
    const fallbackDir = path.resolve(process.cwd(), "scratch");
    const targetDir = fs.existsSync(primaryDir) ? primaryDir : fallbackDir;
    if (!fs.existsSync(targetDir)) {
      try {
        fs.mkdirSync(targetDir, { recursive: true });
      } catch {
        // ignore
      }
    }
    this.dataFilePath = path.join(targetDir, "services_fallback_data.json");
    this.memoryData = this.loadFromDisk();
  }

  private loadFromDisk(): FallbackData {
    try {
      if (fs.existsSync(this.dataFilePath)) {
        const raw = fs.readFileSync(this.dataFilePath, "utf-8");
        const parsed = JSON.parse(raw);
        return {
          categories: parsed.categories?.length ? parsed.categories : DEFAULT_CATEGORIES,
          providers: parsed.providers || {},
          listings: parsed.listings || {},
          bookings: parsed.bookings || {},
          quotes: parsed.quotes || {},
          reviews: parsed.reviews || {},
        };
      }
    } catch (err) {
      console.warn("[FallbackServicesStore] Failed to read disk file, using defaults:", err);
    }

    return {
      categories: DEFAULT_CATEGORIES,
      providers: {},
      listings: {},
      bookings: {},
      quotes: {},
      reviews: {},
    };
  }

  private saveToDisk(): void {
    try {
      const dir = path.dirname(this.dataFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.dataFilePath, JSON.stringify(this.memoryData, null, 2), "utf-8");
    } catch (err) {
      console.warn("[FallbackServicesStore] Failed to write disk file:", err);
    }
  }

  /* ---------------- Categories ---------------- */
  public getCategories(): ServiceCategoryItem[] {
    return this.memoryData.categories;
  }

  /* ---------------- Provider Profile ---------------- */
  public getProviderProfile(userId: string): FallbackProviderProfile | null {
    return this.memoryData.providers[userId] || null;
  }

  public saveProviderProfile(payload: {
    user_id: string;
    business_name: string;
    bio?: string;
    experience_years: number;
    service_radius_km: number;
    skills: string[];
    languages: string[];
    address?: string;
    is_available?: boolean;
    working_hours?: Record<string, string>;
  }): FallbackProviderProfile {
    const existing = this.memoryData.providers[payload.user_id];
    const now = new Date().toISOString();

    const profile: FallbackProviderProfile = {
      user_id: payload.user_id,
      business_name: payload.business_name,
      bio: payload.bio || "",
      experience_years: payload.experience_years,
      service_radius_km: payload.service_radius_km,
      skills: payload.skills || [],
      languages: payload.languages || ["English", "Hindi"],
      address: payload.address || "",
      is_available: payload.is_available ?? true,
      is_verified_provider: existing ? existing.is_verified_provider : true,
      is_suspended: existing ? existing.is_suspended : false,
      rating: existing ? existing.rating : 5.0,
      completed_jobs_count: existing ? existing.completed_jobs_count : 0,
      working_hours: payload.working_hours || existing?.working_hours || {
        mon: "09:00-18:00",
        tue: "09:00-18:00",
        wed: "09:00-18:00",
        thu: "09:00-18:00",
        fri: "09:00-18:00",
        sat: "10:00-16:00",
        sun: "closed",
      },
      created_at: existing ? existing.created_at : now,
      updated_at: now,
      profile: {
        name: payload.business_name,
        profile_photo_url: null,
        phone_verified: true,
      },
    };

    this.memoryData.providers[payload.user_id] = profile;
    this.saveToDisk();
    return profile;
  }

  public getProviderPublicProfile(providerId: string) {
    const provider = this.memoryData.providers[providerId];
    if (!provider) throw new Error("Provider not found");

    const listings = Object.values(this.memoryData.listings)
      .filter((l) => l.provider_id === providerId && l.is_active)
      .map((l) => {
        const cat = this.memoryData.categories.find((c) => c.id === l.category_id);
        return {
          id: l.id,
          title: l.title,
          description: l.description,
          pricing_type: l.pricing_type,
          base_price: l.base_price,
          estimated_duration_mins: l.estimated_duration_mins,
          rating: l.rating,
          completed_jobs: l.completed_jobs,
          category: {
            name: cat?.name || "Services",
            slug: cat?.slug || "services",
            icon: cat?.icon || "Wrench",
          },
        };
      });

    const reviews = Object.values(this.memoryData.reviews)
      .filter((r) => r.provider_id === providerId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        quality_rating: r.quality_rating,
        punctuality_rating: r.punctuality_rating,
        communication_rating: r.communication_rating,
        value_rating: r.value_rating,
        created_at: r.created_at,
        reviewer: { name: "Neighbor", profile_photo_url: null },
      }));

    return { provider, listings, reviews };
  }

  /* ---------------- Listings ---------------- */
  public listListingsByProvider(providerId: string): FallbackListing[] {
    return Object.values(this.memoryData.listings).filter((l) => l.provider_id === providerId);
  }

  public saveListing(providerId: string, payload: any): FallbackListing {
    const now = new Date().toISOString();
    const id = payload.id || crypto.randomUUID();
    const existing = this.memoryData.listings[id];

    const listing: FallbackListing = {
      id,
      provider_id: providerId,
      category_id: payload.categoryId,
      subcategory_id: payload.subcategoryId || null,
      title: payload.title,
      description: payload.description,
      pricing_type: payload.pricingType,
      base_price: payload.basePrice,
      estimated_duration_mins: payload.estimatedDurationMins,
      service_area_radius_km: payload.serviceAreaRadiusKm,
      images: existing?.images || [],
      is_active: payload.isActive ?? true,
      rating: existing?.rating || 5.0,
      completed_jobs: existing?.completed_jobs || 0,
      created_at: existing ? existing.created_at : now,
      updated_at: now,
    };

    this.memoryData.listings[id] = listing;
    this.saveToDisk();
    return listing;
  }

  public searchServices(params: any): ServiceListingItem[] {
    const items = Object.values(this.memoryData.listings)
      .filter((l) => l.is_active)
      .map((l) => {
        const cat = this.memoryData.categories.find((c) => c.id === l.category_id);
        const subcat = cat?.subcategories?.find((s) => s.id === l.subcategory_id);
        const provider = this.memoryData.providers[l.provider_id];

        return {
          id: l.id,
          title: l.title,
          description: l.description,
          pricing_type: l.pricing_type,
          base_price: l.base_price,
          estimated_duration_mins: l.estimated_duration_mins,
          service_area_radius_km: l.service_area_radius_km,
          images: l.images || [],
          is_active: l.is_active,
          rating: l.rating,
          completed_jobs: l.completed_jobs,
          category: {
            id: cat?.id || "default",
            name: cat?.name || "Home Services",
            slug: cat?.slug || "home-services",
            icon: cat?.icon || "Wrench",
          },
          subcategory: subcat ? { id: subcat.id, name: subcat.name } : null,
          provider: {
            user_id: provider?.user_id || l.provider_id,
            business_name: provider?.business_name || "Verified Local Provider",
            rating: provider?.rating || 5.0,
            completed_jobs_count: provider?.completed_jobs_count || 0,
            is_verified_provider: provider?.is_verified_provider ?? true,
            experience_years: provider?.experience_years || 3,
            profile: provider?.profile || {
              name: provider?.business_name || "Provider",
              profile_photo_url: null,
              phone_verified: true,
            },
          },
        } as ServiceListingItem;
      });

    let results = items;
    if (params.query) {
      const q = params.query.toLowerCase();
      results = results.filter((r) => r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q));
    }
    if (params.categorySlug && params.categorySlug !== "all") {
      results = results.filter((r) => r.category.slug === params.categorySlug);
    }
    if (params.pricingType && params.pricingType !== "all") {
      results = results.filter((r) => r.pricing_type === params.pricingType);
    }
    if (params.minRating) {
      results = results.filter((r) => r.rating >= params.minRating);
    }

    return results;
  }

  public getServiceDetail(serviceId: string) {
    const listing = this.memoryData.listings[serviceId];
    if (!listing) throw new Error("Service not found");

    const cat = this.memoryData.categories.find((c) => c.id === listing.category_id);
    const subcat = cat?.subcategories?.find((s) => s.id === listing.subcategory_id);
    const provider = this.memoryData.providers[listing.provider_id];

    const listingItem: ServiceListingItem = {
      id: listing.id,
      title: listing.title,
      description: listing.description,
      pricing_type: listing.pricing_type,
      base_price: listing.base_price,
      estimated_duration_mins: listing.estimated_duration_mins,
      service_area_radius_km: listing.service_area_radius_km,
      images: listing.images || [],
      is_active: listing.is_active,
      rating: listing.rating,
      completed_jobs: listing.completed_jobs,
      category: {
        id: cat?.id || "default",
        name: cat?.name || "Services",
        slug: cat?.slug || "services",
        icon: cat?.icon || "Wrench",
      },
      subcategory: subcat ? { id: subcat.id, name: subcat.name } : null,
      provider: {
        user_id: provider?.user_id || listing.provider_id,
        business_name: provider?.business_name || "Verified Local Provider",
        rating: provider?.rating || 5.0,
        completed_jobs_count: provider?.completed_jobs_count || 0,
        is_verified_provider: provider?.is_verified_provider ?? true,
        experience_years: provider?.experience_years || 3,
        profile: provider?.profile || {
          name: provider?.business_name || "Provider",
          profile_photo_url: null,
          phone_verified: true,
        },
      },
    };

    const reviews = Object.values(this.memoryData.reviews)
      .filter((r) => r.provider_id === listing.provider_id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        quality_rating: r.quality_rating,
        punctuality_rating: r.punctuality_rating,
        communication_rating: r.communication_rating,
        value_rating: r.value_rating,
        created_at: r.created_at,
        reviewer: { name: "Neighbor", profile_photo_url: null },
      }));

    return { listing: listingItem, reviews };
  }

  /* ---------------- Bookings & Quotes ---------------- */
  public requestBooking(customerId: string, payload: any): FallbackBooking {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const booking: FallbackBooking = {
      id,
      customer_id: customerId,
      provider_id: payload.providerId,
      listing_id: payload.listingId || null,
      category_id: payload.categoryId || null,
      title: payload.title,
      description: payload.description,
      scheduled_date: payload.scheduledDate,
      scheduled_time_slot: payload.scheduledTimeSlot || "morning",
      address: payload.address,
      budget: payload.budget || null,
      notes: payload.notes || null,
      photos: [],
      status: "requested",
      final_price: null,
      commission_amount: 0,
      cancellation_reason: null,
      completed_at: null,
      created_at: now,
      updated_at: now,
    };

    this.memoryData.bookings[id] = booking;
    this.saveToDisk();
    return booking;
  }

  public listCustomerBookings(customerId: string): ServiceBookingItem[] {
    return Object.values(this.memoryData.bookings)
      .filter((b) => b.customer_id === customerId)
      .map((b) => this.formatBookingItem(b));
  }

  public listProviderBookings(providerId: string): ServiceBookingItem[] {
    return Object.values(this.memoryData.bookings)
      .filter((b) => b.provider_id === providerId)
      .map((b) => this.formatBookingItem(b));
  }

  private formatBookingItem(b: FallbackBooking): ServiceBookingItem {
    const provider = this.memoryData.providers[b.provider_id];
    const listing = b.listing_id ? this.memoryData.listings[b.listing_id] : null;
    const quotes = Object.values(this.memoryData.quotes).filter((q) => q.booking_id === b.id);

    return {
      id: b.id,
      title: b.title,
      description: b.description,
      scheduled_date: b.scheduled_date,
      scheduled_time_slot: b.scheduled_time_slot,
      address: b.address,
      latitude: b.latitude ?? null,
      longitude: b.longitude ?? null,
      budget: b.budget ?? null,
      notes: b.notes ?? null,
      photos: b.photos || [],
      status: b.status,
      final_price: b.final_price ?? null,
      commission_amount: b.commission_amount || 0,
      cancellation_reason: b.cancellation_reason ?? null,
      completed_at: b.completed_at ?? null,
      created_at: b.created_at,
      provider: {
        user_id: b.provider_id,
        business_name: provider?.business_name || "Provider",
        rating: provider?.rating || 5.0,
        is_verified_provider: provider?.is_verified_provider ?? true,
      },
      customer: {
        id: b.customer_id,
        name: "Neighbor",
        profile_photo_url: null,
      },
      listing: listing ? { id: listing.id, title: listing.title } : null,
      quotes: quotes.map((q) => ({
        id: q.id,
        total_amount: q.total_amount,
        estimated_duration: q.estimated_duration,
        itemized_items: q.itemized_items,
        notes: q.notes ?? null,
        status: q.status,
        created_at: q.created_at,
      })),
    };
  }

  public sendQuotation(providerId: string, payload: any): FallbackQuote {
    const booking = this.memoryData.bookings[payload.bookingId];
    if (!booking) throw new Error("Booking not found");

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const quote: FallbackQuote = {
      id,
      booking_id: payload.bookingId,
      provider_id: providerId,
      total_amount: payload.totalAmount,
      estimated_duration: payload.estimatedDuration,
      itemized_items: payload.itemizedItems,
      notes: payload.notes || null,
      status: "pending",
      created_at: now,
      updated_at: now,
    };

    this.memoryData.quotes[id] = quote;
    booking.status = "quote_sent";
    booking.updated_at = now;

    this.saveToDisk();
    return quote;
  }

  public respondToQuotation(customerId: string, bookingId: string, quoteId: string, action: "accept" | "reject") {
    const booking = this.memoryData.bookings[bookingId];
    if (!booking) throw new Error("Booking not found");
    const quote = this.memoryData.quotes[quoteId];
    if (!quote) throw new Error("Quote not found");

    const now = new Date().toISOString();
    if (action === "accept") {
      quote.status = "accepted";
      booking.status = "accepted";
      booking.final_price = quote.total_amount;
      booking.commission_amount = Math.round(quote.total_amount * 0.1 * 100) / 100;
    } else {
      quote.status = "rejected";
      booking.status = "provider_review";
    }
    booking.updated_at = now;
    quote.updated_at = now;

    this.saveToDisk();
    return { success: true };
  }

  public updateBookingStatus(userId: string, bookingId: string, status: string, reason?: string) {
    const booking = this.memoryData.bookings[bookingId];
    if (!booking) throw new Error("Booking not found");

    const now = new Date().toISOString();
    booking.status = status;
    booking.updated_at = now;

    if (status === "completed") {
      booking.completed_at = now;
      const prov = this.memoryData.providers[booking.provider_id];
      if (prov) {
        prov.completed_jobs_count = (prov.completed_jobs_count || 0) + 1;
      }
    } else if (status === "cancelled") {
      booking.cancellation_reason = reason || "Cancelled by user";
    }

    this.saveToDisk();
    return booking;
  }

  public submitReview(reviewerId: string, payload: any): FallbackReview {
    const booking = this.memoryData.bookings[payload.bookingId];
    if (!booking) throw new Error("Booking not found");

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const review: FallbackReview = {
      id,
      booking_id: payload.bookingId,
      reviewer_id: reviewerId,
      provider_id: booking.provider_id,
      rating: payload.rating,
      quality_rating: payload.qualityRating ?? null,
      punctuality_rating: payload.punctualityRating ?? null,
      communication_rating: payload.communicationRating ?? null,
      value_rating: payload.valueRating ?? null,
      comment: payload.comment || null,
      created_at: now,
    };

    this.memoryData.reviews[id] = review;

    // Recalculate provider rating
    const provReviews = Object.values(this.memoryData.reviews).filter((r) => r.provider_id === booking.provider_id);
    const avg = provReviews.reduce((sum, r) => sum + r.rating, 0) / provReviews.length;
    const prov = this.memoryData.providers[booking.provider_id];
    if (prov) {
      prov.rating = Math.round(avg * 100) / 100;
    }

    this.saveToDisk();
    return review;
  }

  public getAdminOverview() {
    return {
      categoryCount: this.memoryData.categories.length,
      providerCount: Object.keys(this.memoryData.providers).length,
      bookingCount: Object.keys(this.memoryData.bookings).length,
    };
  }
}

export const fallbackServicesStore = new FallbackServicesStore();

export function isTableNotFoundError(error: any): boolean {
  if (!error) return false;
  const msg = typeof error === "string" ? error : error.message || "";
  const code = error.code || "";
  return (
    code === "PGRST205" ||
    code === "42P01" ||
    msg.includes("Could not find the table") ||
    msg.includes("schema cache") ||
    msg.includes("does not exist") ||
    (msg.includes("relation") && msg.includes("does not exist"))
  );
}
