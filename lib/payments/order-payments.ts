import { randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase";
import { toKampalaDateTimeString } from "@/lib/format";
import {
  getPesapalTransactionStatus,
  isPesapalInitiationRejectedError,
  submitPesapalOrderRequest
} from "@/lib/payments/pesapal";
import { triggerAdminPaidOrderPushDispatch } from "@/lib/push/admin-paid-order";

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

type PaymentAttemptRow = {
  id: number;
  attempt_number: number;
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

const PENDING_PAYMENT_RECOVERY_SOFT_CANCEL_MS = 7 * 60_000;
const PENDING_PAYMENT_RECOVERY_VERIFY_THROTTLE_MS = 5 * 60_000;
const PENDING_PAYMENT_RECOVERY_SCAN_LIMIT = 50;
const PENDING_PAYMENT_RECOVERY_PROCESS_LIMIT = 5;
const PENDING_PAYMENT_RECOVERY_MAX_BACKOFF_MS = 15 * 60_000;
const PENDING_PAYMENT_RECOVERY_MIN_BACKOFF_MS = 30_000;

let pendingPaymentRecoveryPromise: Promise<PendingPaymentRecoveryStats> | null = null;

export type PendingPaymentRecoveryStats = {
  trigger: string;
  trackedScanned: number;
  trackedClaimed: number;
  trackedVerified: number;
  trackedCancelled: number;
  trackedCompleted: number;
  trackedRescheduled: number;
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
    await enqueuePendingPaymentRecoverySafely({
      orderId: row.id,
      orderTrackingId: row.order_tracking_id,
      reason: "Existing tracked pending payment reused for checkout."
    });

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

  await enqueuePendingPaymentRecoverySafely({
    orderId: row.id,
    orderTrackingId: response.order_tracking_id ?? null,
    reason: "Pesapal payment initiation created a tracked pending payment."
  });

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
    .eq("status", "new")
    .is("order_tracking_id", null)
    .is("payment_redirect_url", null)
    .is("stock_reserved_at", null)
    .not("payment_status", "in", "(paid,completed,cancelled,canceled)")
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
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to cancel rejected payment initiation: ${error.message}`);
  }

  if (!data) {
    return null;
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

async function verifyPesapalPaymentForOrder(input: {
  publicToken: string;
  orderTrackingId?: string | null;
}) {
  const row = await getOrderPaymentRow(input.publicToken);
  if (!row) {
    throw new Error("Order not found.");
  }

  const trackingId = input.orderTrackingId ?? row.order_tracking_id;
  if (!trackingId) {
    return {
      snapshot: buildSnapshot(row),
      providerPaymentStatus: null as PaymentStatus | null
    };
  }

  await enqueuePendingPaymentRecoverySafely({
    orderId: row.id,
    orderTrackingId: trackingId,
    reason: "Payment verification observed a tracked pending payment."
  });

  const status = await getPesapalTransactionStatus(trackingId);
  const storedPaymentStatus = normalizeStoredPaymentStatus(row.payment_status);
  const nextNonPaidPaymentStatus =
    storedPaymentStatus === "cancelled" ? "cancelled" : status.paymentStatus;

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

    if (storedPaymentStatus !== "paid") {
      await triggerAdminPaidOrderPushDispatch(row.id).catch((error) => {
        console.error("admin_paid_order_push_dispatch_failed", {
          orderId: row.id,
          error: error instanceof Error ? error.message : "unknown_error"
        });
      });
    }
  } else {
    const { error } = await getSupabaseAdmin()
      .from("orders")
      .update({
        payment_status: nextNonPaidPaymentStatus,
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
    paymentStatus: status.paymentStatus === "paid" ? "paid" : nextNonPaidPaymentStatus,
    lifecycleStatus: status.paymentStatus === "failed" ? "failed" : "initiated",
    providerReference: trackingId,
    providerStatus: status.providerStatus,
    paymentReference: status.paymentReference,
    rawResponse: status.rawResponse
  });

  const refreshed = await getOrderPaymentRow(input.publicToken);
  if (!refreshed) {
    throw new Error("Order not found.");
  }

  const snapshot = buildSnapshot(refreshed, { verified: normalizeStoredPaymentStatus(refreshed.payment_status) === "paid" });
  if (status.paymentStatus === "paid" || status.paymentStatus === "failed") {
    await completePendingPaymentRecoveryByTracking(trackingId);
  }

  return {
    snapshot,
    providerPaymentStatus: status.paymentStatus
  };
}

export async function syncPesapalPaymentForOrder(input: {
  publicToken: string;
  orderTrackingId?: string | null;
}) {
  const result = await verifyPesapalPaymentForOrder(input);
  return result.snapshot;
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

function isTrackedPendingPaymentExpired(row: OrderPaymentRow, nowMs: number) {
  return isOlderThan(row.created_at, PENDING_PAYMENT_RECOVERY_SOFT_CANCEL_MS, nowMs);
}

async function cancelExpiredPendingPayment(row: OrderPaymentRow, reasonMessage: string) {
  await updateActivePaymentAttempt(row, {
    lifecycleStatus: "failed",
    paymentStatus: "cancelled",
    providerMessage: reasonMessage
  });

  const now = new Date().toISOString();
  const { error } = await getSupabaseAdmin()
    .from("orders")
    .update({
      status: "cancelled",
      payment_status: "cancelled",
      payment_provider: "pesapal",
      payment_last_verified_at: now,
      payment_initiation_failure_code: "pending_payment_timeout",
      payment_initiation_failure_message: reasonMessage,
      payment_initiation_failed_at: now
    })
    .eq("id", row.id)
    .eq("status", "new")
    .eq("payment_status", "pending")
    .is("stock_reserved_at", null);

  if (error) {
    throw new Error(`Unable to cancel stale pending payment: ${error.message}`);
  }
}

async function processClaimedPendingPaymentRecovery(
  row: PendingPaymentRecoveryRow,
  nowMs: number
): Promise<"completed" | "rescheduled" | "cancelled"> {
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
    orderTrackingId
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
    refreshed &&
    refreshed.status === "new" &&
    refreshedPaymentStatus === "pending" &&
    refreshed.order_tracking_id &&
    isTrackedPendingPaymentExpired(refreshed, nowMs)
  ) {
    await cancelExpiredPendingPayment(
      refreshed,
      "Payment was not completed before the pending checkout window expired."
    );
    await reschedulePendingPaymentRecovery(
      row,
      "Provider still reports pending after local soft-cancel; keeping recovery active for late paid truth."
    );
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
        } else {
          stats.trackedRescheduled += 1;
          if (result === "cancelled") {
            stats.trackedCancelled += 1;
          }
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
