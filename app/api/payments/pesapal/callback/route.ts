import { NextResponse } from "next/server";
import { markOrderPaymentCancelled, syncPesapalPaymentForOrder } from "@/lib/payments/order-payments";
import { resolveSiteOrigin } from "@/lib/site-url";

export async function GET(request: Request) {
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

  return NextResponse.redirect(resultUrl);
}
