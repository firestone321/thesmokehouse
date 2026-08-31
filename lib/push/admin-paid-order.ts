import "server-only";

import {
  requireInternalRequestSigningSecret,
  signInternalRequestToken
} from "@/lib/internal-auth";
import { getSupabaseAdmin } from "@/lib/supabase";

const ADMIN_PAID_ORDER_PUSH_PURPOSE = "admin_paid_order_push_dispatch";
const PRODUCTION_ADMIN_DASHBOARD_BASE_URL = "https://admin.firestonesmokehouse.com";
const ADMIN_PAID_ORDER_PUSH_TIMEOUT_MS = 8_000;
const ADMIN_PAID_ORDER_DUE_SCAN_LIMIT = 5;
const ADMIN_PAID_ORDER_STALE_PROCESSING_MS = 5 * 60_000;

let adminPaidOrderDueScanPromise: Promise<AdminPaidOrderDueScanStats> | null = null;

export type AdminPaidOrderDueScanStats = {
  scanned: number;
  triggered: number;
  failed: number;
};

function readEnv(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function isRedirectingVercelAdminHostname(hostname: string) {
  const normalizedHostname = hostname.toLowerCase();
  return (
    normalizedHostname === "thesmokehouse-admin.vercel.app"
    || (
      normalizedHostname.startsWith("thesmokehouse-admin-")
      && normalizedHostname.endsWith(".vercel.app")
    )
  );
}

function getAdminDashboardBaseUrl() {
  const configuredBaseUrl = readEnv("ADMIN_DASHBOARD_BASE_URL");
  if (!configuredBaseUrl) {
    return process.env.NODE_ENV === "production" ? PRODUCTION_ADMIN_DASHBOARD_BASE_URL : null;
  }

  const parsedBaseUrl = new URL(configuredBaseUrl);
  if (
    process.env.NODE_ENV === "production"
    && isRedirectingVercelAdminHostname(parsedBaseUrl.hostname)
  ) {
    return PRODUCTION_ADMIN_DASHBOARD_BASE_URL;
  }

  return parsedBaseUrl.origin;
}

export function isAdminPaidOrderPushKickConfigured() {
  return Boolean(getAdminDashboardBaseUrl() && readEnv("STOREFRONT_INTERNAL_AUTH_TOKEN"));
}

export async function triggerAdminPaidOrderPushDispatch(orderId: number) {
  const baseUrl = getAdminDashboardBaseUrl();
  if (!baseUrl) {
    console.warn("admin_paid_order_push_kick_not_configured", { orderId, missing: "ADMIN_DASHBOARD_BASE_URL" });
    return { attempted: false, triggered: false, message: "missing_admin_dashboard_base_url" };
  }

  const path = "/api/internal/push/admin-paid-orders/process";
  const token = signInternalRequestToken({
    secret: requireInternalRequestSigningSecret("STOREFRONT_INTERNAL_AUTH_TOKEN"),
    issuer: "thesmokehouse-storefront",
    audience: "thesmokehouse-admin",
    purpose: ADMIN_PAID_ORDER_PUSH_PURPOSE,
    method: "POST",
    path,
    orderId: String(orderId)
  });

  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({ orderId }),
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(ADMIN_PAID_ORDER_PUSH_TIMEOUT_MS)
  });

  const payload = (await response.json().catch(() => null)) as { message?: string } | null;
  if (!response.ok) {
    throw new Error(payload?.message ?? `Admin paid-order push dispatch failed with status ${response.status}.`);
  }

  return { attempted: true, triggered: true, message: null };
}

export async function processDueAdminPaidOrderPushDispatches(
  limit = ADMIN_PAID_ORDER_DUE_SCAN_LIMIT
): Promise<AdminPaidOrderDueScanStats> {
  const normalizedLimit = Math.max(1, Math.min(10, Math.trunc(limit)));
  const now = new Date();
  const staleBefore = new Date(now.getTime() - ADMIN_PAID_ORDER_STALE_PROCESSING_MS).toISOString();
  const { data, error } = await getSupabaseAdmin()
    .from("admin_push_dispatches")
    .select("order_id")
    .eq("notification_type", "new_paid_order")
    .or(
      `and(status.in.(pending,no_subscribers),next_attempt_at.lte.${now.toISOString()}),and(status.eq.processing,last_attempt_at.lte.${staleBefore})`
    )
    .order("next_attempt_at", { ascending: true })
    .limit(normalizedLimit);

  if (error) {
    throw new Error(`Unable to load due admin paid-order pushes: ${error.message}`);
  }

  const orderIds = Array.from(new Set((data ?? []).map((row) => Number(row.order_id)).filter(Number.isFinite)));
  const results = await Promise.allSettled(orderIds.map((orderId) => triggerAdminPaidOrderPushDispatch(orderId)));
  const failed = results.filter((result) => result.status === "rejected").length;

  return {
    scanned: orderIds.length,
    triggered: orderIds.length - failed,
    failed
  };
}

export function scheduleDueAdminPaidOrderPushProcessing(trigger: string) {
  if (adminPaidOrderDueScanPromise) {
    return adminPaidOrderDueScanPromise;
  }

  adminPaidOrderDueScanPromise = processDueAdminPaidOrderPushDispatches()
    .then((stats) => {
      if (stats.scanned > 0) {
        console.info("admin_paid_order_push_due_scan_completed", { trigger, ...stats });
      }
      return stats;
    })
    .catch((error) => {
      console.error("admin_paid_order_push_due_scan_failed", {
        trigger,
        error: error instanceof Error ? error.message : "unknown_error"
      });
      return { scanned: 0, triggered: 0, failed: 1 };
    })
    .finally(() => {
      adminPaidOrderDueScanPromise = null;
    });

  return adminPaidOrderDueScanPromise;
}
