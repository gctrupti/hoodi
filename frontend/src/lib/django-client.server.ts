/**
 * Django REST Framework Authoritative API Client (Server-Side)
 * Connects TanStack Start Server Functions directly to the Django Service Tier
 * in accordance with ADR-001 (Authoritative Business Tier).
 */

export class DjangoApiError extends Error {
  statusCode: number;
  code?: string;
  details?: unknown;

  constructor(message: string, statusCode: number, code?: string, details?: unknown) {
    super(message);
    this.name = "DjangoApiError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export interface DjangoRequestOptions extends RequestInit {
  token?: string;
  params?: Record<string, string | number | boolean | undefined>;
}

const DJANGO_API_BASE_URL =
  process.env.DJANGO_API_URL || process.env.VITE_DJANGO_API_URL || "http://127.0.0.1:8000/api";

export async function djangoRequest<T>(
  endpoint: string,
  options: DjangoRequestOptions = {}
): Promise<T> {
  const { token, params, headers, ...rest } = options;

  let url = `${DJANGO_API_BASE_URL.replace(/\/+$/, "")}/${endpoint.replace(/^\/+/, "")}`;

  if (params) {
    const query = new URLSearchParams();
    for (const [key, val] of Object.entries(params)) {
      if (val !== undefined && val !== null) {
        query.set(key, String(val));
      }
    }
    const qs = query.toString();
    if (qs) {
      url += (url.includes("?") ? "&" : "?") + qs;
    }
  }

  const reqHeaders = new Headers(headers);
  if (!reqHeaders.has("Accept")) {
    reqHeaders.set("Accept", "application/json");
  }
  if (!reqHeaders.has("Content-Type") && rest.body && typeof rest.body === "string") {
    reqHeaders.set("Content-Type", "application/json");
  }
  if (token) {
    reqHeaders.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...rest,
    headers: reqHeaders,
  });

  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const errMsg =
      (typeof data === "object" && data !== null && (data.error || data.detail || data.message)) ||
      `Django API returned status ${response.status}`;
    const errCode = (typeof data === "object" && data !== null && data.code) || undefined;
    throw new DjangoApiError(errMsg, response.status, errCode, data);
  }

  return data as T;
}

/**
 * Domain-specific REST endpoints on Django
 */
export const djangoHelpApi = {
  getNearby(
    params: { latitude: number; longitude: number; radius?: number; category?: string; urgency?: string },
    token?: string
  ) {
    return djangoRequest<Array<Record<string, unknown>>>("help/nearby/", {
      method: "GET",
      params,
      token,
    });
  },

  acceptTask(requestId: string, token: string) {
    return djangoRequest<Record<string, unknown>>(`help/${requestId}/accept/`, {
      method: "POST",
      token,
    });
  },

  updateStatus(requestId: string, status: "in_progress" | "completed" | "cancelled", token: string) {
    return djangoRequest<Record<string, unknown>>(`help/${requestId}/status/`, {
      method: "POST",
      body: JSON.stringify({ status }),
      token,
    });
  },
};

export const djangoSkillsApi = {
  createBooking(
    payload: { offering: string; booking_date: string; start_time: string },
    token: string
  ) {
    return djangoRequest<Record<string, unknown>>("skills/bookings/", {
      method: "POST",
      body: JSON.stringify(payload),
      token,
    });
  },

  updateBookingStatus(
    bookingId: string,
    status: "confirmed" | "completed" | "cancelled",
    token: string
  ) {
    return djangoRequest<Record<string, unknown>>(`skills/bookings/${bookingId}/`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
      token,
    });
  },
};

export const djangoPaymentsApi = {
  simulateSettlement(
    payload: { recipient_user: string; total_amount: number; category?: string; task_id?: string },
    token: string
  ) {
    return djangoRequest<Record<string, unknown>>("payments/simulate/", {
      method: "POST",
      body: JSON.stringify(payload),
      token,
    });
  },
};
