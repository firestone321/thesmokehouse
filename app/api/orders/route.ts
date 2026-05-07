import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { loadSellableStockMaps, resolveStockForPortion } from "@/lib/menu-stock";
import { getUgandaServiceDate } from "@/lib/menu-stock";
import { ensureGuestDeviceSession } from "@/lib/guest-device";
import { setOrderAccessCookie } from "@/lib/order-access";
import { generatePickupCode, generatePublicToken } from "@/lib/order-utils";
import {
  cancelRejectedOrderPaymentInitiation,
  initiateOrderPaymentForOrder,
  isPesapalInitiationRejectedError
} from "@/lib/payments/order-payments";
import { enforceRateLimit } from "@/lib/rate-limit";
import { readJsonWithLimit, RequestBodyTooLargeError } from "@/lib/request-limits";
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
  portion_types:
    | {
        stock_source_portion_type_id: number | null;
        stock_source_units_per_serving: number | null;
      }
    | Array<{
        stock_source_portion_type_id: number | null;
        stock_source_units_per_serving: number | null;
      }>
    | null;
}

interface CreatedOrderRow {
  id: number;
  order_number: string;
  public_token: string;
  pickup_code: string | null;
}

interface ReservationRow {
  status: string;
  result_json: Record<string, unknown> | null;
  expires_at: string;
  request_hash: string | null;
  order_id: number | null;
  public_token: string | null;
  order_number: string | null;
  pickup_code: string | null;
}

type ParsedOrderItem = {
  menu_item_id: number;
  qty: number;
  client_group_id?: string;
  client_item_role?: "main" | "addon";
  client_sort_order?: number;
};

type OrderResult = {
  public_token: string;
  order_number: string;
  pickup_code: string | null;
  payment_status: string;
  redirect_url: string | null;
};

function tooManyRequests(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: "Too many requests. Please wait and try again." },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
  );
}

function buildCheckoutRequestHash(input: {
  items: ParsedOrderItem[];
  pickup_time: string;
  name: string;
  phone: string;
  notes?: string;
}) {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        items: input.items,
        pickup_time: input.pickup_time,
        name: input.name.trim(),
        phone: input.phone.trim(),
        notes: input.notes?.trim() ?? ""
      })
    )
    .digest("hex");
}

export async function POST(req: NextRequest) {
  const body = await readJsonWithLimit(req, 32 * 1024).catch((error) => {
    if (error instanceof RequestBodyTooLargeError) {
      return "payload_too_large";
    }
    return null;
  });

  if (body === "payload_too_large") {
    return NextResponse.json({ error: "Order payload is too large." }, { status: 413 });
  }

  const parsed = createOrderSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid order payload" }, { status: 400 });
  }

  const input = parsed.data;
  const aggregatedItems = Array.from(
    input.items
      .reduce((itemMap, item) => {
        itemMap.set(item.menu_item_id, (itemMap.get(item.menu_item_id) ?? 0) + item.qty);
        return itemMap;
      }, new Map<number, number>())
      .entries()
  ).map(([menu_item_id, qty]) => ({ menu_item_id, qty }));

  if (aggregatedItems.some((item) => item.qty > 20)) {
    return NextResponse.json({ error: "Item quantity is too large" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const idempotencyKey = input.idempotency_key ?? null;
  const requestHash = buildCheckoutRequestHash(input);

  async function markReservation(status: "complete" | "failed", result?: OrderResult, lastError?: string) {
    if (!idempotencyKey) return;
    await supabase
      .from("checkout_reservations")
      .update({
        status,
        result_json: result ?? null,
        request_hash: requestHash,
        last_error: lastError ?? null
      })
      .eq("idempotency_key", idempotencyKey)
      .eq("request_hash", requestHash);
  }

  async function finishCheckoutForOrder(orderRow: CreatedOrderRow) {
    try {
      const payment = await initiateOrderPaymentForOrder(orderRow.public_token, {
        requestOrigin: resolveSiteOrigin(req.url)
      });
      const guestDevice = await ensureGuestDeviceSession();
      await setOrderAccessCookie({
        orderId: orderRow.id,
        publicToken: orderRow.public_token,
        deviceId: guestDevice.deviceId
      });

      const result: OrderResult = {
        public_token: orderRow.public_token,
        order_number: orderRow.order_number,
        pickup_code: orderRow.pickup_code,
        payment_status: payment.paymentStatus,
        redirect_url: payment.redirectUrl
      };
      await markReservation("complete", result);
      return NextResponse.json(result);
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
        const guestDevice = await ensureGuestDeviceSession();
        await setOrderAccessCookie({
          orderId: orderRow.id,
          publicToken: orderRow.public_token,
          deviceId: guestDevice.deviceId
        });

        const result: OrderResult = {
          public_token: orderRow.public_token,
          order_number: orderRow.order_number,
          pickup_code: orderRow.pickup_code,
          payment_status: cancelledSnapshot?.paymentStatus ?? "cancelled",
          redirect_url: null
        };
        await markReservation("complete", result);
        return NextResponse.json(result);
      }

      console.error("storefront_payment_initiation_failed", {
        publicToken: orderRow.public_token,
        error: paymentError instanceof Error ? paymentError.message : "unknown error"
      });

      await markReservation("failed", undefined, paymentError instanceof Error ? paymentError.message : "unknown_error");
      return NextResponse.json({ error: "Unable to initiate payment." }, { status: 500 });
    }
  }

  // Return early for cached or in-flight reservations — no rate limit consumed.
  if (idempotencyKey) {
    const { data: existing } = await supabase
      .from("checkout_reservations")
      .select("status,result_json,expires_at,request_hash,order_id,public_token,order_number,pickup_code")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    const row = existing as unknown as ReservationRow | null;
    if (row) {
      if (row.request_hash && row.request_hash !== requestHash) {
        return NextResponse.json(
          { error: "This checkout session changed. Please reload checkout and try again." },
          { status: 409 }
        );
      }

      const expired = new Date(row.expires_at) <= new Date();
      if (!expired) {
        if (row.status === "complete" && row.result_json) {
          return NextResponse.json(row.result_json);
        }
        if (row.status === "processing") {
          if (row.order_id && row.public_token && row.order_number) {
            return finishCheckoutForOrder({
              id: row.order_id,
              public_token: row.public_token,
              order_number: row.order_number,
              pickup_code: row.pickup_code
            });
          }
          return NextResponse.json(
            { error: "Your order is already being processed. Please wait." },
            { status: 409 }
          );
        }
      }
      if (row.order_id && row.public_token && row.order_number) {
        return finishCheckoutForOrder({
          id: row.order_id,
          public_token: row.public_token,
          order_number: row.order_number,
          pickup_code: row.pickup_code
        });
      }
      // Failed or expired rows with no order binding are safe to replace.
      await supabase
        .from("checkout_reservations")
        .delete()
        .eq("idempotency_key", idempotencyKey);
    }
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

  const ids = Array.from(new Set(aggregatedItems.map((i) => i.menu_item_id)));

  const { data: menuItems, error: menuError } = await supabase
    .from("menu_items")
    .select(
      "id,name,base_price,portion_type_id,is_active,is_available_today,portion_types(stock_source_portion_type_id,stock_source_units_per_serving)"
    )
    .in("id", ids);

  if (menuError || !menuItems) {
    return NextResponse.json({ error: "Could not validate menu items" }, { status: 500 });
  }

  const safeMenuItems = menuItems as unknown as MenuPriceRow[];
  let dailyStockMap = new Map<number, number>();
  let finishedStockMap = new Map<number, number>();

  function unwrapPortionType(value: MenuPriceRow["portion_types"]) {
    if (Array.isArray(value)) return value[0] ?? null;
    return value;
  }

  const sourcePortionTypeIds = safeMenuItems
    .map((item) => unwrapPortionType(item.portion_types)?.stock_source_portion_type_id ?? null)
    .filter((id): id is number => typeof id === "number" && id > 0);

  try {
    const stockMaps = await loadSellableStockMaps(
      supabase,
      safeMenuItems.map((item) => item.portion_type_id),
      undefined,
      sourcePortionTypeIds
    );
    dailyStockMap = stockMaps.dailyStockMap;
    finishedStockMap = stockMaps.finishedStockMap;
  } catch (stockError) {
    console.error("Failed to validate stock for order.", stockError);
    return NextResponse.json({ error: "Could not validate menu items" }, { status: 500 });
  }

  const menuMap = new Map(safeMenuItems.map((item) => [item.id, item]));

  let total = 0;
  const orderItemsToInsert: {
    menu_item_id: number;
    menu_item_name: string;
    quantity: number;
    unit_price: number;
    cart_group_id?: string;
    cart_item_role?: "main" | "addon";
    cart_sort_order?: number;
  }[] = [];

  for (const item of aggregatedItems) {
    const dbItem = menuMap.get(item.menu_item_id);
    if (!dbItem || !dbItem.is_active || !dbItem.is_available_today) {
      return NextResponse.json({ error: "One or more menu items are unavailable" }, { status: 400 });
    }

    const portionType = unwrapPortionType(dbItem.portion_types);
    const stockSource =
      portionType?.stock_source_portion_type_id && portionType.stock_source_portion_type_id > 0
        ? {
            sourcePortionTypeId: portionType.stock_source_portion_type_id,
            unitsPerServing: portionType.stock_source_units_per_serving ?? 1
          }
        : undefined;
    const stock = resolveStockForPortion(dbItem.portion_type_id, dailyStockMap, finishedStockMap, stockSource);

    if (stock.availableQuantity <= 0) {
      return NextResponse.json({ error: `${dbItem.name} is out of stock` }, { status: 400 });
    }

    if (item.qty > stock.availableQuantity) {
      return NextResponse.json({ error: `Only ${stock.availableQuantity} ${dbItem.name} left` }, { status: 400 });
    }

    total += dbItem.base_price * item.qty;
  }

  for (const item of input.items) {
    const dbItem = menuMap.get(item.menu_item_id);
    if (!dbItem) {
      return NextResponse.json({ error: "One or more menu items are unavailable" }, { status: 400 });
    }
    orderItemsToInsert.push({
      menu_item_id: item.menu_item_id,
      menu_item_name: dbItem.name,
      quantity: item.qty,
      unit_price: dbItem.base_price,
      cart_group_id: item.client_group_id,
      cart_item_role: item.client_item_role,
      cart_sort_order: item.client_sort_order
    });
  }

  if (total <= 0) {
    return NextResponse.json({ error: "Invalid order total" }, { status: 400 });
  }

  const promisedAt = pickupSelectionToPromisedAt(input.pickup_time);
  const serviceDate = getUgandaServiceDate(promisedAt ? new Date(promisedAt) : new Date());

  // Claim the reservation before any writes. On concurrent duplicate submissions the
  // second request will see 'processing' and return 409 instead of creating a second order.
  let reservationClaimed = false;
  if (idempotencyKey) {
    const { error: claimError } = await supabase
      .from("checkout_reservations")
      .insert({ idempotency_key: idempotencyKey, request_hash: requestHash });

    if (!claimError) {
      reservationClaimed = true;
    } else if (claimError.code === "23505") {
      // A concurrent request claimed it between our read and this insert.
      const { data: concurrent } = await supabase
        .from("checkout_reservations")
        .select("status,result_json,order_id,public_token,order_number,pickup_code,request_hash")
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();

      const concurrentRow = concurrent as unknown as Pick<
        ReservationRow,
        "status" | "result_json" | "order_id" | "public_token" | "order_number" | "pickup_code" | "request_hash"
      > | null;
      if (concurrentRow?.request_hash && concurrentRow.request_hash !== requestHash) {
        return NextResponse.json(
          { error: "This checkout session changed. Please reload checkout and try again." },
          { status: 409 }
        );
      }
      if (concurrentRow?.status === "complete" && concurrentRow.result_json) {
        return NextResponse.json(concurrentRow.result_json);
      }
      if (concurrentRow?.order_id && concurrentRow.public_token && concurrentRow.order_number) {
        return finishCheckoutForOrder({
          id: concurrentRow.order_id,
          public_token: concurrentRow.public_token,
          order_number: concurrentRow.order_number,
          pickup_code: concurrentRow.pickup_code
        });
      }
      if (concurrentRow?.status === "processing") {
        return NextResponse.json(
          { error: "Your order is already being processed. Please wait." },
          { status: 409 }
        );
      }
      // failed or missing → proceed without reservation (graceful degradation)
    }
    // Any other claim error → proceed without reservation
  }

  // Create order + items atomically. Retry on public_token uniqueness conflicts only.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const publicToken = generatePublicToken();
    const pickupCode = generatePickupCode();
    const guestDevice = await ensureGuestDeviceSession();
    const rpcName = idempotencyKey && reservationClaimed ? "create_storefront_order_for_checkout" : "create_storefront_order";
    const rpcInput =
      idempotencyKey && reservationClaimed
        ? {
            p_idempotency_key: idempotencyKey,
            p_request_hash: requestHash,
            p_public_token: publicToken,
            p_pickup_code: pickupCode,
            p_device_id: guestDevice.deviceId,
            p_customer_name: input.name,
            p_customer_phone: input.phone,
            p_notes: input.notes || null,
            p_service_date: serviceDate,
            p_promised_at: promisedAt,
            p_total_amount: total,
            p_items: JSON.stringify(orderItemsToInsert)
          }
        : {
            p_public_token: publicToken,
            p_pickup_code: pickupCode,
            p_device_id: guestDevice.deviceId,
            p_customer_name: input.name,
            p_customer_phone: input.phone,
            p_notes: input.notes || null,
            p_service_date: serviceDate,
            p_promised_at: promisedAt,
            p_total_amount: total,
            p_items: JSON.stringify(orderItemsToInsert)
          };
    const { data: rpcData, error: rpcError } = await supabase.rpc(rpcName, rpcInput);

    if (rpcError) {
      if (rpcError.code === "23505") continue; // public_token collision, retry

      if (
        rpcError.message?.includes("payment_status") ||
        rpcError.message?.includes("service_date") ||
        rpcError.message?.includes("public_token") ||
        rpcError.message?.includes("pickup_code") ||
        rpcError.message?.includes("create_storefront_order_for_checkout") ||
        rpcError.message?.includes("checkout_reservations")
      ) {
        await markReservation("failed");
        return NextResponse.json(
          { error: "Storefront payment support is not fully applied in Supabase yet. Run Phases 10, 21, 40, and 42 and try again." },
          { status: 500 }
        );
      }

      await markReservation("failed");
      return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
    }

    const rows = rpcData as unknown as CreatedOrderRow[];
    const orderRow = rows?.[0];

    if (!orderRow) {
      await markReservation("failed");
      return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
    }

    return finishCheckoutForOrder(orderRow);
  }

  await markReservation("failed");
  return NextResponse.json({ error: "Could not generate secure order token" }, { status: 500 });
}
