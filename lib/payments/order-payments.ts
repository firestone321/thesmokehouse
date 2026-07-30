import { randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase";
import { toKampalaDateTimeString } from "@/lib/format";
import {
  cancelPesapalOrder,
  getPesapalTransactionStatus,
  isPesapalInitiationRejectedError,
  submitPesapalOrderRequest
} from "@/lib/payments/pesapal";
import {
  assertCompletedPesapalBinding,
  assertPesapalTrackingBinding,
  assertSupabaseWriteSucceeded,
  normalizePesapalProviderStatus,
  shouldExhaustInvalidRecovery
} from "@/lib/payments/pesapal-integrity";

type PaymentStatus = "pending" | "paid" | "failed" | "cancelled";
type PaymentViewState = "success" | "failed" | "cancelled" | "pending";

type OrderPaymentRow = {
  id: number;
  order_number: string;
  public_token: string;
  created_at: string;
  updated_at: string;
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

export type PreparedCheckoutPayment = {
  orderId: number;
  orderNumber: string;
  publicToken: string;
  pickupCode: string | null;
  customerName: string | null;
  customerPhone: string | null;
  totalAmount: number;
  paymentAttemptId: number;
};

type BeginStorefrontPaymentAttemptRow = {
  id: number;
  order_number: string;
  public_token: string;
  pickup_code: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  total_amount: number;
  payment_attempt_id: number | null;
  payment_status: string;
  payment_redirect_url: string | null;
  reused: boolean;
};

type PendingPaymentRecoveryRow = {
  id: number;
  order_id: number;
  provider: string;
  order_tracking_id: string;
  status: string;
  attempt_count: number;
  max_attempts: number;
};

type PaymentAttemptBindingRow = {
  id: number;
  order_id: number;
  provider: string;
  provider_reference: string | null;
  payment_status: string;
  created_at: string;
};

const PENDING_PAYMENT_RECOVERY_SOFT_CANCEL_MS = 7 * 60_000;
const PENDING_PAYMENT_RECOVERY_VERIFY_THROTTLE_MS = 5 * 60_000;
const PENDING_PAYMENT_RECOVERY_SCAN_LIMIT = 50;
const PENDING_PAYMENT_RECOVERY_PROCESS_LIMIT = 5;
const PENDING_PAYMENT_RECOVERY_MAX_BACKOFF_MS = 15 * 60_000;
const PENDING_PAYMENT_RECOVERY_MIN_BACKOFF_MS = 30_000;
const PENDING_PAYMENT_RECOVERY_INVALID_MAX_ATTEMPTS = 3;

let pendingPaymentRecoveryPromise: Promise<PendingPaymentRecoveryStats> | null = null;

export type PendingPaymentRecoveryStats = {
  trigger: string;
  trackedScanned: number;
  trackedClaimed: number;
  trackedVerified: number;
  trackedCancelled: number;
  trackedCompleted: number;
  trackedRescheduled: number;
  trackedFailed: number;
  errors: string[];
};

export type OrderPaymentSnapshot = {
  orderId: number;
  publicToken: string;
  orderNumber: string;
  customerName: string;
  createdAt: string;
  createdAtEat: string;
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
      created_at,
      updated_at,
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

async function getOrderPaymentRowById(orderId: number): Promise<OrderPaymentRow | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("orders")
    .select(
      `
      id,
      order_number,
      public_token,
      created_at,
      updated_at,
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
    .eq("id", orderId)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load order payment details: ${error.message}`);
  }

  return (data as OrderPaymentRow | null) ?? null;
}

function buildSnapshot(row: OrderPaymentRow, options?: { verified?: boolean; hint?: "cancelled" | "pending" }): OrderPaymentSnapshot {
  const paymentStatus = normalizeStoredPaymentStatus(row.payment_status);

  return {
    orderId: row.id,
    publicToken: row.public_token,
    orderNumber: row.order_number,
    customerName: row.customer_name ?? "Customer",
    createdAt: row.created_at,
    createdAtEat: toKampalaDateTimeString(row.created_at),
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

async function getActivePaymentAttempt(order: OrderPaymentRow): Promise<PaymentAttemptBindingRow> {
  if (!order.active_payment_attempt_id) {
    throw new Error("Order does not have an active payment attempt.");
  }

  const { data, error } = await getSupabaseAdmin()
    .from("payment_attempts")
    .select("id,order_id,provider,provider_reference,payment_status,created_at")
    .eq("id", order.active_payment_attempt_id)
    .eq("order_id", order.id)
    .eq("provider", "pesapal")
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load the active payment attempt: ${error.message}`);
  }

  if (!data) {
    throw new Error("The active Pesapal payment attempt was not found.");
  }

  return data as PaymentAttemptBindingRow;
}

function buildPaymentRecoveryWorkerId(trigger: string) {
  return `${trigger}:${randomUUID()}`;
}

function getPaymentRecoveryBackoffMs(attemptCount: number) {
  const delayMs = Math.max(PENDING_PAYMENT_RECOVERY_MIN_BACKOFF_MS, attemptCount * 60_000);
  return Math.min(delayMs, PENDING_PAYMENT_RECOVERY_MAX_BACKOFF_MS);
}

async function enqueuePendingPaymentRecovery(input: {
  orderId: number;
  orderTrackingId?: string | null;
  reason?: string | null;
}) {
  const orderTrackingId = input.orderTrackingId?.trim();
  if (!orderTrackingId) {
    return null;
  }

  const { data, error } = await getSupabaseAdmin().rpc("enqueue_pending_payment_recovery", {
    p_order_id: input.orderId,
    p_order_tracking_id: orderTrackingId,
    p_provider: "pesapal",
    p_reason: input.reason ?? null
  });

  if (error) {
    throw new Error(`Unable to enqueue pending payment recovery: ${error.message}`);
  }

  return data;
}

async function enqueuePendingPaymentRecoverySafely(input: {
  orderId: number;
  orderTrackingId?: string | null;
  reason?: string | null;
}) {
  try {
    await enqueuePendingPaymentRecovery(input);
  } catch (error) {
    console.error("pending_payment_recovery_enqueue_failed", {
      orderId: input.orderId,
      orderTrackingId: input.orderTrackingId ?? null,
      error: error instanceof Error ? error.message : "unknown_error"
    });
  }
}

async function enqueueDueTrackedPendingPaymentsForRecovery(limit = PENDING_PAYMENT_RECOVERY_SCAN_LIMIT) {
  const normalizedLimit = Math.max(1, Math.min(limit, 200));
  const { data, error } = await getSupabaseAdmin()
    .from("orders")
    .select("id, order_tracking_id, payment_last_verified_at")
    .not("order_tracking_id", "is", null)
    .or("payment_status.is.null,payment_status.eq.unpaid,payment_status.eq.pending,payment_status.eq.cancelled,payment_status.eq.canceled")
    .order("created_at", { ascending: true })
    .limit(normalizedLimit);

  if (error) {
    throw new Error(`Unable to list tracked pending payments for recovery: ${error.message}`);
  }

  const nowMs = Date.now();
  let enqueued = 0;
  for (const row of (data ?? []) as Array<{ id: number; order_tracking_id: string | null; payment_last_verified_at: string | null }>) {
    if (
      row.order_tracking_id &&
      isOlderThan(row.payment_last_verified_at, PENDING_PAYMENT_RECOVERY_VERIFY_THROTTLE_MS, nowMs)
    ) {
      await enqueuePendingPaymentRecovery({
        orderId: row.id,
        orderTrackingId: row.order_tracking_id,
        reason: "Pending tracked payment found during recovery scan."
      });
      enqueued += 1;
    }
  }

  return enqueued;
}

async function claimPendingPaymentRecoveries(input: {
  trigger: string;
  limit?: number;
  orderId?: number | null;
}) {
  const { data, error } = await getSupabaseAdmin().rpc("claim_pending_payment_recoveries", {
    p_limit: Math.max(1, Math.min(input.limit ?? PENDING_PAYMENT_RECOVERY_PROCESS_LIMIT, 25)),
    p_worker_id: buildPaymentRecoveryWorkerId(input.trigger),
    p_order_id: input.orderId ?? null
  });

  if (error) {
    throw new Error(`Unable to claim pending payment recoveries: ${error.message}`);
  }

  return ((data ?? []) as PendingPaymentRecoveryRow[]).filter((row) => row.order_tracking_id);
}

async function completePendingPaymentRecovery(id: number) {
  const { error } = await getSupabaseAdmin()
    .from("pending_payment_recoveries")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      last_verified_at: new Date().toISOString(),
      locked_at: null,
      locked_by: null,
      last_error: null
    })
    .eq("id", id);

  if (error) {
    throw new Error(`Unable to complete pending payment recovery: ${error.message}`);
  }
}

async function completePendingPaymentRecoveryByTracking(orderTrackingId: string) {
  const { error } = await getSupabaseAdmin()
    .from("pending_payment_recoveries")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      last_verified_at: new Date().toISOString(),
      locked_at: null,
      locked_by: null,
      last_error: null
    })
    .eq("provider", "pesapal")
    .eq("order_tracking_id", orderTrackingId);

  if (error) {
    console.error("pending_payment_recovery_complete_by_tracking_failed", {
      orderTrackingId,
      error: error.message
    });
  }
}

async function reschedulePendingPaymentRecovery(row: PendingPaymentRecoveryRow, message: string) {
  const exhausted = row.attempt_count >= row.max_attempts;
  const nextAttemptAt = new Date(Date.now() + getPaymentRecoveryBackoffMs(row.attempt_count)).toISOString();
  const { error } = await getSupabaseAdmin()
    .from("pending_payment_recoveries")
    .update({
      status: exhausted ? "failed" : "retrying",
      next_attempt_at: exhausted ? new Date().toISOString() : nextAttemptAt,
      last_verified_at: new Date().toISOString(),
      locked_at: null,
      locked_by: null,
      last_error: message
    })
    .eq("id", row.id);

  if (error) {
    throw new Error(`Unable to reschedule pending payment recovery: ${error.message}`);
  }
}

async function submitAndFinalizePreparedOrderPayment(
  row: PreparedCheckoutPayment,
  options: { requestOrigin: string }
) {
  const response = await submitPesapalOrderRequest({
    publicToken: row.publicToken,
    amountUGX: row.totalAmount,
    description: `Smokehouse order ${row.orderNumber}`,
    customerName: row.customerName ?? "Customer",
    phone: row.customerPhone ?? null,
    requestOrigin: options.requestOrigin
  });

  if (!response.order_tracking_id || !response.redirect_url) {
    throw new Error("Pesapal order request did not return durable redirect details.");
  }

  const { error } = await getSupabaseAdmin().rpc("finalize_storefront_payment_initiation", {
    p_public_token: row.publicToken,
    p_payment_attempt_id: row.paymentAttemptId,
    p_provider_reference: response.order_tracking_id,
    p_redirect_url: response.redirect_url,
    p_provider_status: response.status ?? null,
    p_provider_message: response.message ?? null,
    p_raw_response: response
  });

  if (error) {
    throw new Error(`Unable to finalize payment initiation: ${error.message}`);
  }

  return {
    publicToken: row.publicToken,
    redirectUrl: response.redirect_url,
    paymentStatus: "pending" as const
  };
}

export async function initiatePreparedOrderPayment(
  row: PreparedCheckoutPayment,
  options: { requestOrigin: string }
) {
  return submitAndFinalizePreparedOrderPayment(row, options);
}

export async function initiateOrderPaymentForOrder(publicToken: string, options: { requestOrigin: string }) {
  const { data, error } = await getSupabaseAdmin().rpc("begin_storefront_payment_attempt", {
    p_public_token: publicToken
  });

  if (error) {
    if (error.message?.includes("order_not_found")) {
      throw new Error("Order not found.");
    }
    if (error.message?.includes("order_already_paid")) {
      throw new Error("Order has already been paid.");
    }
    if (error.message?.includes("order_payment_cancelled")) {
      throw new Error("Order payment has been cancelled.");
    }
    throw new Error(`Unable to begin payment initiation: ${error.message}`);
  }

  const rows = data as unknown as BeginStorefrontPaymentAttemptRow[] | null;
  const row = rows?.[0];
  if (!row) {
    throw new Error("Unable to begin payment initiation.");
  }

  if (row.reused && row.payment_redirect_url) {
    return {
      publicToken: row.public_token,
      redirectUrl: row.payment_redirect_url,
      paymentStatus: normalizeStoredPaymentStatus(row.payment_status)
    };
  }

  if (!row.payment_attempt_id) {
    throw new Error("Payment attempt was not created.");
  }

  return submitAndFinalizePreparedOrderPayment(
    {
      orderId: row.id,
      orderNumber: row.order_number,
      publicToken: row.public_token,
      pickupCode: row.pickup_code,
      customerName: row.customer_name,
      customerPhone: row.customer_phone,
      totalAmount: row.total_amount,
      paymentAttemptId: row.payment_attempt_id
    },
    options
  );
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

  const { data, error } = await getSupabaseAdmin().rpc("reject_storefront_payment_initiation", {
    p_public_token: input.publicToken,
    p_payment_attempt_id: row.active_payment_attempt_id,
    p_reason_code: input.reasonCode?.trim() || null,
    p_reason_message: input.reasonMessage.trim()
  });
  assertSupabaseWriteSucceeded(error, "Unable to cancel rejected payment initiation");

  if (!data) {
    return null;
  }

  const refreshed = await getOrderPaymentRow(input.publicToken);
  return refreshed ? buildSnapshot(refreshed, { hint: "cancelled" }) : null;
}

async function applyPesapalVerification(input: {
  row: OrderPaymentRow;
  attempt: PaymentAttemptBindingRow;
  trackingId: string;
  providerStatus: string;
  providerTrackingId: string | null;
  merchantReference: string | null;
  amount: string | number | null;
  currency: string | null;
  paymentReference: string | null;
  rawResponse: unknown;
  cancellationConfirmed?: boolean;
}) {
  const { error } = await getSupabaseAdmin().rpc("apply_pesapal_payment_verification", {
    p_order_id: input.row.id,
    p_payment_attempt_id: input.attempt.id,
    p_supplied_tracking_id: input.trackingId,
    p_provider_tracking_id: input.providerTrackingId,
    p_merchant_reference: input.merchantReference,
    p_provider_amount: input.amount,
    p_provider_currency: input.currency,
    p_provider_status: input.providerStatus,
    p_payment_reference: input.paymentReference,
    p_raw_response: input.rawResponse,
    p_cancellation_confirmed: input.cancellationConfirmed ?? false
  });

  assertSupabaseWriteSucceeded(error, "Unable to persist the Pesapal payment verification");
}

async function verifyPesapalPaymentForOrder(input: {
  publicToken: string;
  orderTrackingId?: string | null;
  merchantReference?: string | null;
}) {
  const row = await getOrderPaymentRow(input.publicToken);
  if (!row) {
    throw new Error("Order not found.");
  }

  if (input.merchantReference && input.merchantReference !== row.public_token) {
    throw new Error("The supplied merchant reference does not match the order.");
  }

  const attempt = await getActivePaymentAttempt(row);
  const trackingId = input.orderTrackingId ?? row.order_tracking_id;
  if (!trackingId) {
    return {
      snapshot: buildSnapshot(row),
      providerPaymentStatus: null as PaymentStatus | null,
      providerStatus: null,
      attempt
    };
  }

  if (
    row.order_tracking_id !== trackingId
    || attempt.provider_reference !== trackingId
  ) {
    throw new Error("The supplied Pesapal tracking ID does not match the active payment attempt.");
  }

  await enqueuePendingPaymentRecoverySafely({
    orderId: row.id,
    orderTrackingId: trackingId,
    reason: "Payment verification observed a tracked pending payment."
  });

  const status = await getPesapalTransactionStatus(trackingId);
  const binding = {
    publicToken: row.public_token,
    expectedAmountUGX: row.total_amount,
    orderTrackingId: row.order_tracking_id,
    attemptTrackingId: attempt.provider_reference
  };
  const verified = {
    suppliedTrackingId: trackingId,
    providerTrackingId: status.providerOrderTrackingId,
    merchantReference: status.merchantReference,
    amount: status.amount,
    currency: status.currency,
    providerStatus: status.providerStatus
  };

  if (status.paymentStatus === "paid") {
    assertCompletedPesapalBinding(binding, verified);
  } else {
    assertPesapalTrackingBinding(binding, verified);
  }

  await applyPesapalVerification({
    row,
    attempt,
    trackingId,
    providerStatus: normalizePesapalProviderStatus(status.providerStatus),
    providerTrackingId: status.providerOrderTrackingId,
    merchantReference: status.merchantReference,
    amount: status.amount,
    currency: status.currency,
    paymentReference: status.paymentReference,
    rawResponse: status.rawResponse,
    cancellationConfirmed: normalizePesapalProviderStatus(status.providerStatus) === "CANCELLED"
  });

  const refreshed = await getOrderPaymentRow(input.publicToken);
  if (!refreshed) {
    throw new Error("Order not found.");
  }

  const snapshot = buildSnapshot(refreshed, { verified: normalizeStoredPaymentStatus(refreshed.payment_status) === "paid" });
  if (
    status.paymentStatus === "paid"
    || status.paymentStatus === "failed"
    || normalizeStoredPaymentStatus(refreshed.payment_status) === "cancelled"
  ) {
    await completePendingPaymentRecoveryByTracking(trackingId);
  }

  return {
    snapshot,
    providerPaymentStatus: status.paymentStatus,
    providerStatus: normalizePesapalProviderStatus(status.providerStatus),
    attempt
  };
}

export async function syncPesapalPaymentForOrder(input: {
  publicToken: string;
  orderTrackingId?: string | null;
  merchantReference?: string | null;
}) {
  const result = await verifyPesapalPaymentForOrder(input);
  return result.snapshot;
}

export async function markOrderPaymentCancelled(input: {
  publicToken: string;
  orderTrackingId: string;
  merchantReference?: string | null;
}) {
  const verification = await verifyPesapalPaymentForOrder({
    publicToken: input.publicToken,
    orderTrackingId: input.orderTrackingId,
    merchantReference: input.merchantReference ?? input.publicToken
  });

  if (
    verification.snapshot.paymentStatus === "paid"
    || verification.snapshot.paymentStatus === "cancelled"
  ) {
    return verification.snapshot;
  }

  try {
    const cancellation = await cancelPesapalOrder(input.orderTrackingId);
    const row = await getOrderPaymentRow(input.publicToken);
    if (!row) {
      throw new Error("Order not found.");
    }
    const attempt = await getActivePaymentAttempt(row);

    await applyPesapalVerification({
      row,
      attempt,
      trackingId: input.orderTrackingId,
      providerStatus: "CANCELLED",
      providerTrackingId: input.orderTrackingId,
      merchantReference: input.merchantReference ?? input.publicToken,
      amount: null,
      currency: null,
      paymentReference: null,
      rawResponse: cancellation,
      cancellationConfirmed: true
    });
  } catch (cancellationError) {
    const racedVerification = await verifyPesapalPaymentForOrder({
      publicToken: input.publicToken,
      orderTrackingId: input.orderTrackingId,
      merchantReference: input.merchantReference ?? input.publicToken
    });

    if (racedVerification.snapshot.paymentStatus === "paid") {
      return racedVerification.snapshot;
    }

    throw cancellationError;
  }

  const refreshed = await getOrderPaymentRow(input.publicToken);
  if (!refreshed) {
    throw new Error("Order not found.");
  }

  await completePendingPaymentRecoveryByTracking(input.orderTrackingId);
  return buildSnapshot(refreshed, { hint: "cancelled" });
}

function isOlderThan(isoDate: string | null | undefined, thresholdMs: number, nowMs: number) {
  if (!isoDate) {
    return true;
  }

  const valueMs = Date.parse(isoDate);
  if (!Number.isFinite(valueMs)) {
    return true;
  }

  return nowMs - valueMs >= thresholdMs;
}

function isTrackedPendingPaymentExpired(attempt: PaymentAttemptBindingRow, nowMs: number) {
  return isOlderThan(attempt.created_at, PENDING_PAYMENT_RECOVERY_SOFT_CANCEL_MS, nowMs);
}

async function failPendingPaymentRecovery(row: PendingPaymentRecoveryRow, message: string) {
  const { error } = await getSupabaseAdmin()
    .from("pending_payment_recoveries")
    .update({
      status: "failed",
      next_attempt_at: new Date().toISOString(),
      last_verified_at: new Date().toISOString(),
      locked_at: null,
      locked_by: null,
      last_error: message
    })
    .eq("id", row.id);

  if (error) {
    throw new Error(`Unable to fail pending payment recovery: ${error.message}`);
  }
}

async function processClaimedPendingPaymentRecovery(
  row: PendingPaymentRecoveryRow,
  nowMs: number
): Promise<"completed" | "rescheduled" | "cancelled" | "failed"> {
  const order = await getOrderPaymentRowById(row.order_id);
  if (!order) {
    await reschedulePendingPaymentRecovery(row, "Order no longer exists for pending payment recovery.");
    return "rescheduled";
  }

  const storedPaymentStatus = normalizeStoredPaymentStatus(order.payment_status);
  if (storedPaymentStatus === "paid") {
    await completePendingPaymentRecovery(row.id);
    return "completed";
  }

  const orderTrackingId = row.order_tracking_id || order.order_tracking_id;
  if (!orderTrackingId) {
    await reschedulePendingPaymentRecovery(row, "Order does not have a Pesapal tracking ID.");
    return "rescheduled";
  }

  const verification = await verifyPesapalPaymentForOrder({
    publicToken: order.public_token,
    orderTrackingId,
    merchantReference: order.public_token
  });

  const refreshed = await getOrderPaymentRowById(order.id);
  const refreshedPaymentStatus = normalizeStoredPaymentStatus(refreshed?.payment_status);

  if (
    verification.providerPaymentStatus === "paid" ||
    verification.providerPaymentStatus === "failed" ||
    refreshedPaymentStatus === "paid" ||
    refreshedPaymentStatus === "failed"
  ) {
    await completePendingPaymentRecovery(row.id);
    return "completed";
  }

  if (
    verification.providerStatus === "INVALID"
    && shouldExhaustInvalidRecovery(
      row.attempt_count,
      PENDING_PAYMENT_RECOVERY_INVALID_MAX_ATTEMPTS
    )
  ) {
    try {
      const cancelled = await markOrderPaymentCancelled({
        publicToken: order.public_token,
        orderTrackingId,
        merchantReference: order.public_token
      });
      if (cancelled.paymentStatus === "paid") {
        await completePendingPaymentRecovery(row.id);
        return "completed";
      }

      await completePendingPaymentRecovery(row.id);
      return "cancelled";
    } catch (error) {
      await failPendingPaymentRecovery(
        row,
        `Pesapal remained INVALID after ${row.attempt_count} recovery attempts: ${
          error instanceof Error ? error.message : "provider cancellation failed"
        }`
      );
      return "failed";
    }
  }

  if (
    refreshed &&
    refreshed.status === "new" &&
    refreshedPaymentStatus === "pending" &&
    refreshed.order_tracking_id &&
    isTrackedPendingPaymentExpired(verification.attempt, nowMs)
  ) {
    const cancelled = await markOrderPaymentCancelled({
      publicToken: refreshed.public_token,
      orderTrackingId,
      merchantReference: refreshed.public_token
    });

    if (cancelled.paymentStatus === "paid") {
      await completePendingPaymentRecovery(row.id);
      return "completed";
    }

    await completePendingPaymentRecovery(row.id);
    return "cancelled";
  }

  await reschedulePendingPaymentRecovery(row, "Provider still reports pending.");
  return "rescheduled";
}

export async function reconcileDuePendingPayments(
  trigger: string,
  options?: { limit?: number }
): Promise<PendingPaymentRecoveryStats> {
  const nowMs = Date.now();
  const stats: PendingPaymentRecoveryStats = {
    trigger,
    trackedScanned: 0,
    trackedClaimed: 0,
    trackedVerified: 0,
    trackedCancelled: 0,
    trackedCompleted: 0,
    trackedRescheduled: 0,
    trackedFailed: 0,
    errors: []
  };

  try {
    stats.trackedScanned = await enqueueDueTrackedPendingPaymentsForRecovery();
    const claimedRows = await claimPendingPaymentRecoveries({
      trigger,
      limit: options?.limit ?? PENDING_PAYMENT_RECOVERY_PROCESS_LIMIT
    });
    stats.trackedClaimed = claimedRows.length;

    for (const row of claimedRows) {
      try {
        const result = await processClaimedPendingPaymentRecovery(row, nowMs);
        stats.trackedVerified += 1;
        if (result === "completed") {
          stats.trackedCompleted += 1;
        } else if (result === "failed") {
          stats.trackedFailed += 1;
        } else if (result === "cancelled") {
          stats.trackedCancelled += 1;
        } else {
          stats.trackedRescheduled += 1;
        }
      } catch (error) {
        await reschedulePendingPaymentRecovery(
          row,
          error instanceof Error ? error.message : "Unable to recover pending tracked payment."
        ).catch((rescheduleError) => {
          stats.errors.push(
            rescheduleError instanceof Error
              ? rescheduleError.message
              : "Unable to reschedule failed pending payment recovery."
          );
        });
        stats.errors.push(error instanceof Error ? error.message : "Unable to recover pending tracked payment.");
      }
    }
  } catch (error) {
    stats.errors.push(error instanceof Error ? error.message : "Unable to scan pending tracked payments.");
  }

  if (stats.errors.length > 0) {
    console.warn("pending_payment_recovery_completed_with_errors", stats);
  }

  return stats;
}

export function scheduleDuePendingPaymentRecovery(trigger: string) {
  if (pendingPaymentRecoveryPromise) {
    return pendingPaymentRecoveryPromise;
  }

  pendingPaymentRecoveryPromise = reconcileDuePendingPayments(trigger).finally(() => {
    pendingPaymentRecoveryPromise = null;
  });

  return pendingPaymentRecoveryPromise;
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
