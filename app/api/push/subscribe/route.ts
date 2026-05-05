import { after, NextResponse } from "next/server";
import { z } from "zod";
import { ensureGuestDeviceSession } from "@/lib/guest-device";
import { clearOrderAccessCookie, resolveOrderReadAccess } from "@/lib/order-access";
import { scheduleDueOrderReadyPushProcessing } from "@/lib/push/order-ready";
import { enforceRateLimit } from "@/lib/rate-limit";
import { isContentLengthTooLarge } from "@/lib/request-limits";
import { getSupabaseAdmin } from "@/lib/supabase";

const pushSubscriptionSchema = z.object({
  orderId: z.coerce.number().int().positive().optional(),
  deviceId: z.string().trim().min(8).max(128).regex(/^[A-Za-z0-9_-]+$/).optional(),
  vapidPublicKey: z.string().trim().min(1).optional(),
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

function getRuntimeVapidPublicKey() {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ?? "";
}

async function verifyOrderLink(orderId: number) {
  const { data: order, error: orderError } = await getSupabaseAdmin()
    .from("orders")
    .select("id,public_token,payment_status,device_id,status,completed_at,cancelled_at")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError) {
    return { response: NextResponse.json({ message: "Unable to verify order access." }, { status: 500 }) };
  }

  if (!order) {
    return { response: NextResponse.json({ message: "Order not found." }, { status: 404 }) };
  }

  const orderRow = order as {
    id: number;
    public_token: string | null;
    payment_status: string | null;
    device_id: string | null;
    status: string;
    completed_at: string | null;
    cancelled_at: string | null;
  };
  if (orderRow.payment_status !== "paid") {
    return { response: NextResponse.json({ message: "Notifications are available after payment is confirmed." }, { status: 409 }) };
  }

  const access = await resolveOrderReadAccess(orderRow);

  if (!access.allowed) {
    if (access.clearOrderAccessCookie) {
      await clearOrderAccessCookie();
    }
    return { response: NextResponse.json({ message: access.message }, { status: access.status }) };
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

  const runtimeVapidPublicKey = getRuntimeVapidPublicKey();
  if (!runtimeVapidPublicKey) {
    return NextResponse.json(
      { message: "Push notifications are not configured yet." },
      { status: 503 }
    );
  }

  if (!parsed.data.vapidPublicKey || parsed.data.vapidPublicKey !== runtimeVapidPublicKey) {
    return NextResponse.json(
      {
        message: "Your app has an older notification key. Refresh Smokehouse, then enable notifications again."
      },
      { status: 409 }
    );
  }

  let orderRow:
    | {
        id: number;
        public_token: string | null;
        payment_status: string | null;
        device_id: string | null;
      }
    | null = null;
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

  const guestDevice = await ensureGuestDeviceSession();
  const deviceId = guestDevice.deviceId;
  if (!deviceId) {
    return NextResponse.json({ message: "Missing device identifier." }, { status: 400 });
  }

  if (orderRow && orderRow.device_id !== deviceId) {
    const { error: updateError } = await getSupabaseAdmin()
      .from("orders")
      .update({ device_id: deviceId })
      .eq("id", orderRow.id);

    if (updateError) {
      return NextResponse.json({ message: "Unable to save order device reference." }, { status: 500 });
    }
  }

  const now = new Date().toISOString();
  const { data: storedSubscription, error: subscriptionError } = await getSupabaseAdmin()
    .from("push_subscriptions")
    .upsert(
      {
        endpoint: parsed.data.endpoint,
        device_id: deviceId,
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

  after(async () => {
    await scheduleDueOrderReadyPushProcessing("push_subscribe");
  });

  return NextResponse.json({
    ok: true,
    subscriptionId: (storedSubscription as { id: string }).id
  });
}
