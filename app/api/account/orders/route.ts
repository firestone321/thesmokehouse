import { NextResponse } from "next/server";
import { mapSharedOrder } from "@/lib/shared-schema";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getAuthenticatedUser, getBearerToken } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";

const orderSelection =
  "id,order_number,public_token,device_id,pickup_code,customer_name,customer_phone,status,payment_status,promised_at,notes,total_amount,created_at,completed_at,cancelled_at,order_items(id,menu_item_id,menu_item_name,quantity,unit_price,menu_items(name,image_url))";

export async function GET(request: Request) {
  const accessToken = getBearerToken(request);
  const user = await getAuthenticatedUser(accessToken);

  if (!user) {
    return NextResponse.json({ error: accessToken ? "Your sign-in session expired. Refresh and sign in again." : "Sign in to view your order history." }, { status: 401 });
  }

  const { data, error } = await getSupabaseAdmin()
    .from("orders")
    .select(orderSelection)
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    if (error.message.includes("customer_id")) {
      return NextResponse.json(
        { error: "Account order history is not applied in Supabase yet. Run Phase 74 and try again." },
        { status: 500 }
      );
    }

    console.error("account_order_history_load_failed", {
      userId: user.id,
      error: error.message
    });
    return NextResponse.json({ error: "Unable to load your order history." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    orders: (data ?? []).map((row) => mapSharedOrder(row))
  });
}
