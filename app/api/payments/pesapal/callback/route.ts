import { after, NextResponse } from "next/server";
import {
  markOrderPaymentCancelled,
  scheduleDuePendingPaymentRecovery,
  syncPesapalPaymentForOrder
} from "@/lib/payments/order-payments";
import { enforceRateLimit } from "@/lib/rate-limit";
import { resolveSiteOrigin } from "@/lib/site-url";

export async function GET(request: Request) {
  const rateLimit = await enforceRateLimit(request, "payment-callback", 30, 60_000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { message: "Too many requests. Please wait and try again." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
    );
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
      console.error("pesapal_callback_sync_failed", {
        token,
        orderTrackingId: orderTrackingId ?? null,
        error: error instanceof Error ? error.message : "unknown error"
      });
    }
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
