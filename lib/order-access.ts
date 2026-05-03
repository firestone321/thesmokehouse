import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getGuestDeviceSession } from "@/lib/guest-device";

const ORDER_ACCESS_COOKIE_NAME = "smokehouse_order_session";
const ORDER_ACCESS_MAX_AGE_SECONDS = 24 * 60 * 60;
const RECEIPT_REOPEN_WINDOW_MS = 24 * 60 * 60 * 1000;

type OrderSessionPayload = {
  orderId: number;
  publicToken: string;
  deviceId?: string;
  issuedAt: number;
  expiresAt: number;
  sessionVersion?: number;
};

type OrderReadAccessTarget = {
  id: number;
  public_token: string | null;
  device_id?: string | null;
  status: string;
  payment_status?: string | null;
  completed_at?: string | null;
  cancelled_at?: string | null;
};

function requireOrderAccessSecret() {
  const value = process.env.ORDER_ACCESS_COOKIE_SECRET?.trim();
  if (!value) {
    throw new Error("Missing required environment variable: ORDER_ACCESS_COOKIE_SECRET");
  }

  return value;
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value: string) {
  return createHmac("sha256", requireOrderAccessSecret()).update(value).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function createOrderAccessToken(payload: OrderSessionPayload) {
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = sign(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

function parseOrderAccessToken(token: string): OrderSessionPayload | null {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature || !safeEqual(signature, sign(encodedPayload))) {
    return null;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(encodedPayload)) as OrderSessionPayload;
    if (
      typeof payload.orderId !== "number"
      || typeof payload.publicToken !== "string"
      || (payload.deviceId !== undefined && typeof payload.deviceId !== "string")
      || typeof payload.issuedAt !== "number"
      || typeof payload.expiresAt !== "number"
    ) {
      return null;
    }

    if (payload.expiresAt < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export async function setOrderAccessCookie(input: {
  orderId: number;
  publicToken: string;
  deviceId?: string;
  maxAgeSeconds?: number;
  sessionVersion?: number;
}) {
  const now = Math.floor(Date.now() / 1000);
  const maxAgeSeconds = input.maxAgeSeconds ?? ORDER_ACCESS_MAX_AGE_SECONDS;
  const cookieStore = await cookies();
  const token = createOrderAccessToken({
    orderId: input.orderId,
    publicToken: input.publicToken,
    deviceId: input.deviceId?.trim() || undefined,
    issuedAt: now,
    expiresAt: now + maxAgeSeconds,
    sessionVersion: input.sessionVersion ?? 1,
  });

  cookieStore.set(ORDER_ACCESS_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSeconds,
  });
}

export async function clearOrderAccessCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(ORDER_ACCESS_COOKIE_NAME);
}

export async function getOrderAccessSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ORDER_ACCESS_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  const payload = parseOrderAccessToken(token);
  if (!payload) {
    await clearOrderAccessCookie();
    return null;
  }

  if (payload.expiresAt < Math.floor(Date.now() / 1000)) {
    await clearOrderAccessCookie();
    return null;
  }

  return payload;
}

export async function hasOrderAccess(input: {
  orderId: number;
  publicToken?: string | null;
}) {
  const payload = await getOrderAccessSession();
  if (!payload) {
    return false;
  }

  return (
    payload.orderId === input.orderId
    && (!input.publicToken || payload.publicToken === input.publicToken)
  );
}

type OrderReadAccessDecision =
  | {
      allowed: true;
    }
  | {
      allowed: false;
      status: number;
      message: string;
      clearOrderAccessCookie: boolean;
    };

function isWithinReceiptWindow(completedAt: string | null | undefined) {
  if (!completedAt) {
    return false;
  }

  const completedAtMs = Date.parse(completedAt);
  if (!Number.isFinite(completedAtMs)) {
    return false;
  }

  return Date.now() - completedAtMs <= RECEIPT_REOPEN_WINDOW_MS;
}

function getDeviceBindingFailure(message: string): OrderReadAccessDecision {
  return {
    allowed: false,
    status: 409,
    message,
    clearOrderAccessCookie: true
  };
}

export async function resolveOrderReadAccess(input: OrderReadAccessTarget): Promise<OrderReadAccessDecision> {
  const payload = await getOrderAccessSession();
  if (!payload) {
    return {
      allowed: false,
      status: 401,
      message: "Missing valid order access session.",
      clearOrderAccessCookie: false
    };
  }

  if (payload.orderId !== input.id || (input.public_token && payload.publicToken !== input.public_token)) {
    return {
      allowed: false,
      status: 403,
      message: "Missing valid order access session.",
      clearOrderAccessCookie: true
    };
  }

  const normalizedStatus = input.status.trim().toLowerCase();
  const normalizedPaymentStatus = input.payment_status?.trim().toLowerCase() ?? "";

  if (normalizedStatus === "cancelled" || normalizedPaymentStatus === "cancelled" || normalizedPaymentStatus === "failed") {
    return {
      allowed: false,
      status: 403,
      message: "This order is no longer available on this device.",
      clearOrderAccessCookie: true
    };
  }

  if (normalizedStatus === "completed" && !isWithinReceiptWindow(input.completed_at)) {
    return {
      allowed: false,
      status: 403,
      message: "This receipt window has expired on this device.",
      clearOrderAccessCookie: true
    };
  }

  const guestDevice = await getGuestDeviceSession();
  if (!guestDevice?.deviceId || !payload.deviceId || !input.device_id) {
    return getDeviceBindingFailure("This order can only be reopened on the device that placed it.");
  }

  if (guestDevice.deviceId !== payload.deviceId || guestDevice.deviceId !== input.device_id) {
    return getDeviceBindingFailure("This order can only be reopened on the device that placed it.");
  }

  return { allowed: true };
}

export async function hasReadAccessToOrder(input: OrderReadAccessTarget) {
  const result = await resolveOrderReadAccess(input);
  return result.allowed;
}

function getRemainingReceiptWindowSeconds(completedAt: string | null | undefined) {
  if (!completedAt) {
    return null;
  }

  const completedAtMs = Date.parse(completedAt);
  if (!Number.isFinite(completedAtMs)) {
    return null;
  }

  const remainingMs = RECEIPT_REOPEN_WINDOW_MS - (Date.now() - completedAtMs);
  if (remainingMs <= 0) {
    return 0;
  }

  return Math.max(1, Math.ceil(remainingMs / 1000));
}

export async function syncOrderAccessCookie(input: OrderReadAccessTarget) {
  const result = await resolveOrderReadAccess(input);
  if (!result.allowed) {
    await clearOrderAccessCookie();
    return false;
  }

  if (!input.public_token) {
    await clearOrderAccessCookie();
    return false;
  }

  const normalizedStatus = input.status.trim().toLowerCase();
  const normalizedPaymentStatus = input.payment_status?.trim().toLowerCase() ?? "";
  const maxAgeSeconds =
    normalizedStatus === "completed"
      ? getRemainingReceiptWindowSeconds(input.completed_at)
      : ORDER_ACCESS_MAX_AGE_SECONDS;

  if (maxAgeSeconds === 0) {
    await clearOrderAccessCookie();
    return false;
  }

  await setOrderAccessCookie({
    orderId: input.id,
    publicToken: input.public_token,
    deviceId: input.device_id?.trim() || undefined,
    maxAgeSeconds: maxAgeSeconds ?? ORDER_ACCESS_MAX_AGE_SECONDS
  });

  if (normalizedPaymentStatus === "cancelled" || normalizedPaymentStatus === "failed") {
    await clearOrderAccessCookie();
    return false;
  }

  return true;
}
