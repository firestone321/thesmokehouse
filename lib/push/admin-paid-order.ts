import "server-only";

import {
  requireInternalRequestSigningSecret,
  signInternalRequestToken
} from "@/lib/internal-auth";

const ADMIN_PAID_ORDER_PUSH_PURPOSE = "admin_paid_order_push_dispatch";
const ADMIN_PAID_ORDER_PUSH_TIMEOUT_MS = 8_000;

function readEnv(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function getAdminDashboardBaseUrl() {
  return readEnv("ADMIN_DASHBOARD_BASE_URL")?.replace(/\/+$/, "") ?? null;
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
    signal: AbortSignal.timeout(ADMIN_PAID_ORDER_PUSH_TIMEOUT_MS)
  });

  const payload = (await response.json().catch(() => null)) as { message?: string } | null;
  if (!response.ok) {
    throw new Error(payload?.message ?? `Admin paid-order push dispatch failed with status ${response.status}.`);
  }

  return { attempted: true, triggered: true, message: null };
}
