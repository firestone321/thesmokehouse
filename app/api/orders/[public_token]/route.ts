import { after, NextResponse } from "next/server";
import { clearOrderAccessCookie, resolveOrderReadAccess, syncOrderAccessCookie } from "@/lib/order-access";
import { logSecurityEvent } from "@/lib/observability/security-events";
import { scheduleDuePendingPaymentRecovery } from "@/lib/payments/order-payments";
import { scheduleDueOrderReadyPushProcessing } from "@/lib/push/order-ready";
import { enforceRateLimit } from "@/lib/rate-limit";
import { mapSharedOrder } from "@/lib/shared-schema";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ public_token: string }>;
}

interface CustomerOrderRow {
  id: number;
  order_number: string;
  public_token: string | null;
  device_id: string | null;
  pickup_code: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  status: string;
  payment_status: string | null;
  promised_at: string | null;
  notes: string | null;
  total_amount: number;
  created_at: string;
  completed_at: string | null;
  cancelled_at: string | null;
  order_items: Array<{
    id: number;
    menu_item_id: number;
    quantity: number;
    unit_price: number;
    menu_item_name: string;
    menu_items: { name: string; image_url: string | null } | null;
  }>;
}

function tooManyRequests(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: "Too many requests. Please wait and try again." },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
  );
}

export async function GET(req: Request, { params }: Params) {
  const { public_token } = await params;
  const rateLimit = await enforceRateLimit(req, "order-detail", 60, 60_000, {
    bucketSuffix: public_token
  });

  if (!rateLimit.allowed) {
    logSecurityEvent({
      event: "order_detail_rate_limited",
      severity: "warning",
      request: req,
      details: {
        publicToken: public_token,
        retryAfterSeconds: rateLimit.retryAfterSeconds
      },
      report: {
        thresholds: [20, 40, 80]
      }
    });
    return tooManyRequests(rateLimit.retryAfterSeconds);
  }

  const { data: accessData, error: accessError } = await getSupabaseAdmin()
    .from("orders")
    .select("id,public_token,device_id,status,payment_status,completed_at,cancelled_at")
    .eq("public_token", public_token)
    .maybeSingle();

  if (accessError || !accessData) {
    if (accessError?.message?.includes("public_token")) {
      return NextResponse.json(
        { error: "Storefront order support is not fully applied in Supabase yet. Run Phase 10 and try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ error: "Order not found" }, { status: 404 });
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
    console.warn("order_detail_missing_access_session", {
      orderId: accessOrder.id
    });
    return NextResponse.json({ error: access.message }, { status: access.status });
  }

  await syncOrderAccessCookie(accessOrder, {
    allowPublicTokenBootstrap: true
  });

  const { data, error } = await getSupabaseAdmin()
    .from("orders")
    .select(
      "id,order_number,public_token,device_id,pickup_code,customer_name,customer_phone,status,payment_status,promised_at,notes,total_amount,created_at,completed_at,cancelled_at,order_items(id,menu_item_id,menu_item_name,quantity,unit_price,menu_items(name,image_url))"
    )
    .eq("id", accessOrder.id)
    .single();

  if (error || !data) {
    if (error?.message?.includes("pickup_code")) {
      return NextResponse.json(
        { error: "Storefront order support is not fully applied in Supabase yet. Run Phase 10 and try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const order = data as unknown as CustomerOrderRow;

  if (order.payment_status === "paid") {
    after(async () => {
      await scheduleDueOrderReadyPushProcessing("order_tracking");
    });
  }

  after(async () => {
    await scheduleDuePendingPaymentRecovery("order_tracking");
  });

  return NextResponse.json(mapSharedOrder(order));
}
