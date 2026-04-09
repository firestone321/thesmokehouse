import { NextResponse } from "next/server";
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
  pickup_code: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  status: string;
  promised_at: string | null;
  notes: string | null;
  total_amount: number;
  created_at: string;
  order_items: Array<{
    id: number;
    menu_item_id: number;
    quantity: number;
    unit_price: number;
    menu_item_name: string;
    menu_items: { name: string; image_url: string | null } | null;
  }>;
}

export async function GET(_req: Request, { params }: Params) {
  const { public_token } = await params;

  const { data, error } = await getSupabaseAdmin()
    .from("orders")
    .select(
      "id,order_number,public_token,pickup_code,customer_name,customer_phone,status,promised_at,notes,total_amount,created_at,order_items(id,menu_item_id,menu_item_name,quantity,unit_price,menu_items(name,image_url))"
    )
    .eq("public_token", public_token)
    .single();

  if (error || !data) {
    if (error?.message?.includes("public_token") || error?.message?.includes("pickup_code")) {
      return NextResponse.json(
        { error: "Storefront order support is not fully applied in Supabase yet. Run Phase 10 and try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const order = data as unknown as CustomerOrderRow;

  return NextResponse.json(mapSharedOrder(order));
}
