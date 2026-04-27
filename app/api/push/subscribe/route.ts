import { after, NextResponse } from "next/server";
import { z } from "zod";
import { hasOrderAccess } from "@/lib/order-access";
import { scheduleDueOrderReadyPushProcessing } from "@/lib/push/order-ready";
import { getSupabaseAdmin } from "@/lib/supabase";

const pushSubscriptionSchema = z.object({
  orderId: z.coerce.number().int().positive(),
  endpoint: z.string().url(),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string().min(1, "Missing p256dh key."),
    auth: z.string().min(1, "Missing auth key.")
  })
});

type RateEntry = {
  count: number;
  firstSeen: number;
};

const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 12;
const rateMap = new Map<string, RateEntry>();

function inferPlatform(userAgent: string | null) {
  const value = userAgent?.toLowerCase() ?? "";

  if (value.includes("iphone") || value.includes("ipad") || value.includes("ipod")) return "ios";
  if (value.includes("android")) return "android";
  if (value.includes("windows")) return "windows";
  if (value.includes("mac os") || value.includes("macintosh")) return "macos";
  if (value.includes("linux")) return "linux";

  return "web";
}

function getClientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

function isRateLimited(key: string) {
  const now = Date.now();
  const existing = rateMap.get(key);

  if (!existing || now - existing.firstSeen > RATE_WINDOW_MS) {
    rateMap.set(key, { count: 1, firstSeen: now });
    return false;
  }

  existing.count += 1;
  rateMap.set(key, existing);
  return existing.count > RATE_LIMIT;
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

export async function POST(request: Request) {
  const originViolation = validateSameOriginMutation(request);
  if (originViolation) {
    return originViolation;
  }

  const rateKey = `${getClientIp(request)}:push-subscribe`;
  if (isRateLimited(rateKey)) {
    return NextResponse.json(
      { message: "Too many requests. Please wait and try again." },
      { status: 429, headers: { "Retry-After": "60" } }
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

  const { data: order, error: orderError } = await getSupabaseAdmin()
    .from("orders")
    .select("id,public_token,payment_status")
    .eq("id", parsed.data.orderId)
    .maybeSingle();

  if (orderError) {
    return NextResponse.json({ message: "Unable to verify order access." }, { status: 500 });
  }

  if (!order) {
    return NextResponse.json({ message: "Order not found." }, { status: 404 });
  }

  const orderRow = order as { id: number; public_token: string | null; payment_status: string | null };
  if (orderRow.payment_status !== "paid") {
    return NextResponse.json({ message: "Notifications are available after payment is confirmed." }, { status: 409 });
  }

  const hasAccess = await hasOrderAccess({
    orderId: orderRow.id,
    publicToken: orderRow.public_token
  });

  if (!hasAccess) {
    return NextResponse.json({ message: "Missing valid order access session." }, { status: 403 });
  }

  const { data: storedSubscription, error: subscriptionError } = await getSupabaseAdmin()
    .from("push_subscriptions")
    .upsert(
      {
        endpoint: parsed.data.endpoint,
        p256dh: parsed.data.keys.p256dh,
        auth: parsed.data.keys.auth,
        platform: inferPlatform(request.headers.get("user-agent")),
        user_agent: request.headers.get("user-agent")
      },
      { onConflict: "endpoint" }
    )
    .select("id")
    .single();

  if (subscriptionError || !storedSubscription) {
    return NextResponse.json({ message: "Unable to save push subscription." }, { status: 500 });
  }

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

  after(async () => {
    await scheduleDueOrderReadyPushProcessing("push_subscribe");
  });

  return NextResponse.json({
    ok: true,
    subscriptionId: (storedSubscription as { id: string }).id
  });
}
