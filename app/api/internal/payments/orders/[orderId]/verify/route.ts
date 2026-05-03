import { NextResponse } from "next/server";
import {
  extractBearerToken,
  InternalRequestAuthError,
  requireInternalRequestSigningSecret,
  verifyInternalRequestToken
} from "@/lib/internal-auth";
import { getOrderPaymentSnapshot } from "@/lib/payments/order-payments";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

const PAYMENT_VERIFY_PURPOSE = "payment_authority_verify";

type PaymentAuthorityOrderRow = {
  id: number;
  public_token: string | null;
  order_tracking_id: string | null;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;
    const providedToken = extractBearerToken(request);
    if (!providedToken) {
      return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
    }

    verifyInternalRequestToken({
      token: providedToken,
      secret: requireInternalRequestSigningSecret("STOREFRONT_INTERNAL_AUTH_TOKEN"),
      issuer: "thesmokehouse-admin",
      audience: "thesmokehouse-storefront",
      purpose: PAYMENT_VERIFY_PURPOSE,
      method: "POST",
      path: new URL(request.url).pathname,
      orderId
    });

    const numericOrderId = Number(orderId);
    if (!Number.isInteger(numericOrderId) || numericOrderId <= 0) {
      return NextResponse.json({ message: "Invalid order id." }, { status: 400 });
    }

    const { data: order, error } = await getSupabaseAdmin()
      .from("orders")
      .select("id,public_token,order_tracking_id")
      .eq("id", numericOrderId)
      .maybeSingle();

    if (error) {
      throw new Error(`Unable to load order for payment verification: ${error.message}`);
    }

    const paymentOrder = order as PaymentAuthorityOrderRow | null;

    if (!paymentOrder?.public_token) {
      return NextResponse.json({ message: "Order not found." }, { status: 404 });
    }

    if (!paymentOrder.order_tracking_id) {
      return NextResponse.json({ message: "Order does not have a payment tracking id." }, { status: 400 });
    }

    const snapshot = await getOrderPaymentSnapshot(paymentOrder.public_token, {
      refresh: true
    });

    return NextResponse.json({
      ok: true,
      orderId: numericOrderId,
      verificationState: snapshot.paymentStatus,
      order: snapshot,
      message: `Payment verification completed with status ${snapshot.paymentStatus}.`
    });
  } catch (error) {
    if (error instanceof InternalRequestAuthError) {
      return NextResponse.json({ message: error.message }, { status: 401 });
    }

    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to verify payment." },
      { status: 500 }
    );
  }
}
