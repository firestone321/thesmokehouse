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

function tooManyRequests(retryAfterSeconds: number) {
  return NextResponse.json(
    { message: "Too many requests. Please wait and try again." },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
  );
}

export async function GET(request: Request) {
  const rateLimit = await enforceRateLimit(request, "payment-callback", 30, 60_000);
  if (!rateLimit.allowed) {
    logSecurityEvent({
      event: "payment_callback_rate_limited",
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

  const requestUrl = new URL(request.url);
  const token =
    requestUrl.searchParams.get("token")?.trim() ||
    requestUrl.searchParams.get("OrderMerchantReference")?.trim();
  const orderTrackingId = requestUrl.searchParams.get("OrderTrackingId")?.trim();
  const cancelled = requestUrl.searchParams.get("cancelled") === "1";

  if (token) {
    try {
      if (cancelled) {
        await markOrderPaymentCancelled(token);
      } else if (orderTrackingId) {
        await syncPesapalPaymentForOrder({
          publicToken: token,
          orderTrackingId
        });
      }
    } catch (error) {
      if (!cancelled && orderTrackingId) {
        await captureOperationalIncident({
          type: "payment_callback_sync_failed",
          severity: "critical",
          source: "pesapal_callback",
          message: "Pesapal callback payment sync failed.",
          dedupeKey: `payment_callback_sync_failed:${token}:${orderTrackingId}`,
          context: {
            publicToken: token,
            orderTrackingId,
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
            error: error instanceof Error ? error.message : "unknown error"
          }
        });
      }

      console.error("pesapal_callback_sync_failed", {
        token,
        orderTrackingId: orderTrackingId ?? null,
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
  if (cancelled) {
    resultUrl.searchParams.set("hint", "cancelled");
  }

  after(async () => {
    await scheduleDuePendingPaymentRecovery("pesapal_callback");
  });

  return NextResponse.redirect(resultUrl);
}
