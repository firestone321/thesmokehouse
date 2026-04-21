import { NextRequest, NextResponse } from "next/server";
import { loadSellableStockMaps, resolveStockForPortion } from "@/lib/menu-stock";
import { generatePickupCode, generatePublicToken } from "@/lib/order-utils";
import { allowOrder } from "@/lib/rate-limit";
import { pickupSelectionToPromisedAt } from "@/lib/shared-schema";
import { getSupabaseAdmin } from "@/lib/supabase";
import { createOrderSchema, getClientIp } from "@/lib/validation";

export const dynamic = "force-dynamic";

interface MenuPriceRow {
  id: number;
  name: string;
  base_price: number;
  portion_type_id: number | null;
  is_active: boolean;
  is_available_today: boolean;
}

interface CreatedOrderRow {
  id: number;
  order_number: string;
  public_token: string;
  pickup_code: string | null;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = createOrderSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid order payload" }, { status: 400 });
  }

  const input = parsed.data;
  const ip = getClientIp(req.headers.get("x-forwarded-for"));
  const rateCheck = allowOrder(ip, input.phone);

  if (!rateCheck.ok) {
    return NextResponse.json({ error: rateCheck.reason }, { status: 429 });
  }

  const ids = Array.from(new Set(input.items.map((i) => i.menu_item_id)));
  const requestedQuantities = input.items.reduce((quantityMap, item) => {
    quantityMap.set(item.menu_item_id, (quantityMap.get(item.menu_item_id) ?? 0) + item.qty);
    return quantityMap;
  }, new Map<number, number>());
  const supabase = getSupabaseAdmin();

  const { data: menuItems, error: menuError } = await supabase
    .from("menu_items")
    .select("id,name,base_price,portion_type_id,is_active,is_available_today")
    .in("id", ids);

  if (menuError || !menuItems) {
    return NextResponse.json({ error: "Could not validate menu items" }, { status: 500 });
  }

  const safeMenuItems = menuItems as unknown as MenuPriceRow[];
  let dailyStockMap = new Map<number, number>();
  let finishedStockMap = new Map<number, number>();

  try {
    const stockMaps = await loadSellableStockMaps(
      supabase,
      safeMenuItems.map((item) => item.portion_type_id)
    );
    dailyStockMap = stockMaps.dailyStockMap;
    finishedStockMap = stockMaps.finishedStockMap;
  } catch (stockError) {
    console.error("Failed to validate stock for order.", stockError);
    return NextResponse.json({ error: "Could not validate menu items" }, { status: 500 });
  }

  const menuMap = new Map(safeMenuItems.map((item) => [item.id, item]));

  let total = 0;
  const orderItemsToInsert: { menu_item_id: number; menu_item_name: string; quantity: number; unit_price: number }[] = [];

  for (const item of input.items) {
    const dbItem = menuMap.get(item.menu_item_id);
    if (!dbItem || !dbItem.is_active || !dbItem.is_available_today) {
      return NextResponse.json({ error: "One or more menu items are unavailable" }, { status: 400 });
    }

    const stock = resolveStockForPortion(dbItem.portion_type_id, dailyStockMap, finishedStockMap);
    const requestedQuantity = requestedQuantities.get(item.menu_item_id) ?? item.qty;

    if (stock.availableQuantity <= 0) {
      return NextResponse.json({ error: `${dbItem.name} is out of stock` }, { status: 400 });
    }

    if (requestedQuantity > stock.availableQuantity) {
      return NextResponse.json({ error: `Only ${stock.availableQuantity} ${dbItem.name} left` }, { status: 400 });
    }

    total += dbItem.base_price * item.qty;

    orderItemsToInsert.push({
      menu_item_id: item.menu_item_id,
      menu_item_name: dbItem.name,
      quantity: item.qty,
      unit_price: dbItem.base_price
    });
  }

  if (total <= 0) {
    return NextResponse.json({ error: "Invalid order total" }, { status: 400 });
  }

  const promisedAt = pickupSelectionToPromisedAt(input.pickup_time);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data: createdOrder, error: orderError } = await getSupabaseAdmin()
      .from("orders")
      .insert({
        public_token: generatePublicToken(),
        pickup_code: generatePickupCode(),
        customer_name: input.name,
        customer_phone: input.phone,
        notes: input.notes || null,
        status: "confirmed",
        promised_at: promisedAt,
        total_amount: total
      })
      .select("id,order_number,public_token,pickup_code")
      .single();

    if (orderError || !createdOrder) {
      const isUniqueConflict = orderError?.code === "23505";
      if (isUniqueConflict) continue;

      if (
        orderError?.message?.includes("null value in column \"order_number\"") ||
        orderError?.message?.includes("public_token") ||
        orderError?.message?.includes("pickup_code")
      ) {
        return NextResponse.json(
          { error: "Storefront order support is not fully applied in Supabase yet. Run Phase 10 and try again." },
          { status: 500 }
        );
      }

      return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
    }

    const orderRow = createdOrder as unknown as CreatedOrderRow;

    const rows = orderItemsToInsert.map((row) => ({
      order_id: orderRow.id,
      ...row
    }));

    const { error: itemsError } = await getSupabaseAdmin().from("order_items").insert(rows);

    if (itemsError) {
      await getSupabaseAdmin().from("orders").delete().eq("id", orderRow.id);
      return NextResponse.json({ error: "Failed to save order items" }, { status: 500 });
    }

    return NextResponse.json({
      public_token: orderRow.public_token,
      order_number: orderRow.order_number,
      pickup_code: orderRow.pickup_code
    });
  }

  return NextResponse.json({ error: "Could not generate secure order token" }, { status: 500 });
}
