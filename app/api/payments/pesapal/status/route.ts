import { after, NextResponse } from "next/server";
import { hasOrderAccess, setOrderAccessCookie } from "@/lib/order-access";
import { getOrderPaymentSnapshot, scheduleDuePendingPaymentRecovery } from "@/lib/payments/order-payments";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET(request: Request) {
  const rateLimit = await enforceRateLimit(request, "payment-status", 18, 60_000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { message: "Too many requests. Please wait and try again." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
    );
  }

  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token")?.trim();
  const hint = searchParams.get("hint") === "cancelled" ? "cancelled" : undefined;
  const refresh = searchParams.get("refresh") !== "0";
  const bootstrapAccess = searchParams.get("bootstrap") === "1";

  if (!token) {
    return NextResponse.json({ message: "Missing token." }, { status: 400 });
  }

  const { data: accessData, error: accessError } = await getSupabaseAdmin()
    .from("orders")
    .select("id,public_token")
    .eq("public_token", token)
    .maybeSingle();

  if (accessError) {
    return NextResponse.json({ message: "Unable to verify order access." }, { status: 500 });
  }

  if (!accessData) {
    return NextResponse.json({ message: "Order not found." }, { status: 404 });
  }

  const accessOrder = accessData as { id: number; public_token: string | null };
  const hasAccess = await hasOrderAccess({
    orderId: accessOrder.id,
    publicToken: accessOrder.public_token
  });

  if (!hasAccess && !bootstrapAccess) {
    console.warn("payment_status_missing_access_session", {
      orderId: accessOrder.id
    });
    return NextResponse.json({ message: "Missing valid order access session." }, { status: 403 });
  }

  if (!hasAccess) {
    await setOrderAccessCookie({
      orderId: accessOrder.id,
      publicToken: token
    });
  }

  try {
    const order = await getOrderPaymentSnapshot(token, {
      refresh,
      hint
    });

    after(async () => {
      await scheduleDuePendingPaymentRecovery("payment_status");
    });

    return NextResponse.json({ ok: true, order });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to fetch payment status." },
      { status: 500 }
    );
  }
}
