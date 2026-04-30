import { NextRequest, NextResponse } from "next/server";
import { loadSellableStockMaps, resolveStockForPortion } from "@/lib/menu-stock";
import { getUgandaServiceDate } from "@/lib/menu-stock";
import { setOrderAccessCookie } from "@/lib/order-access";
import { generatePickupCode, generatePublicToken } from "@/lib/order-utils";
import {
  cancelRejectedOrderPaymentInitiation,
  initiateOrderPaymentForOrder,
  isPesapalInitiationRejectedError
} from "@/lib/payments/order-payments";
import { enforceRateLimit } from "@/lib/rate-limit";
import { isContentLengthTooLarge } from "@/lib/request-limits";
import { resolveSiteOrigin } from "@/lib/site-url";
import { pickupSelectionToPromisedAt } from "@/lib/shared-schema";
import { getSupabaseAdmin } from "@/lib/supabase";
import { createOrderSchema } from "@/lib/validation";

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

function tooManyRequests(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: "Too many requests. Please wait and try again." },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
  );
}

export async function POST(req: NextRequest) {
  if (isContentLengthTooLarge(req, 32 * 1024)) {
    return NextResponse.json({ error: "Order payload is too large." }, { status: 413 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createOrderSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid order payload" }, { status: 400 });
  }

  const input = {
    ...parsed.data,
    items: Array.from(
      parsed.data.items
        .reduce((itemMap, item) => {
          itemMap.set(item.menu_item_id, (itemMap.get(item.menu_item_id) ?? 0) + item.qty);
          return itemMap;
        }, new Map<number, number>())
        .entries()
    ).map(([menu_item_id, qty]) => ({ menu_item_id, qty }))
  };

  if (input.items.some((item) => item.qty > 20)) {
    return NextResponse.json({ error: "Item quantity is too large" }, { status: 400 });
  }

  const routeRateLimit = await enforceRateLimit(req, "order-create", 8, 10 * 60 * 1000);
  if (!routeRateLimit.allowed) {
    return tooManyRequests(routeRateLimit.retryAfterSeconds);
  }

  const phoneRateLimit = await enforceRateLimit(req, "order-create-phone", 4, 10 * 60 * 1000, {
    bucketSuffix: input.phone
  });
  if (!phoneRateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many orders for this phone number. Please wait before retrying." },
      { status: 429, headers: { "Retry-After": String(phoneRateLimit.retryAfterSeconds) } }
    );
  }

  const ids = Array.from(new Set(input.items.map((i) => i.menu_item_id)));
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

    if (stock.availableQuantity <= 0) {
      return NextResponse.json({ error: `${dbItem.name} is out of stock` }, { status: 400 });
    }

    if (item.qty > stock.availableQuantity) {
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
  const serviceDate = getUgandaServiceDate(promisedAt ? new Date(promisedAt) : new Date());

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data: createdOrder, error: orderError } = await getSupabaseAdmin()
      .from("orders")
      .insert({
        public_token: generatePublicToken(),
        pickup_code: generatePickupCode(),
        customer_name: input.name,
        customer_phone: input.phone,
        notes: input.notes || null,
        status: "new",
        payment_status: "pending",
        payment_provider: "pesapal",
        service_date: serviceDate,
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
        orderError?.message?.includes("pickup_code") ||
        orderError?.message?.includes("payment_status") ||
        orderError?.message?.includes("service_date")
      ) {
        return NextResponse.json(
          { error: "Storefront payment support is not fully applied in Supabase yet. Run Phases 10 and 21 and try again." },
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

    try {
      const payment = await initiateOrderPaymentForOrder(orderRow.public_token, {
        requestOrigin: resolveSiteOrigin(req.url)
      });
      await setOrderAccessCookie({
        orderId: orderRow.id,
        publicToken: orderRow.public_token
      });

      return NextResponse.json({
        public_token: orderRow.public_token,
        order_number: orderRow.order_number,
        pickup_code: orderRow.pickup_code,
        payment_status: payment.paymentStatus,
        redirect_url: payment.redirectUrl
      });
    } catch (paymentError) {
      if (
        isPesapalInitiationRejectedError(paymentError) &&
        !paymentError.providerReference &&
        !paymentError.redirectUrl
      ) {
        const cancelledSnapshot = await cancelRejectedOrderPaymentInitiation({
          publicToken: orderRow.public_token,
          reasonCode: paymentError.code,
          reasonMessage: paymentError.providerMessage
        });
        await setOrderAccessCookie({
          orderId: orderRow.id,
          publicToken: orderRow.public_token
        });

        return NextResponse.json({
          public_token: orderRow.public_token,
          order_number: orderRow.order_number,
          pickup_code: orderRow.pickup_code,
          payment_status: cancelledSnapshot?.paymentStatus ?? "cancelled",
          redirect_url: null
        });
      }

      console.error("storefront_payment_initiation_failed", {
        publicToken: orderRow.public_token,
        error: paymentError instanceof Error ? paymentError.message : "unknown error"
      });

      return NextResponse.json({ error: "Unable to initiate payment." }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Could not generate secure order token" }, { status: 500 });
}
