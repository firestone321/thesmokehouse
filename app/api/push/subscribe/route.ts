import { after, NextResponse } from "next/server";
import { z } from "zod";
import { hasOrderAccess } from "@/lib/order-access";
import { scheduleDueOrderReadyPushProcessing } from "@/lib/push/order-ready";
import { enforceRateLimit } from "@/lib/rate-limit";
import { isContentLengthTooLarge } from "@/lib/request-limits";
import { getSupabaseAdmin } from "@/lib/supabase";

const pushSubscriptionSchema = z.object({
  orderId: z.coerce.number().int().positive().optional(),
  deviceId: z.string().trim().min(8).max(128).regex(/^[A-Za-z0-9_-]+$/).optional(),
  endpoint: z.string().url(),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string().min(1, "Missing p256dh key."),
    auth: z.string().min(1, "Missing auth key.")
  })
});

function inferPlatform(userAgent: string | null) {
  const value = userAgent?.toLowerCase() ?? "";

  if (value.includes("iphone") || value.includes("ipad") || value.includes("ipod")) return "ios";
  if (value.includes("android")) return "android";
  if (value.includes("windows")) return "windows";
  if (value.includes("mac os") || value.includes("macintosh")) return "macos";
  if (value.includes("linux")) return "linux";

  return "web";
}

function validateSameOriginMutation(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) {
    return null;
  }

  const requestOrigin = new URL(request.url).origin;
  return origin === requestOrigin
    ? null
    : NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
}

async function verifyOrderLink(orderId: number) {
  const { data: order, error: orderError } = await getSupabaseAdmin()
    .from("orders")
    .select("id,public_token,payment_status")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError) {
    return { response: NextResponse.json({ message: "Unable to verify order access." }, { status: 500 }) };
  }

  if (!order) {
    return { response: NextResponse.json({ message: "Order not found." }, { status: 404 }) };
  }

  const orderRow = order as { id: number; public_token: string | null; payment_status: string | null };
  if (orderRow.payment_status !== "paid") {
    return { response: NextResponse.json({ message: "Notifications are available after payment is confirmed." }, { status: 409 }) };
  }

  const hasAccess = await hasOrderAccess({
    orderId: orderRow.id,
    publicToken: orderRow.public_token
  });

  if (!hasAccess) {
    return { response: NextResponse.json({ message: "Missing valid order access session." }, { status: 403 }) };
  }

  return { order: orderRow };
}

export async function POST(request: Request) {
  const originViolation = validateSameOriginMutation(request);
  if (originViolation) {
    return originViolation;
  }

  if (isContentLengthTooLarge(request, 16 * 1024)) {
    return NextResponse.json({ message: "Push subscription payload is too large." }, { status: 413 });
  }

  const routeRateLimit = await enforceRateLimit(request, "push-subscribe", 12, 60_000);
  if (!routeRateLimit.allowed) {
    return NextResponse.json(
      { message: "Too many requests. Please wait and try again." },
      { status: 429, headers: { "Retry-After": String(routeRateLimit.retryAfterSeconds) } }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = pushSubscriptionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "Invalid push subscription payload.",
        issues: parsed.error.flatten()
      },
      { status: 400 }
    );
  }

  let orderRow: { id: number; public_token: string | null; payment_status: string | null } | null = null;
  if (parsed.data.orderId) {
    const orderRateLimit = await enforceRateLimit(request, "push-subscribe-order", 6, 60_000, {
      bucketSuffix: String(parsed.data.orderId)
    });
    if (!orderRateLimit.allowed) {
      return NextResponse.json(
        { message: "Too many requests. Please wait and try again." },
        { status: 429, headers: { "Retry-After": String(orderRateLimit.retryAfterSeconds) } }
      );
    }

    const verified = await verifyOrderLink(parsed.data.orderId);
    if ("response" in verified) {
      return verified.response;
    }
    orderRow = verified.order;
  }

  const now = new Date().toISOString();
  const { data: storedSubscription, error: subscriptionError } = await getSupabaseAdmin()
    .from("push_subscriptions")
    .upsert(
      {
        endpoint: parsed.data.endpoint,
        device_id: parsed.data.deviceId ?? null,
        p256dh: parsed.data.keys.p256dh,
        auth: parsed.data.keys.auth,
        platform: inferPlatform(request.headers.get("user-agent")),
        user_agent: request.headers.get("user-agent"),
        last_seen_at: now,
        updated_at: now
      },
      { onConflict: "endpoint" }
    )
    .select("id")
    .single();

  if (subscriptionError || !storedSubscription) {
    return NextResponse.json({ message: "Unable to save push subscription." }, { status: 500 });
  }

  if (orderRow) {
    const { error: relationError } = await getSupabaseAdmin()
      .from("push_subscription_orders")
      .upsert(
        {
          subscription_id: (storedSubscription as { id: string }).id,
          order_id: orderRow.id
        },
        {
          onConflict: "subscription_id,order_id",
          ignoreDuplicates: true
        }
      );

    if (relationError) {
      return NextResponse.json({ message: "Unable to link push subscription to this order." }, { status: 500 });
    }
  }

  after(async () => {
    await scheduleDueOrderReadyPushProcessing("push_subscribe");
  });

  return NextResponse.json({
    ok: true,
    subscriptionId: (storedSubscription as { id: string }).id
  });
}
