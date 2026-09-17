/**
 * Geoapify HTTP client — server only.
 * Shared by every Hoodi module (Help, Skills, and future Rescue / Medic / Jobs).
 */

export type GeoPlace = {
  latitude: number;
  longitude: number;
  formatted_address: string;
  city: string | null;
  state: string | null;
  country: string | null;
  postcode: string | null;
  /** Short, human label such as "Koramangala, Bengaluru". */
  short_label: string;
  place_id?: string;
  /** Business/POI name when the result came from a business search. */
  name?: string | null;
  /** Straight-line metres from the search bias, when known. */
  distance_m?: number | null;
  /** Top-level POI category, e.g. "commercial.florist". */
  category?: string | null;
};

type GeoapifyProps = {
  lat: number;
  lon: number;
  formatted?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  town?: string;
  village?: string;
  suburb?: string;
  district?: string;
  neighbourhood?: string;
  county?: string;
  state?: string;
  country?: string;
  postcode?: string;
  place_id?: string;
};

function apiKey(): string {
  const key = process.env.GEOAPIFY_API_KEY;
  if (!key) throw new Error("Location service is not configured (missing Geoapify API key).");
  return key;
}

function toPlace(p: GeoapifyProps): GeoPlace {
  const city = p.city ?? p.town ?? p.village ?? p.county ?? null;
  const area = p.suburb ?? p.neighbourhood ?? p.district ?? null;
  const short = [area, city].filter(Boolean).join(", ") || p.formatted || p.address_line1 || "";
  return {
    latitude: p.lat,
    longitude: p.lon,
    formatted_address: p.formatted ?? [p.address_line1, p.address_line2].filter(Boolean).join(", "),
    city,
    state: p.state ?? null,
    country: p.country ?? null,
    postcode: p.postcode ?? null,
    short_label: short,
    place_id: p.place_id,
  };
}

async function geoapify(path: string, params: Record<string, string | number>): Promise<GeoapifyProps[]> {
  const url = new URL(`https://api.geoapify.com/v1/geocode/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  url.searchParams.set("format", "json");
  url.searchParams.set("apiKey", apiKey());

  const res = await fetch(url.toString());
  if (!res.ok) {
    console.error("geoapify_error", path, res.status, await res.text().catch(() => ""));
    throw new Error("Could not reach the location service. Please try again.");
  }
  const json = (await res.json()) as { results?: GeoapifyProps[] };
  return json.results ?? [];
}

/**
 * Business / Point-of-Interest search (shops, pharmacies, supermarkets, restaurants…).
 * Distinct from address autocomplete: this hits the Geoapify Places API and always
 * returns named businesses near the given bias point.
 */
const BUSINESS_CATEGORIES = [
  "commercial",
  "catering",
  "healthcare.pharmacy",
  "healthcare.hospital",
  "healthcare.clinic_or_praxis",
  "service",
  "activity",
  "rental",
  "office",
] as const;

/** Narrow the search when the text obviously names a kind of shop. */
function categoriesForQuery(text: string): string {
  const t = text.toLowerCase();
  if (/flower|florist|bouquet|gift/.test(t)) return "commercial.florist,commercial.gift_and_souvenir";
  if (/pharmac|medic|chemist|drug|apollo|clinic|hospital/.test(t))
    return "healthcare.pharmacy,healthcare.clinic_or_praxis,healthcare.hospital";
  if (/grocer|supermarket|fresh|kirana|provision|vegetable|fruit/.test(t))
    return "commercial.supermarket,commercial.food_and_drink,commercial.marketplace";
  if (/restaurant|food|cafe|bakery|hotel|biryani|pizza/.test(t)) return "catering";
  if (/electronic|mobile|laptop|hardware|appliance/.test(t))
    return "commercial.elektronics,commercial.houseware_and_hardware";
  if (/book|stationer/.test(t)) return "commercial.books,commercial.stationery";
  if (/cloth|fashion|apparel|shoe/.test(t)) return "commercial.clothing";
  return BUSINESS_CATEGORIES.join(",");
}

type GeoapifyPlace = GeoapifyProps & {
  name?: string;
  distance?: number;
  categories?: string[];
};

export async function searchBusinesses(
  text: string,
  near: { lat: number; lng: number },
  radiusM = 15000,
): Promise<GeoPlace[]> {
  const url = new URL("https://api.geoapify.com/v2/places");
  url.searchParams.set("categories", categoriesForQuery(text));
  url.searchParams.set("filter", `circle:${near.lng},${near.lat},${Math.min(radiusM, 50000)}`);
  url.searchParams.set("bias", `proximity:${near.lng},${near.lat}`);
  url.searchParams.set("name", text);
  url.searchParams.set("limit", "12");
  url.searchParams.set("apiKey", apiKey());

  let res = await fetch(url.toString());
  if (res.status === 400) {
    // Unsupported category for this query — retry with the broad business set.
    console.error("geoapify_places_category_rejected", await res.text().catch(() => ""));
    url.searchParams.set("categories", BUSINESS_CATEGORIES.join(","));
    res = await fetch(url.toString());
  }
  if (!res.ok) {
    console.error("geoapify_places_error", res.status, await res.text().catch(() => ""));
    throw new Error("Could not reach the business search service. Please try again.");
  }
  const json = (await res.json()) as { features?: { properties: GeoapifyPlace }[] };
  const places = (json.features ?? []).map((f) => f.properties);
  return places
    .filter((p) => Boolean(p.name))
    .map((p) => {
      const base = toPlace(p);
      return {
        ...base,
        name: p.name ?? null,
        distance_m: p.distance ?? null,
        category: p.categories?.[0] ?? null,
        short_label: p.name ?? base.short_label,
      };
    });
}

export async function reverseGeocode(lat: number, lng: number): Promise<GeoPlace | null> {
  const results = await geoapify("reverse", { lat, lon: lng, limit: 1 });
  const first = results[0];
  if (!first) return null;
  // Trust the coordinates the caller gave us — the pin is exactly where the user put it.
  return { ...toPlace(first), latitude: lat, longitude: lng };
}

export async function autocompletePlaces(
  text: string,
  bias?: { lat: number; lng: number },
): Promise<GeoPlace[]> {
  const params: Record<string, string | number> = { text, limit: 6 };
  if (bias) params.bias = `proximity:${bias.lng},${bias.lat}`;
  const results = await geoapify("autocomplete", params);
  return results.map(toPlace);
}