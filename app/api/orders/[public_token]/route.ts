import { after, NextResponse } from "next/server";
import { clearOrderAccessCookie, hasReadAccessToOrder, syncOrderAccessCookie } from "@/lib/order-access";
import { scheduleDuePendingPaymentRecovery } from "@/lib/payments/order-payments";
import { scheduleDueOrderReadyPushProcessing } from "@/lib/push/order-ready";
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

export async function GET(req: Request, { params }: Params) {
  const { public_token } = await params;

  const { data: accessData, error: accessError } = await getSupabaseAdmin()
    .from("orders")
    .select("id,public_token,status,payment_status,completed_at,cancelled_at")
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
    status: string;
    payment_status: string | null;
    completed_at: string | null;
    cancelled_at: string | null;
  };
  const hasAccess = await hasReadAccessToOrder(accessOrder);

  if (!hasAccess) {
    await clearOrderAccessCookie();
    console.warn("order_detail_missing_access_session", {
      orderId: accessOrder.id
    });
    await syncOrderAccessCookie(accessOrder);
    return NextResponse.json({ error: "Missing valid order access session." }, { status: 403 });
  }

  await syncOrderAccessCookie(accessOrder);

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
