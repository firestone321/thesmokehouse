"use client";

import type { Order } from "@/lib/types";

const STORAGE_KEY = "smokehouse:lastGuestOrder";
const COOKIE_NAME = "smokehouse_last_order";
const RECEIPT_WINDOW_MS = 24 * 60 * 60 * 1000;
const CANCELLATION_MESSAGE_WINDOW_MS = 10 * 60 * 1000;

type StoredGuestOrder = {
  publicToken: string;
  updatedAt: number;
  completedSeenAt: number | null;
  cancelledSeenAt: number | null;
};

function now() {
  return Date.now();
}

function writeCookie(publicToken: string, maxAgeSeconds = 60 * 60 * 24 * 30) {
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(publicToken)}; Max-Age=${maxAgeSeconds}; Path=/; SameSite=Lax`;
}

function clearCookie() {
  document.cookie = `${COOKIE_NAME}=; Max-Age=0; Path=/; SameSite=Lax`;
}

function readCookie() {
  const prefix = `${COOKIE_NAME}=`;
  const match = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));

  return match ? decodeURIComponent(match.slice(prefix.length)) : null;
}

function readStoredGuestOrder(): StoredGuestOrder | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<StoredGuestOrder>;
    if (!parsed.publicToken || typeof parsed.publicToken !== "string") {
      return null;
    }

    return {
      publicToken: parsed.publicToken,
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : now(),
      completedSeenAt: typeof parsed.completedSeenAt === "number" ? parsed.completedSeenAt : null,
      cancelledSeenAt: typeof parsed.cancelledSeenAt === "number" ? parsed.cancelledSeenAt : null
    };
  } catch {
    return null;
  }
}

function writeStoredGuestOrder(value: StoredGuestOrder, cookieMaxAgeSeconds?: number) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  writeCookie(value.publicToken, cookieMaxAgeSeconds);
}

export function rememberGuestOrder(publicToken: string) {
  const token = publicToken.trim();
  if (!token) {
    return;
  }

  const existing = readStoredGuestOrder();
  writeStoredGuestOrder({
    publicToken: token,
    updatedAt: now(),
    completedSeenAt: existing?.publicToken === token ? existing.completedSeenAt : null,
    cancelledSeenAt: existing?.publicToken === token ? existing.cancelledSeenAt : null
  });
}

export function clearGuestOrder(publicToken?: string) {
  const existing = readStoredGuestOrder();
  if (publicToken && existing?.publicToken && existing.publicToken !== publicToken) {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
  clearCookie();
}

export function getRememberedGuestOrderToken() {
  const stored = readStoredGuestOrder();
  if (stored?.completedSeenAt && now() - stored.completedSeenAt > RECEIPT_WINDOW_MS) {
    clearGuestOrder(stored.publicToken);
    return null;
  }

  if (stored?.cancelledSeenAt && now() - stored.cancelledSeenAt > CANCELLATION_MESSAGE_WINDOW_MS) {
    clearGuestOrder(stored.publicToken);
    return null;
  }

  return stored?.publicToken ?? readCookie();
}

export function syncGuestOrderFromServer(order: Order) {
  if (!order.public_token) {
    return { isExpiredReceipt: false };
  }

  const existing = readStoredGuestOrder();
  const existingCompletedSeenAt = existing?.publicToken === order.public_token ? existing.completedSeenAt : null;
  const existingCancelledSeenAt = existing?.publicToken === order.public_token ? existing.cancelledSeenAt : null;

  if (order.status === "cancelled" || order.payment_status === "cancelled" || order.payment_status === "failed") {
    const serverCancelledAt = order.cancelled_at ? Date.parse(order.cancelled_at) : null;
    const cancelledSeenAt =
      serverCancelledAt && Number.isFinite(serverCancelledAt)
        ? serverCancelledAt
        : existingCancelledSeenAt ?? now();

    if (now() - cancelledSeenAt > CANCELLATION_MESSAGE_WINDOW_MS) {
      clearGuestOrder(order.public_token);
      return { isExpiredReceipt: false };
    }

    writeStoredGuestOrder(
      {
        publicToken: order.public_token,
        updatedAt: now(),
        completedSeenAt: null,
        cancelledSeenAt
      },
      Math.max(1, Math.ceil((CANCELLATION_MESSAGE_WINDOW_MS - (now() - cancelledSeenAt)) / 1000))
    );

    return { isExpiredReceipt: false };
  }

  const serverCompletedAt = order.completed_at ? Date.parse(order.completed_at) : null;
  const completedSeenAt =
    order.status === "completed"
      ? serverCompletedAt && Number.isFinite(serverCompletedAt)
        ? serverCompletedAt
        : existingCompletedSeenAt ?? now()
      : null;

  if (completedSeenAt && now() - completedSeenAt > RECEIPT_WINDOW_MS) {
    clearGuestOrder(order.public_token);
    return { isExpiredReceipt: true };
  }

  writeStoredGuestOrder({
    publicToken: order.public_token,
    updatedAt: now(),
    completedSeenAt,
    cancelledSeenAt: null
  });

  return { isExpiredReceipt: false };
}
