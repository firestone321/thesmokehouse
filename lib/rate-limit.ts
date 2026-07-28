import "server-only";

import crypto from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export type StorefrontCheckoutRateLimitResult = {
  route: RateLimitResult;
  phone: RateLimitResult;
};

type EnforceRateLimitOptions = {
  bucketSuffix?: string | null;
};

function hasKnownProxyMarker(request: Request) {
  return Boolean(request.headers.get("cf-ray") || request.headers.get("fly-region") || request.headers.get("x-vercel-id"));
}

function getClientIp(request: Request): string {
  for (const header of ["cf-connecting-ip", "fly-client-ip"]) {
    const value = request.headers.get(header);
    if (value) {
      return value.trim();
    }
  }

  const allowGenericForwardingHeaders = process.env.NODE_ENV !== "production" || hasKnownProxyMarker(request);
  if (allowGenericForwardingHeaders) {
    const realIp = request.headers.get("x-real-ip")?.trim();
    if (realIp) {
      return realIp;
    }

    const forwardedFor = request.headers.get("x-forwarded-for");
    if (forwardedFor) {
      return forwardedFor.split(",")[0]?.trim() || "unknown";
    }
  }

  return "unknown";
}

function buildRateLimitKey(request: Request, key: string, options?: EnforceRateLimitOptions) {
  const clientIp = getClientIp(request);
  const userAgent = request.headers.get("user-agent")?.trim() || "unknown";
  const fingerprint = crypto.createHash("sha256").update(`${clientIp}|${userAgent}`).digest("hex");
  const normalizedBucketSuffix = options?.bucketSuffix?.trim();

  if (!normalizedBucketSuffix) {
    return `${key}:${fingerprint}`;
  }

  const suffixFingerprint = crypto.createHash("sha256").update(`${fingerprint}|${normalizedBucketSuffix}`).digest("hex");
  return `${key}:${suffixFingerprint}`;
}

export async function enforceRateLimit(
  request: Request,
  key: string,
  limit: number,
  windowMs: number,
  options?: EnforceRateLimitOptions
): Promise<RateLimitResult> {
  const bucketKey = buildRateLimitKey(request, key, options);
  const { data, error } = await getSupabaseAdmin().rpc("consume_rate_limit", {
    rate_key: bucketKey,
    max_requests: limit,
    window_seconds: Math.ceil(windowMs / 1000)
  });

  if (error) {
    throw new Error(`Rate limit check failed: ${error.message}`);
  }

  const result = Array.isArray(data) ? data[0] : data;
  if (!result || typeof result !== "object") {
    throw new Error("Rate limit check returned no result.");
  }

  return {
    allowed: Boolean(result.allowed),
    remaining: Number(result.remaining ?? 0),
    retryAfterSeconds: Number(result.retry_after_seconds ?? 1)
  };
}

export async function enforceStorefrontCheckoutRateLimits(
  request: Request,
  phone: string,
  options?: {
    routeLimit?: number;
    phoneLimit?: number;
    windowMs?: number;
  }
): Promise<StorefrontCheckoutRateLimitResult> {
  const routeLimit = options?.routeLimit ?? 8;
  const phoneLimit = options?.phoneLimit ?? 4;
  const windowMs = options?.windowMs ?? 10 * 60 * 1000;
  const { data, error } = await getSupabaseAdmin().rpc("consume_storefront_checkout_rate_limits", {
    p_route_key: buildRateLimitKey(request, "order-create"),
    p_route_max: routeLimit,
    p_phone_key: buildRateLimitKey(request, "order-create-phone", { bucketSuffix: phone }),
    p_phone_max: phoneLimit,
    p_window_seconds: Math.ceil(windowMs / 1000)
  });

  if (error) {
    throw new Error(`Checkout rate limit check failed: ${error.message}`);
  }

  const result = Array.isArray(data) ? data[0] : data;
  if (!result || typeof result !== "object") {
    throw new Error("Checkout rate limit check returned no result.");
  }

  const row = result as Record<string, unknown>;
  return {
    route: {
      allowed: Boolean(row.route_allowed),
      remaining: Number(row.route_remaining ?? 0),
      retryAfterSeconds: Number(row.route_retry_after_seconds ?? 1)
    },
    phone: {
      allowed: Boolean(row.phone_allowed),
      remaining: Number(row.phone_remaining ?? 0),
      retryAfterSeconds: Number(row.phone_retry_after_seconds ?? 1)
    }
  };
}
