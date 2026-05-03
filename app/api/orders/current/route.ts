import { NextResponse } from "next/server";
import { clearOrderAccessCookie, getOrderAccessSession, syncOrderAccessCookie } from "@/lib/order-access";
import { mapSharedOrder } from "@/lib/shared-schema";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

interface CurrentOrderRow {
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

export async function GET() {
  const session = await getOrderAccessSession();
  if (!session) {
    return NextResponse.json({ error: "Missing valid order access session." }, { status: 401 });
  }

  const orderId = Number(session.orderId);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    await clearOrderAccessCookie();
    return NextResponse.json({ error: "Missing valid order access session." }, { status: 403 });
  }

  const { data, error } = await getSupabaseAdmin()
    .from("orders")
    .select(
      "id,order_number,public_token,device_id,pickup_code,customer_name,customer_phone,status,payment_status,promised_at,notes,total_amount,created_at,completed_at,cancelled_at,order_items(id,menu_item_id,menu_item_name,quantity,unit_price,menu_items(name,image_url))"
    )
    .eq("id", orderId)
    .maybeSingle();

  if (error || !data) {
    await clearOrderAccessCookie();
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  const order = data as unknown as CurrentOrderRow;
  if (order.public_token !== session.publicToken) {
    await clearOrderAccessCookie();
    return NextResponse.json({ error: "Missing valid order access session." }, { status: 403 });
  }

  const refreshed = await syncOrderAccessCookie({
    id: order.id,
    public_token: order.public_token,
    status: order.status,
    payment_status: order.payment_status,
    completed_at: order.completed_at,
    cancelled_at: order.cancelled_at
  });

  if (!refreshed) {
    return NextResponse.json({ error: "Your order session expired." }, { status: 403 });
  }

  return NextResponse.json({ ok: true, order: mapSharedOrder(order) });
}
