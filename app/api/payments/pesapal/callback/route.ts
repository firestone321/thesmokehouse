import { after, NextResponse } from "next/server";
import { captureOperationalIncident } from "@/lib/ops/incidents";
import { logSecurityEvent } from "@/lib/observability/security-events";
import {
  markOrderPaymentCancelled,
  scheduleDuePendingPaymentRecovery,
  syncPesapalPaymentForOrder
} from "@/lib/payments/order-payments";
import { enforceRateLimit } from "@/lib/rate-limit";
import { resolveSiteOrigin } from "@/lib/site-url";
import {
  scheduleDueAdminPaidOrderPushProcessing,
  triggerAdminPaidOrderPushDispatch
} from "@/lib/push/admin-paid-order";

function tooManyRequests(retryAfterSeconds: number) {
  return NextResponse.json(
    { message: "Too many requests. Please wait and try again." },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
  );
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const token =
    requestUrl.searchParams.get("token")?.trim() ||
    requestUrl.searchParams.get("OrderMerchantReference")?.trim();
  const orderTrackingId = requestUrl.searchParams.get("OrderTrackingId")?.trim();
  const cancelled = requestUrl.searchParams.get("cancelled") === "1";
  const receivedAt = new Date().toISOString();
  let cancellationConfirmed = false;
  let paidOrderId: number | null = null;
  console.info("pesapal_callback_received", {
    receivedAt,
    orderTrackingId: orderTrackingId ?? null,
    cancellationRequested: cancelled
  });
  const providerBucket =
    token || orderTrackingId
      ? `pesapal-callback:${token ?? "missing-token"}:${orderTrackingId ?? "missing-tracking"}:${cancelled ? "cancelled" : "sync"}`
      : null;
  const rateLimit = await enforceRateLimit(request, "payment-callback", providerBucket ? 120 : 30, 60_000, {
    bucketSuffix: providerBucket
  });
  if (!rateLimit.allowed) {
    logSecurityEvent({
      event: "payment_callback_rate_limited",
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
    return tooManyRequests(rateLimit.retryAfterSeconds);
  }

  if (token) {
    try {
      if (cancelled) {
        if (!orderTrackingId) {
          throw new Error("A Pesapal tracking ID is required before cancellation can be verified.");
        }

        const snapshot = await markOrderPaymentCancelled({
          publicToken: token,
          orderTrackingId,
          merchantReference: token
        });
        cancellationConfirmed = snapshot.paymentStatus === "cancelled";
      } else if (orderTrackingId) {
        const snapshot = await syncPesapalPaymentForOrder({
          publicToken: token,
          orderTrackingId,
          merchantReference: token
        });
        if (snapshot.paymentStatus === "paid") {
          paidOrderId = snapshot.orderId;
        }
      }
    } catch (error) {
      if (orderTrackingId) {
        await captureOperationalIncident({
          type: "payment_callback_sync_failed",
          severity: "critical",
          source: "pesapal_callback",
          message: cancelled
            ? "Pesapal callback cancellation verification failed."
            : "Pesapal callback payment sync failed.",
          dedupeKey: `payment_callback_sync_failed:${token}:${orderTrackingId}`,
          context: {
            publicToken: token,
            orderTrackingId,
            cancelled,
            receivedAt,
            error: error instanceof Error ? error.message : "unknown_error"
          }
        });
        logSecurityEvent({
          event: "payment_callback_sync_failed",
          severity: "error",
          request,
          details: {
            publicToken: token,
            orderTrackingId,
            cancelled,
            receivedAt,
            error: error instanceof Error ? error.message : "unknown error"
          }
        });
      }

      console.error("pesapal_callback_sync_failed", {
        token,
        orderTrackingId: orderTrackingId ?? null,
        cancelled,
        receivedAt,
        error: error instanceof Error ? error.message : "unknown error"
      });
    }
  }

  if (!cancelled && (!token || !orderTrackingId)) {
    logSecurityEvent({
      event: "payment_callback_missing_identifiers",
      severity: "warning",
      request,
      details: {
        publicToken: token ?? null,
        orderTrackingId: orderTrackingId ?? null,
        cancelled
      },
      report: {
        thresholds: [3, 10, 25]
      }
    });
  }

  const resultUrl = new URL("/payment/result", resolveSiteOrigin(request.url));
  if (token) {
    resultUrl.searchParams.set("token", token);
  }
  if (cancellationConfirmed) {
    resultUrl.searchParams.set("hint", "cancelled");
  }

  after(async () => {
    if (paidOrderId !== null) {
      await triggerAdminPaidOrderPushDispatch(paidOrderId).catch((error) => {
        console.error("admin_paid_order_push_immediate_kick_failed", {
          trigger: "pesapal_callback",
          orderId: paidOrderId,
          error: error instanceof Error ? error.message : "unknown_error"
        });
      });
    }
    await scheduleDueAdminPaidOrderPushProcessing("pesapal_callback");
    await scheduleDuePendingPaymentRecovery("pesapal_callback");
  });

  console.info("pesapal_callback_redirecting", {
    receivedAt,
    redirectingAt: new Date().toISOString(),
    orderTrackingId: orderTrackingId ?? null,
    cancellationRequested: cancelled,
    cancellationConfirmed
  });

  return NextResponse.redirect(resultUrl);
}
