import { after, NextResponse } from "next/server";
import { captureOperationalIncident } from "@/lib/ops/incidents";
import { logSecurityEvent } from "@/lib/observability/security-events";
import { scheduleDuePendingPaymentRecovery, syncPesapalPaymentForOrder } from "@/lib/payments/order-payments";
import { buildPesapalIpnAck, type PesapalNotificationPayload } from "@/lib/payments/pesapal-ipn";
import { enforceRateLimit } from "@/lib/rate-limit";
import { readJsonWithLimit, readRequestTextWithLimit, RequestBodyTooLargeError } from "@/lib/request-limits";

function getProviderBucket(token: string | null | undefined, orderTrackingId: string | null | undefined) {
  const normalizedToken = token?.trim();
  const normalizedTrackingId = orderTrackingId?.trim();

  if (!normalizedToken && !normalizedTrackingId) {
    return null;
  }

  return `pesapal-ipn:${normalizedToken ?? "missing-token"}:${normalizedTrackingId ?? "missing-tracking"}`;
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
    try {
      return (await readJsonWithLimit<PesapalNotificationPayload>(request, 16 * 1024)) ?? {};
    } catch (error) {
      if (error instanceof RequestBodyTooLargeError) {
        throw error;
      }
      return {};
    }
  }

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const form = new URLSearchParams(await readRequestTextWithLimit(request, 16 * 1024));
    return {
      OrderNotificationType: form.get("OrderNotificationType") ?? "",
      OrderTrackingId: form.get("OrderTrackingId") ?? "",
      OrderMerchantReference: form.get("OrderMerchantReference") ?? ""
    };
  }

  return {
    OrderNotificationType: url.searchParams.get("OrderNotificationType"),
    OrderTrackingId: url.searchParams.get("OrderTrackingId"),
    OrderMerchantReference: url.searchParams.get("OrderMerchantReference")
  };
}

async function syncNotificationPayment(request: Request, payload: PesapalNotificationPayload, token: string, orderTrackingId: string) {
  try {
    await syncPesapalPaymentForOrder({
      publicToken: token,
      orderTrackingId,
      merchantReference: token
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
    throw error;
  }
}

async function handleNotification(request: Request) {
  const payload = await parseNotificationPayload(request).catch((error) => {
    if (error instanceof RequestBodyTooLargeError) {
      return "payload_too_large" as const;
    }
    return null;
  });

  if (payload === "payload_too_large") {
    return NextResponse.json({ message: "Notification payload is too large." }, { status: 413 });
  }

  if (!payload) {
    return NextResponse.json({ message: "Invalid notification payload." }, { status: 400 });
  }

  const token = payload.OrderMerchantReference?.trim();
  const orderTrackingId = payload.OrderTrackingId?.trim();
  const receivedAt = new Date().toISOString();
  console.info("pesapal_ipn_received", {
    receivedAt,
    notificationType: payload.OrderNotificationType ?? null,
    orderTrackingId: orderTrackingId ?? null
  });
  const providerBucket = getProviderBucket(token, orderTrackingId);
  const rateLimit = await enforceRateLimit(request, "payment-ipn", providerBucket ? 180 : 60, 60_000, {
    bucketSuffix: providerBucket
  });
  if (!rateLimit.allowed) {
    logSecurityEvent({
      event: "payment_ipn_rate_limited",
      severity: "warning",
      request,
      details: {
        publicToken: token ?? null,
        orderTrackingId: orderTrackingId ?? null,
        retryAfterSeconds: rateLimit.retryAfterSeconds
      },
      report: {
        thresholds: [10, 25, 50]
      }
    });
    return NextResponse.json(
      buildPesapalIpnAck(payload, 500),
      {
        status: 200,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) }
      }
    );
  }

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
    return NextResponse.json(buildPesapalIpnAck(payload, 500), { status: 200 });
  }

  try {
    await syncNotificationPayment(request, payload, token, orderTrackingId);
    console.info("pesapal_ipn_ack_sent", {
      receivedAt,
      acknowledgedAt: new Date().toISOString(),
      orderTrackingId,
      status: 200
    });
    return NextResponse.json(buildPesapalIpnAck(payload, 200), { status: 200 });
  } catch {
    console.warn("pesapal_ipn_ack_sent", {
      receivedAt,
      acknowledgedAt: new Date().toISOString(),
      orderTrackingId,
      status: 500
    });
    return NextResponse.json(buildPesapalIpnAck(payload, 500), { status: 200 });
  } finally {
    after(async () => {
      await scheduleDuePendingPaymentRecovery("pesapal_ipn");
    });
  }
}

export async function GET(request: Request) {
  return handleNotification(request);
}

export async function POST(request: Request) {
  return handleNotification(request);
}
