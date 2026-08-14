import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getUgandaServiceDate } from "@/lib/menu-stock";
import { isPubliclyAvailableOnServiceDate } from "@/lib/special-menu-availability";
import { ensureGuestDeviceSession } from "@/lib/guest-device";
import { setOrderAccessCookie } from "@/lib/order-access";
import { generatePickupCode, generatePublicToken } from "@/lib/order-utils";
import {
  cancelRejectedOrderPaymentInitiation,
  initiateOrderPaymentForOrder,
  initiatePreparedOrderPayment,
  type PreparedCheckoutPayment,
  isPesapalInitiationRejectedError
} from "@/lib/payments/order-payments";
import { enforceStorefrontCheckoutRateLimits } from "@/lib/rate-limit";
import { readJsonWithLimit, RequestBodyTooLargeError } from "@/lib/request-limits";
import { resolveSiteOrigin } from "@/lib/site-url";
import { pickupSelectionToPromisedAt, type StorefrontMenuRpcRow } from "@/lib/shared-schema";
import { getSupabaseAdmin } from "@/lib/supabase";
import { createOrderSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type CheckoutMenuRow = Pick<
  StorefrontMenuRpcRow,
  "id" | "name" | "base_price" | "is_active" | "is_available_today" | "available_quantity"
>;

interface PreparedCheckoutRpcRow {
  id: number;
  order_number: string;
  public_token: string;
  pickup_code: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  total_amount: number;
  payment_attempt_id: number;
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

function createCheckoutTimer() {
  const startedAt = Date.now();
  const stages: Record<string, number> = {};

  return {
    async measure<T>(stage: string, operation: () => PromiseLike<T>) {
      const stageStartedAt = Date.now();
      try {
        return await operation();
      } finally {
        stages[stage] = (stages[stage] ?? 0) + (Date.now() - stageStartedAt);
      }
    },
    log(outcome: string, orderId?: number | null) {
      console.info("storefront_checkout_timing", {
        outcome,
        totalMs: Date.now() - startedAt,
        stages,
        orderId: orderId ?? null
      });
    }
  };
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

function validateGroupedCartQuantities(items: ParsedOrderItem[]) {
  const groupMainQty = new Map<string, number>();
  const groupedAddons: ParsedOrderItem[] = [];

  for (const item of items) {
    if (item.client_item_role && !item.client_group_id) {
      return "Cart item grouping is incomplete. Please reload checkout and try again.";
    }

    if (item.client_item_role === "main" && item.client_group_id) {
      groupMainQty.set(item.client_group_id, (groupMainQty.get(item.client_group_id) ?? 0) + item.qty);
    }

    if (item.client_item_role === "addon") {
      groupedAddons.push(item);
    }
  }

  for (const addon of groupedAddons) {
    if (!addon.client_group_id) {
      return "Cart accompaniment is missing its main item. Please reload checkout and try again.";
    }

    const parentQty = groupMainQty.get(addon.client_group_id);
    if (!parentQty) {
      return "Cart accompaniment is missing its main item. Please reload checkout and try again.";
    }

    if (addon.qty > parentQty) {
      return "Accompaniment quantity cannot exceed the matching main item quantity.";
    }
  }

  return null;
}

function flattenLegacyCartItems(items: ParsedOrderItem[]): ParsedOrderItem[] {
  const flattened = new Map<number, ParsedOrderItem>();

  for (const item of items) {
    if (flattened.has(item.menu_item_id)) {
      continue;
    }

    flattened.set(item.menu_item_id, {
      ...item,
      qty: 1
    });
  }

  return Array.from(flattened.values());
}

export async function POST(req: NextRequest) {
  const checkoutTimer = createCheckoutTimer();
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
  const hasGroupedCartMetadata = input.items.some((item) => item.client_group_id || item.client_item_role);
  const normalizedItems = hasGroupedCartMetadata ? input.items : flattenLegacyCartItems(input.items);
  const groupedCartError = hasGroupedCartMetadata ? validateGroupedCartQuantities(normalizedItems) : null;

  if (groupedCartError) {
    return NextResponse.json({ error: groupedCartError }, { status: 400 });
  }

  const aggregatedItems = Array.from(
    normalizedItems
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
  const requestHash = buildCheckoutRequestHash({
    ...input,
    items: normalizedItems
  });

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

  async function finishCheckoutForOrder(
    orderRow: CreatedOrderRow,
    preparedPayment?: PreparedCheckoutPayment
  ) {
    try {
      const payment = await checkoutTimer.measure("payment_initiation", () => {
        const options = { requestOrigin: resolveSiteOrigin(req.url) };
        return preparedPayment
          ? initiatePreparedOrderPayment(preparedPayment, options)
          : initiateOrderPaymentForOrder(orderRow.public_token, options);
      });
      await checkoutTimer.measure("checkout_session", async () => {
        const guestDevice = await ensureGuestDeviceSession();
        await setOrderAccessCookie({
          orderId: orderRow.id,
          publicToken: orderRow.public_token,
          deviceId: guestDevice.deviceId
        });
      });

      const result: OrderResult = {
        public_token: orderRow.public_token,
        order_number: orderRow.order_number,
        pickup_code: orderRow.pickup_code,
        payment_status: payment.paymentStatus,
        redirect_url: payment.redirectUrl
      };
      checkoutTimer.log("redirect_ready", orderRow.id);
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
        checkoutTimer.log("provider_rejected", orderRow.id);
        return NextResponse.json(result);
      }

      console.error("storefront_payment_initiation_failed", {
        publicToken: orderRow.public_token,
        error: paymentError instanceof Error ? paymentError.message : "unknown error"
      });

      await markReservation("failed", undefined, paymentError instanceof Error ? paymentError.message : "unknown_error");
      checkoutTimer.log("payment_initiation_failed", orderRow.id);
      return NextResponse.json({ error: "Unable to initiate payment." }, { status: 500 });
    }
  }

  // Return early for cached or in-flight reservations — no rate limit consumed.
  if (idempotencyKey) {
    const { data: existing } = await checkoutTimer.measure("reservation_lookup", () =>
      supabase
        .from("checkout_reservations")
        .select("status,result_json,expires_at,request_hash,order_id,public_token,order_number,pickup_code")
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle()
    );

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
          checkoutTimer.log("idempotent_result_reused", row.order_id);
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

  const checkoutRateLimits = await checkoutTimer.measure("rate_limits", () =>
    enforceStorefrontCheckoutRateLimits(req, input.phone)
  );
  if (!checkoutRateLimits.route.allowed) {
    checkoutTimer.log("route_rate_limited");
    return tooManyRequests(checkoutRateLimits.route.retryAfterSeconds);
  }

  if (!checkoutRateLimits.phone.allowed) {
    checkoutTimer.log("phone_rate_limited");
    return NextResponse.json(
      { error: "Too many orders for this phone number. Please wait before retrying." },
      { status: 429, headers: { "Retry-After": String(checkoutRateLimits.phone.retryAfterSeconds) } }
    );
  }

  const promisedAt = pickupSelectionToPromisedAt(input.pickup_time);
  const serviceDate = getUgandaServiceDate(promisedAt ? new Date(promisedAt) : new Date());

  const { data: menuItems, error: menuError } = await checkoutTimer.measure("menu_stock", () =>
    supabase.rpc("get_storefront_menu", {
      p_service_date: serviceDate
    })
  );

  if (menuError || !menuItems) {
    return NextResponse.json({ error: "Could not validate menu items" }, { status: 500 });
  }

  const safeMenuItems = menuItems as unknown as CheckoutMenuRow[];
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

    if (!isPubliclyAvailableOnServiceDate(dbItem.name, serviceDate)) {
      return NextResponse.json({ error: "Oxtail and goat ribs are available Friday through Sunday only." }, { status: 400 });
    }

    const availableQuantity = Math.max(0, Number(dbItem.available_quantity ?? 0));

    if (availableQuantity <= 0) {
      return NextResponse.json({ error: `${dbItem.name} is out of stock` }, { status: 400 });
    }

    if (item.qty > availableQuantity) {
      return NextResponse.json({ error: `Only ${availableQuantity} ${dbItem.name} left` }, { status: 400 });
    }

    total += dbItem.base_price * item.qty;
  }

  for (const item of normalizedItems) {
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

  // Create the order, grouped items, idempotency binding, and initiating payment
  // attempt in one transaction. Retry on generated identifier conflicts only.
  const guestDevice = await ensureGuestDeviceSession();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const publicToken = generatePublicToken();
    const pickupCode = generatePickupCode();
    const { data: rpcData, error: rpcError } = await checkoutTimer.measure("checkout_prepare", () =>
      supabase.rpc("prepare_storefront_checkout_payment", {
        p_idempotency_key: idempotencyKey,
        p_request_hash: idempotencyKey ? requestHash : null,
        p_public_token: publicToken,
        p_pickup_code: pickupCode,
        p_device_id: guestDevice.deviceId,
        p_customer_name: input.name,
        p_customer_phone: input.phone,
        p_notes: input.notes || null,
        p_service_date: serviceDate,
        p_promised_at: promisedAt,
        p_total_amount: total,
        p_items: orderItemsToInsert
      })
    );

    if (rpcError) {
      if (rpcError.code === "23505") continue; // public_token collision, retry

      if (idempotencyKey && rpcError.message?.includes("checkout_reservation_conflict")) {
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
          checkoutTimer.log("concurrent_result_reused", concurrentRow.order_id);
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

        checkoutTimer.log("concurrent_checkout_in_progress", concurrentRow?.order_id);
        return NextResponse.json(
          { error: "Your order is already being processed. Please wait." },
          { status: 409 }
        );
      }

      if (
        rpcError.message?.includes("payment_status") ||
        rpcError.message?.includes("service_date") ||
        rpcError.message?.includes("public_token") ||
        rpcError.message?.includes("pickup_code") ||
        rpcError.message?.includes("prepare_storefront_checkout_payment") ||
        rpcError.message?.includes("payment_attempts") ||
        rpcError.code === "PGRST202"
      ) {
        await markReservation("failed");
        return NextResponse.json(
          { error: "Storefront checkout optimization is not applied in Supabase yet. Run Phase 59 and try again." },
          { status: 500 }
        );
      }

      await markReservation("failed");
      return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
    }

    const rows = rpcData as unknown as PreparedCheckoutRpcRow[];
    const preparedRow = rows?.[0];

    if (!preparedRow) {
      await markReservation("failed");
      return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
    }

    return finishCheckoutForOrder(
      {
        id: preparedRow.id,
        order_number: preparedRow.order_number,
        public_token: preparedRow.public_token,
        pickup_code: preparedRow.pickup_code
      },
      {
        orderId: preparedRow.id,
        orderNumber: preparedRow.order_number,
        publicToken: preparedRow.public_token,
        pickupCode: preparedRow.pickup_code,
        customerName: preparedRow.customer_name,
        customerPhone: preparedRow.customer_phone,
        totalAmount: preparedRow.total_amount,
        paymentAttemptId: preparedRow.payment_attempt_id
      }
    );
  }

  await markReservation("failed");
  return NextResponse.json({ error: "Could not generate secure order token" }, { status: 500 });
}
