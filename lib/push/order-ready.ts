import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase";
import {
  isStalePushSubscriptionError,
  sendWebPushNotification,
  type StoredPushSubscription
} from "@/lib/push/web-push";

type OrderReadyRow = {
  id: number;
  public_token: string | null;
  status: string | null;
  updated_at: string;
};

type PushSubscriptionRow = StoredPushSubscription;
type PushDispatchRow = {
  idempotency_key: string;
  order_id: number;
  order_updated_at: string;
  attempt_count: number;
};

export type ProcessQueuedOrderReadyPushesResult = {
  scanned: number;
  processed: number;
  completed: number;
  retried: number;
  failed: number;
};

const READY_PUSH_RETRY_BASE_DELAY_MS = 60_000;
const READY_PUSH_MAX_RETRY_ATTEMPTS = 5;
const READY_PUSH_MAX_RETRY_DELAY_MS = 30 * 60_000;
const READY_PUSH_STALE_CLAIM_SECONDS = 5 * 60;
const READY_PUSH_DUE_SCAN_LIMIT = 2;
const READY_PUSH_MIN_RUN_INTERVAL_MS = 30_000;
let readyPushProcessingPromise: Promise<ProcessQueuedOrderReadyPushesResult | null> | null = null;
let readyPushLastRunAt = 0;

class PushTriggerError extends Error {}

function normalizeStatus(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function isReadyOrder(row: Pick<OrderReadyRow, "status">) {
  return normalizeStatus(row.status) === "ready";
}

function buildOrderUrl(order: Pick<OrderReadyRow, "public_token">) {
  return order.public_token ? `/order/${order.public_token}` : "/";
}

async function getOrderForReadyPush(orderId: number) {
  const { data, error } = await getSupabaseAdmin()
    .from("orders")
    .select("id,public_token,status,updated_at")
    .eq("id", orderId)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load order for push dispatch: ${error.message}`);
  }

  return (data as OrderReadyRow | null) ?? null;
}

async function getOrderLinkedSubscriptionIds(orderId: number) {
  const { data, error } = await getSupabaseAdmin()
    .from("push_subscription_orders")
    .select("subscription_id")
    .eq("order_id", orderId);

  if (error) {
    throw new Error(`Unable to load order-linked push subscriptions: ${error.message}`);
  }

  return ((data ?? []) as Array<{ subscription_id: string }>).map((row) => row.subscription_id);
}

async function getSubscriptionsByIds(subscriptionIds: string[]) {
  if (subscriptionIds.length === 0) {
    return [] as PushSubscriptionRow[];
  }

  const { data, error } = await getSupabaseAdmin()
    .from("push_subscriptions")
    .select("id,endpoint,p256dh,auth,platform,user_agent")
    .in("id", subscriptionIds);

  if (error) {
    throw new Error(`Unable to load push subscriptions by id: ${error.message}`);
  }

  return (data as PushSubscriptionRow[] | null) ?? [];
}

async function deletePushSubscriptions(subscriptionIds: string[]) {
  if (subscriptionIds.length === 0) {
    return;
  }

  const { error } = await getSupabaseAdmin()
    .from("push_subscriptions")
    .delete()
    .in("id", subscriptionIds);

  if (error) {
    throw new Error(`Unable to delete stale push subscriptions: ${error.message}`);
  }
}

async function claimPushDispatchForProcessing(idempotencyKey: string) {
  const { data, error } = await getSupabaseAdmin().rpc("claim_push_notification_dispatch", {
    dispatch_idempotency_key: idempotencyKey,
    stale_after_seconds: READY_PUSH_STALE_CLAIM_SECONDS
  });

  if (error) {
    throw new Error(`Unable to claim queued push dispatch: ${error.message}`);
  }

  const row = Array.isArray(data) ? data[0] : null;
  return row ? (row as PushDispatchRow) : null;
}

async function completePushDispatch(input: {
  idempotencyKey: string;
  subscriptionCount: number;
  successCount: number;
  staleSubscriptionCount: number;
}) {
  const { error } = await getSupabaseAdmin()
    .from("push_notification_dispatches")
    .update({
      completed_at: new Date().toISOString(),
      subscription_count: input.subscriptionCount,
      success_count: input.successCount,
      stale_subscription_count: input.staleSubscriptionCount,
      processing_started_at: null,
      last_error: null
    })
    .eq("idempotency_key", input.idempotencyKey);

  if (error) {
    throw new Error(`Unable to complete push dispatch: ${error.message}`);
  }
}

function getRetryDelayMs(attemptCount: number) {
  return Math.min(
    READY_PUSH_MAX_RETRY_DELAY_MS,
    READY_PUSH_RETRY_BASE_DELAY_MS * 2 ** Math.max(0, attemptCount - 1)
  );
}

function isRetryablePushDispatchError(error: unknown) {
  return !(error instanceof PushTriggerError);
}

async function reschedulePushDispatch(input: {
  idempotencyKey: string;
  attemptCount: number;
  errorMessage: string;
}) {
  const delayMs = getRetryDelayMs(input.attemptCount);
  const { error } = await getSupabaseAdmin()
    .from("push_notification_dispatches")
    .update({
      processing_started_at: null,
      last_error: input.errorMessage,
      next_attempt_at: new Date(Date.now() + delayMs).toISOString()
    })
    .eq("idempotency_key", input.idempotencyKey)
    .is("completed_at", null);

  if (error) {
    throw new Error(`Unable to reschedule push dispatch: ${error.message}`);
  }
}

async function finalizeFailedPushDispatch(input: {
  idempotencyKey: string;
  errorMessage: string;
}) {
  const { error } = await getSupabaseAdmin()
    .from("push_notification_dispatches")
    .update({
      completed_at: new Date().toISOString(),
      processing_started_at: null,
      last_error: input.errorMessage
    })
    .eq("idempotency_key", input.idempotencyKey);

  if (error) {
    throw new Error(`Unable to finalize failed push dispatch: ${error.message}`);
  }
}

async function listDuePushDispatchIdempotencyKeys(limit: number) {
  const { data, error } = await getSupabaseAdmin()
    .from("push_notification_dispatches")
    .select("idempotency_key")
    .eq("notification_type", "order_ready")
    .is("completed_at", null)
    .lte("next_attempt_at", new Date().toISOString())
    .order("next_attempt_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`Unable to list queued push dispatches: ${error.message}`);
  }

  return ((data ?? []) as Array<{ idempotency_key: string }>).map((row) => row.idempotency_key);
}

async function resolveSubscriptionsForOrder(orderId: number) {
  const orderLinkedIds = await getOrderLinkedSubscriptionIds(orderId);
  const subscriptions = await getSubscriptionsByIds(orderLinkedIds);

  return [...new Map(subscriptions.map((subscription) => [subscription.endpoint, subscription])).values()];
}

export async function processOrderReadyPushDispatch(idempotencyKey: string) {
  const dispatch = await claimPushDispatchForProcessing(idempotencyKey);
  if (!dispatch) {
    return null;
  }

  try {
    const order = await getOrderForReadyPush(dispatch.order_id);
    if (!order) {
      throw new PushTriggerError("Order not found.");
    }

    if (!isReadyOrder(order)) {
      throw new PushTriggerError("Order is not in Ready status.");
    }

    if (order.updated_at !== dispatch.order_updated_at) {
      throw new PushTriggerError("Order updated_at does not match the Ready transition.");
    }

    const subscriptions = await resolveSubscriptionsForOrder(order.id);
    const orderUrl = buildOrderUrl(order);
    const payload = {
      title: "Order Ready",
      body: "Your Smokehouse order is ready for pickup.",
      url: orderUrl,
      tag: `order-ready:${order.id}`,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: {
        orderId: order.id,
        url: orderUrl
      }
    } as const;

    const deliveryResults = await Promise.all(
      subscriptions.map(async (subscription) => {
        try {
          await sendWebPushNotification(subscription, payload);
          return { success: true, staleSubscriptionId: null as string | null };
        } catch (error) {
          if (isStalePushSubscriptionError(error)) {
            return { success: false, staleSubscriptionId: subscription.id };
          }

          console.error("order_ready_push_send_failed", {
            orderId: order.id,
            subscriptionId: subscription.id,
            error: error instanceof Error ? error.message : "unknown_error"
          });
          return { success: false, staleSubscriptionId: null as string | null };
        }
      })
    );
    const successCount = deliveryResults.filter((result) => result.success).length;
    const staleSubscriptionIds = deliveryResults
      .map((result) => result.staleSubscriptionId)
      .filter((subscriptionId): subscriptionId is string => Boolean(subscriptionId));

    await deletePushSubscriptions(staleSubscriptionIds);
    await completePushDispatch({
      idempotencyKey: dispatch.idempotency_key,
      subscriptionCount: subscriptions.length,
      successCount,
      staleSubscriptionCount: staleSubscriptionIds.length
    });

    return {
      orderId: order.id,
      orderUrl,
      subscriptionCount: subscriptions.length,
      successCount,
      staleSubscriptionCount: staleSubscriptionIds.length
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "unknown_error";
    if (
      isRetryablePushDispatchError(error)
      && dispatch.attempt_count < READY_PUSH_MAX_RETRY_ATTEMPTS
    ) {
      await reschedulePushDispatch({
        idempotencyKey: dispatch.idempotency_key,
        attemptCount: dispatch.attempt_count,
        errorMessage
      });
    } else {
      await finalizeFailedPushDispatch({
        idempotencyKey: dispatch.idempotency_key,
        errorMessage
      });
    }
    throw error;
  }
}

export async function processDueOrderReadyPushes(
  limit = 20
): Promise<ProcessQueuedOrderReadyPushesResult> {
  const idempotencyKeys = await listDuePushDispatchIdempotencyKeys(limit);
  let processed = 0;
  let completed = 0;
  let retried = 0;
  let failed = 0;

  for (const idempotencyKey of idempotencyKeys) {
    try {
      const result = await processOrderReadyPushDispatch(idempotencyKey);
      if (!result) {
        continue;
      }

      processed += 1;
      completed += 1;
    } catch (error) {
      processed += 1;
      if (isRetryablePushDispatchError(error)) {
        retried += 1;
      } else {
        failed += 1;
      }
    }
  }

  return {
    scanned: idempotencyKeys.length,
    processed,
    completed,
    retried,
    failed
  };
}

export function scheduleDueOrderReadyPushProcessing(trigger: string) {
  const nowMs = Date.now();
  if (readyPushProcessingPromise) {
    return readyPushProcessingPromise;
  }

  if (nowMs - readyPushLastRunAt < READY_PUSH_MIN_RUN_INTERVAL_MS) {
    return null;
  }

  const runPromise = processDueOrderReadyPushes(READY_PUSH_DUE_SCAN_LIMIT)
    .then((stats) => {
      readyPushLastRunAt = Date.now();
      if (stats.scanned > 0) {
        console.info("order_ready_push_due_scan_completed", {
          trigger,
          ...stats
        });
      }
      return stats;
    })
    .catch((error) => {
      readyPushLastRunAt = Date.now();
      console.error("order_ready_push_due_scan_failed", {
        trigger,
        error: error instanceof Error ? error.message : "unknown_error"
      });
      return null;
    })
    .finally(() => {
      readyPushProcessingPromise = null;
    });

  readyPushProcessingPromise = runPromise;
  return runPromise;
}
