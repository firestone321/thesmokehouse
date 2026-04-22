import { getSupabaseAdmin } from "@/lib/supabase";
import {
  getPesapalTransactionStatus,
  isPesapalInitiationRejectedError,
  submitPesapalOrderRequest
} from "@/lib/payments/pesapal";

type PaymentStatus = "pending" | "paid" | "failed" | "cancelled";
type PaymentViewState = "success" | "failed" | "cancelled" | "pending";

type OrderPaymentRow = {
  id: number;
  order_number: string;
  public_token: string;
  pickup_code: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  status: string;
  payment_status: string | null;
  total_amount: number;
  promised_at: string | null;
  payment_provider: string | null;
  payment_reference: string | null;
  payment_redirect_url: string | null;
  order_tracking_id: string | null;
  payment_last_verified_at: string | null;
  paid_at: string | null;
  payment_initiation_failure_code: string | null;
  payment_initiation_failure_message: string | null;
  payment_initiation_failed_at: string | null;
  active_payment_attempt_id: number | null;
  stock_reserved_at: string | null;
  order_items: Array<{
    id: number;
    menu_item_id: number;
    menu_item_name: string;
    quantity: number;
    unit_price: number;
  }> | null;
};

type PaymentAttemptRow = {
  id: number;
  attempt_number: number;
};

export type OrderPaymentSnapshot = {
  publicToken: string;
  orderNumber: string;
  customerName: string;
  orderStatus: string;
  pickupCode: string | null;
  totalUGX: number;
  paymentStatus: PaymentStatus;
  viewState: PaymentViewState;
  verified: boolean;
  items: Array<{
    name: string;
    quantity: number;
  }>;
};

function normalizeStoredPaymentStatus(paymentStatus: string | null | undefined): PaymentStatus {
  const normalized = paymentStatus?.trim().toLowerCase();

  if (!normalized || normalized === "unpaid") {
    return "pending";
  }

  if (normalized === "paid" || normalized === "completed") {
    return "paid";
  }

  if (normalized === "failed" || normalized === "payment_failed" || normalized === "reversed") {
    return "failed";
  }

  if (normalized === "cancelled" || normalized === "canceled") {
    return "cancelled";
  }

  return "pending";
}

function mapViewState(paymentStatus: PaymentStatus, hint?: "cancelled" | "pending"): PaymentViewState {
  if (paymentStatus === "paid") return "success";
  if (paymentStatus === "failed") return "failed";
  if (paymentStatus === "cancelled" || hint === "cancelled") return "cancelled";
  return "pending";
}

async function getOrderPaymentRow(publicToken: string): Promise<OrderPaymentRow | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("orders")
    .select(
      `
      id,
      order_number,
      public_token,
      pickup_code,
      customer_name,
      customer_phone,
      status,
      payment_status,
      total_amount,
      promised_at,
      payment_provider,
      payment_reference,
      payment_redirect_url,
      order_tracking_id,
      payment_last_verified_at,
      paid_at,
      payment_initiation_failure_code,
      payment_initiation_failure_message,
      payment_initiation_failed_at,
      active_payment_attempt_id,
      stock_reserved_at,
      order_items (
        id,
        menu_item_id,
        menu_item_name,
        quantity,
        unit_price
      )
    `
    )
    .eq("public_token", publicToken)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load order payment details: ${error.message}`);
  }

  return (data as OrderPaymentRow | null) ?? null;
}

function buildSnapshot(row: OrderPaymentRow, options?: { verified?: boolean; hint?: "cancelled" | "pending" }): OrderPaymentSnapshot {
  const paymentStatus = normalizeStoredPaymentStatus(row.payment_status);

  return {
    publicToken: row.public_token,
    orderNumber: row.order_number,
    customerName: row.customer_name ?? "Customer",
    orderStatus: row.status,
    pickupCode: row.pickup_code ?? null,
    totalUGX: row.total_amount,
    paymentStatus,
    viewState: mapViewState(paymentStatus, options?.hint),
    verified: options?.verified ?? paymentStatus === "paid",
    items: (row.order_items ?? []).map((item) => ({
      name: item.menu_item_name,
      quantity: item.quantity
    }))
  };
}

async function getNextAttemptNumber(orderId: number) {
  const { data, error } = await getSupabaseAdmin()
    .from("payment_attempts")
    .select("attempt_number")
    .eq("order_id", orderId)
    .order("attempt_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load payment attempts: ${error.message}`);
  }

  return Number(data?.attempt_number ?? 0) + 1;
}

async function createPaymentAttempt(input: {
  orderId: number;
  lifecycleStatus: "initiating" | "initiated" | "rejected" | "failed";
  paymentStatus: PaymentStatus;
  providerReference?: string | null;
  redirectUrl?: string | null;
  providerStatus?: string | null;
  providerMessage?: string | null;
  paymentReference?: string | null;
  rawResponse?: unknown;
}): Promise<PaymentAttemptRow> {
  const attemptNumber = await getNextAttemptNumber(input.orderId);
  const { data, error } = await getSupabaseAdmin()
    .from("payment_attempts")
    .insert({
      order_id: input.orderId,
      provider: "pesapal",
      attempt_number: attemptNumber,
      lifecycle_status: input.lifecycleStatus,
      payment_status: input.paymentStatus,
      provider_reference: input.providerReference ?? null,
      redirect_url: input.redirectUrl ?? null,
      provider_status: input.providerStatus ?? null,
      provider_message: input.providerMessage ?? null,
      payment_reference: input.paymentReference ?? null,
      raw_response: input.rawResponse ?? null
    })
    .select("id, attempt_number")
    .single();

  if (error || !data) {
    throw new Error(`Unable to create payment attempt: ${error?.message ?? "Unknown error"}`);
  }

  await getSupabaseAdmin()
    .from("orders")
    .update({ active_payment_attempt_id: data.id })
    .eq("id", input.orderId);

  return data as PaymentAttemptRow;
}

async function updateActivePaymentAttempt(order: OrderPaymentRow, input: {
  lifecycleStatus?: "initiating" | "initiated" | "rejected" | "failed";
  paymentStatus?: PaymentStatus;
  providerReference?: string | null;
  redirectUrl?: string | null;
  providerStatus?: string | null;
  providerMessage?: string | null;
  paymentReference?: string | null;
  rawResponse?: unknown;
}) {
  if (!order.active_payment_attempt_id) {
    return;
  }

  const payload: Record<string, unknown> = {};
  if (input.lifecycleStatus !== undefined) payload.lifecycle_status = input.lifecycleStatus;
  if (input.paymentStatus !== undefined) payload.payment_status = input.paymentStatus;
  if (input.providerReference !== undefined) payload.provider_reference = input.providerReference;
  if (input.redirectUrl !== undefined) payload.redirect_url = input.redirectUrl;
  if (input.providerStatus !== undefined) payload.provider_status = input.providerStatus;
  if (input.providerMessage !== undefined) payload.provider_message = input.providerMessage;
  if (input.paymentReference !== undefined) payload.payment_reference = input.paymentReference;
  if (input.rawResponse !== undefined) payload.raw_response = input.rawResponse;
  if (input.paymentStatus === "paid") payload.verified_at = new Date().toISOString();

  if (Object.keys(payload).length === 0) {
    return;
  }

  await getSupabaseAdmin().from("payment_attempts").update(payload).eq("id", order.active_payment_attempt_id);
}

export async function initiateOrderPaymentForOrder(publicToken: string, options: { requestOrigin: string }) {
  const row = await getOrderPaymentRow(publicToken);
  if (!row) {
    throw new Error("Order not found.");
  }

  const paymentStatus = normalizeStoredPaymentStatus(row.payment_status);
  if (paymentStatus === "paid") {
    throw new Error("Order has already been paid.");
  }

  if (paymentStatus === "cancelled") {
    throw new Error("Order payment has been cancelled.");
  }

  if (row.order_tracking_id && row.payment_redirect_url && paymentStatus === "pending") {
    return {
      publicToken: row.public_token,
      redirectUrl: row.payment_redirect_url,
      paymentStatus
    };
  }

  await createPaymentAttempt({
    orderId: row.id,
    lifecycleStatus: "initiating",
    paymentStatus: "pending"
  });

  const response = await submitPesapalOrderRequest({
    publicToken: row.public_token,
    amountUGX: row.total_amount,
    description: `Smokehouse order ${row.order_number}`,
    customerName: row.customer_name ?? "Customer",
    phone: row.customer_phone ?? null,
    requestOrigin: options.requestOrigin
  });

  const activeAttempt = await createPaymentAttempt({
    orderId: row.id,
    lifecycleStatus: "initiated",
    paymentStatus: "pending",
    providerReference: response.order_tracking_id ?? null,
    redirectUrl: response.redirect_url ?? null,
    providerStatus: response.status ?? null,
    providerMessage: response.message ?? null,
    rawResponse: response
  });

  const { error } = await getSupabaseAdmin()
    .from("orders")
    .update({
      payment_status: "pending",
      payment_provider: "pesapal",
      order_tracking_id: response.order_tracking_id ?? null,
      payment_redirect_url: response.redirect_url ?? null,
      payment_initiation_failure_code: null,
      payment_initiation_failure_message: null,
      payment_initiation_failed_at: null,
      active_payment_attempt_id: activeAttempt.id
    })
    .eq("id", row.id);

  if (error) {
    throw new Error(`Unable to save payment initiation: ${error.message}`);
  }

  return {
    publicToken: row.public_token,
    redirectUrl: response.redirect_url ?? null,
    paymentStatus: "pending" as const
  };
}

export async function cancelRejectedOrderPaymentInitiation(input: {
  publicToken: string;
  reasonCode?: string | null;
  reasonMessage: string;
}) {
  const row = await getOrderPaymentRow(input.publicToken);
  if (!row) {
    throw new Error("Order not found.");
  }

  const paymentStatus = normalizeStoredPaymentStatus(row.payment_status);
  if (
    paymentStatus !== "pending" ||
    row.status !== "new" ||
    row.order_tracking_id ||
    row.payment_redirect_url ||
    row.stock_reserved_at
  ) {
    return null;
  }

  await updateActivePaymentAttempt(row, {
    lifecycleStatus: "rejected",
    paymentStatus: "cancelled",
    providerMessage: input.reasonMessage
  });

  const { data, error } = await getSupabaseAdmin()
    .from("orders")
    .update({
      status: "cancelled",
      payment_status: "cancelled",
      payment_provider: "pesapal",
      payment_initiation_failure_code: input.reasonCode?.trim() || null,
      payment_initiation_failure_message: input.reasonMessage.trim(),
      payment_initiation_failed_at: new Date().toISOString()
    })
    .eq("id", row.id)
    .select(
      `
      id,
      order_number,
      public_token,
      pickup_code,
      customer_name,
      customer_phone,
      status,
      payment_status,
      total_amount,
      promised_at,
      payment_provider,
      payment_reference,
      payment_redirect_url,
      order_tracking_id,
      payment_last_verified_at,
      paid_at,
      payment_initiation_failure_code,
      payment_initiation_failure_message,
      payment_initiation_failed_at,
      active_payment_attempt_id,
      stock_reserved_at,
      order_items (
        id,
        menu_item_id,
        menu_item_name,
        quantity,
        unit_price
      )
    `
    )
    .single();

  if (error || !data) {
    throw new Error(`Unable to cancel rejected payment initiation: ${error?.message ?? "Unknown error"}`);
  }

  return buildSnapshot(data as OrderPaymentRow, { hint: "cancelled" });
}

export async function markOrderPaymentCancelled(publicToken: string) {
  const row = await getOrderPaymentRow(publicToken);
  if (!row) {
    throw new Error("Order not found.");
  }

  if (normalizeStoredPaymentStatus(row.payment_status) === "paid") {
    return buildSnapshot(row, { verified: true });
  }

  await updateActivePaymentAttempt(row, {
    paymentStatus: "cancelled",
    lifecycleStatus: "failed"
  });

  const { error } = await getSupabaseAdmin()
    .from("orders")
    .update({
      status: row.stock_reserved_at ? row.status : "cancelled",
      payment_status: "cancelled",
      payment_last_verified_at: new Date().toISOString()
    })
    .eq("id", row.id);

  if (error) {
    throw new Error(`Unable to cancel payment: ${error.message}`);
  }

  const refreshed = await getOrderPaymentRow(publicToken);
  if (!refreshed) {
    throw new Error("Order not found.");
  }

  return buildSnapshot(refreshed, { hint: "cancelled" });
}

export async function syncPesapalPaymentForOrder(input: {
  publicToken: string;
  orderTrackingId?: string | null;
}) {
  const row = await getOrderPaymentRow(input.publicToken);
  if (!row) {
    throw new Error("Order not found.");
  }

  const trackingId = input.orderTrackingId ?? row.order_tracking_id;
  if (!trackingId) {
    return buildSnapshot(row);
  }

  const status = await getPesapalTransactionStatus(trackingId);

  if (status.paymentStatus === "paid") {
    const { error } = await getSupabaseAdmin().rpc("mark_order_as_paid", {
      p_order_id: row.id,
      p_payment_provider: "pesapal",
      p_order_tracking_id: trackingId,
      p_payment_reference: status.paymentReference,
      p_payment_redirect_url: row.payment_redirect_url,
      p_note: "Payment verified through Pesapal."
    });

    if (error) {
      throw new Error(`Unable to mark order as paid: ${error.message}`);
    }
  } else {
    const { error } = await getSupabaseAdmin()
      .from("orders")
      .update({
        payment_status: status.paymentStatus,
        payment_provider: "pesapal",
        order_tracking_id: trackingId,
        payment_reference: status.paymentReference,
        payment_last_verified_at: new Date().toISOString()
      })
      .eq("id", row.id);

    if (error) {
      throw new Error(`Unable to persist payment verification: ${error.message}`);
    }
  }

  await updateActivePaymentAttempt(row, {
    paymentStatus: status.paymentStatus === "paid" ? "paid" : status.paymentStatus,
    lifecycleStatus: status.paymentStatus === "paid" ? "initiated" : "failed",
    providerReference: trackingId,
    providerStatus: status.providerStatus,
    paymentReference: status.paymentReference,
    rawResponse: status.rawResponse
  });

  const refreshed = await getOrderPaymentRow(input.publicToken);
  if (!refreshed) {
    throw new Error("Order not found.");
  }

  return buildSnapshot(refreshed, { verified: normalizeStoredPaymentStatus(refreshed.payment_status) === "paid" });
}

export async function getOrderPaymentSnapshot(
  publicToken: string,
  options?: {
    refresh?: boolean;
    hint?: "cancelled" | "pending";
  }
) {
  let row = await getOrderPaymentRow(publicToken);
  if (!row) {
    throw new Error("Order not found.");
  }

  if (options?.refresh !== false && row.order_tracking_id && normalizeStoredPaymentStatus(row.payment_status) === "pending") {
    await syncPesapalPaymentForOrder({
      publicToken,
      orderTrackingId: row.order_tracking_id
    });

    row = await getOrderPaymentRow(publicToken);
    if (!row) {
      throw new Error("Order not found.");
    }
  }

  return buildSnapshot(row, {
    hint: options?.hint
  });
}

export { isPesapalInitiationRejectedError };
