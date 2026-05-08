import { after, NextResponse } from "next/server";
import { clearOrderAccessCookie, resolveOrderReadAccess, syncOrderAccessCookie } from "@/lib/order-access";
import { logSecurityEvent } from "@/lib/observability/security-events";
import { getOrderPaymentSnapshot, scheduleDuePendingPaymentRecovery } from "@/lib/payments/order-payments";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getSupabaseAdmin } from "@/lib/supabase";

function tooManyRequests(retryAfterSeconds: number) {
  return NextResponse.json(
    { message: "Too many requests. Please wait and try again." },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
  );
}

export async function GET(request: Request) {
  const rateLimit = await enforceRateLimit(request, "payment-status", 18, 60_000);
  if (!rateLimit.allowed) {
    logSecurityEvent({
      event: "payment_status_rate_limited",
      severity: "warning",
      request,
      details: {
        retryAfterSeconds: rateLimit.retryAfterSeconds
      },
      report: {
        thresholds: [5, 10, 25]
      }
    });
    return tooManyRequests(rateLimit.retryAfterSeconds);
  }

  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token")?.trim();
  const hint = searchParams.get("hint") === "cancelled" ? "cancelled" : undefined;
  const refresh = searchParams.get("refresh") !== "0";

  if (!token) {
    return NextResponse.json({ message: "Missing token." }, { status: 400 });
  }

  const { data: accessData, error: accessError } = await getSupabaseAdmin()
    .from("orders")
    .select("id,public_token,device_id,status,payment_status,completed_at,cancelled_at")
    .eq("public_token", token)
    .maybeSingle();

  if (accessError) {
    return NextResponse.json({ message: "Unable to verify order access." }, { status: 500 });
  }

  if (!accessData) {
    return NextResponse.json({ message: "Order not found." }, { status: 404 });
  }

  const accessOrder = accessData as {
    id: number;
    public_token: string | null;
    device_id: string | null;
    status: string;
    payment_status: string | null;
    completed_at: string | null;
    cancelled_at: string | null;
  };
  const access = await resolveOrderReadAccess(accessOrder, {
    allowPublicTokenBootstrap: true
  });

  if (!access.allowed) {
    if (access.clearOrderAccessCookie) {
      await clearOrderAccessCookie();
    }
    logSecurityEvent({
      event: "payment_status_missing_access_session",
      severity: "warning",
      request,
      details: {
        orderId: accessOrder.id
      },
      report: {
        thresholds: [5, 10, 25]
      }
    });
    return NextResponse.json({ message: access.message }, { status: access.status });
  }

  await syncOrderAccessCookie(accessOrder, {
    allowPublicTokenBootstrap: true
  });

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
