import { after, NextResponse } from "next/server";
import { captureOperationalIncident } from "@/lib/ops/incidents";
import { logSecurityEvent } from "@/lib/observability/security-events";
import { scheduleDuePendingPaymentRecovery, syncPesapalPaymentForOrder } from "@/lib/payments/order-payments";
import { enforceRateLimit } from "@/lib/rate-limit";
import { isContentLengthTooLarge } from "@/lib/request-limits";

type PesapalNotificationPayload = {
  OrderNotificationType?: string | null;
  OrderTrackingId?: string | null;
  OrderMerchantReference?: string | null;
};

function tooManyRequests(retryAfterSeconds: number) {
  return NextResponse.json(
    { message: "Too many requests. Please wait and try again." },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
  );
}

function buildAck(payload: PesapalNotificationPayload) {
  const params = new URLSearchParams();
  if (payload.OrderNotificationType) {
    params.set("OrderNotificationType", payload.OrderNotificationType);
  }
  if (payload.OrderTrackingId) {
    params.set("OrderTrackingId", payload.OrderTrackingId);
  }
  if (payload.OrderMerchantReference) {
    params.set("OrderMerchantReference", payload.OrderMerchantReference);
  }
  return params.toString();
}

async function parseNotificationPayload(request: Request): Promise<PesapalNotificationPayload> {
  const url = new URL(request.url);
  const contentType = request.headers.get("content-type") ?? "";

  if (request.method === "GET") {
    return {
      OrderNotificationType: url.searchParams.get("OrderNotificationType"),
      OrderTrackingId: url.searchParams.get("OrderTrackingId"),
      OrderMerchantReference: url.searchParams.get("OrderMerchantReference")
    };
  }

  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as PesapalNotificationPayload | null;
    return body ?? {};
  }

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const form = await request.formData();
    return {
      OrderNotificationType: String(form.get("OrderNotificationType") ?? ""),
      OrderTrackingId: String(form.get("OrderTrackingId") ?? ""),
      OrderMerchantReference: String(form.get("OrderMerchantReference") ?? "")
    };
  }

  return {
    OrderNotificationType: url.searchParams.get("OrderNotificationType"),
    OrderTrackingId: url.searchParams.get("OrderTrackingId"),
    OrderMerchantReference: url.searchParams.get("OrderMerchantReference")
  };
}

async function handleNotification(request: Request) {
  if (request.method === "POST" && isContentLengthTooLarge(request, 16 * 1024)) {
    return NextResponse.json({ message: "Notification payload is too large." }, { status: 413 });
  }

  const rateLimit = await enforceRateLimit(request, "payment-ipn", 60, 60_000);
  if (!rateLimit.allowed) {
    logSecurityEvent({
      event: "payment_ipn_rate_limited",
      severity: "warning",
      request,
      details: {
        retryAfterSeconds: rateLimit.retryAfterSeconds
      },
      report: {
        thresholds: [10, 25, 50]
      }
    });
    return tooManyRequests(rateLimit.retryAfterSeconds);
  }

  const payload = await parseNotificationPayload(request);
  const token = payload.OrderMerchantReference?.trim();
  const orderTrackingId = payload.OrderTrackingId?.trim();

  if (!token || !orderTrackingId) {
    logSecurityEvent({
      event: "payment_ipn_missing_identifiers",
      severity: "warning",
      request,
      details: {
        publicToken: token ?? null,
        orderTrackingId: orderTrackingId ?? null,
        notificationType: payload.OrderNotificationType ?? null
      },
      report: {
        thresholds: [3, 10, 25]
      }
    });
    return NextResponse.json({ message: "Missing notification identifiers." }, { status: 400 });
  }

  try {
    await syncPesapalPaymentForOrder({
      publicToken: token,
      orderTrackingId
    });
  } catch (error) {
    await captureOperationalIncident({
      type: "payment_ipn_sync_failed",
      severity: "critical",
      source: "pesapal_ipn",
      message: "Pesapal IPN payment sync failed.",
      dedupeKey: `payment_ipn_sync_failed:${token}:${orderTrackingId}`,
      context: {
        publicToken: token,
        orderTrackingId,
        notificationType: payload.OrderNotificationType ?? null,
        error: error instanceof Error ? error.message : "unknown_error"
      }
    });
    logSecurityEvent({
      event: "payment_ipn_sync_failed",
      severity: "error",
      request,
      details: {
        publicToken: token,
        orderTrackingId,
        error: error instanceof Error ? error.message : "unknown error"
      }
    });
    console.error("pesapal_ipn_sync_failed", {
      token,
      orderTrackingId,
      error: error instanceof Error ? error.message : "unknown error"
    });
    return NextResponse.json({ message: "Unable to verify payment." }, { status: 500 });
  }

  after(async () => {
    await scheduleDuePendingPaymentRecovery("pesapal_ipn");
  });

  return new NextResponse(buildAck(payload), {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8"
    }
  });
}

export async function GET(request: Request) {
  return handleNotification(request);
}

export async function POST(request: Request) {
  return handleNotification(request);
}
