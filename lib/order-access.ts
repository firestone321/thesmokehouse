import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const ORDER_ACCESS_COOKIE_PREFIX = "smokehouse_order_access";
const ORDER_ACCESS_MAX_AGE_SECONDS = 60 * 60 * 72;
const RECEIPT_REOPEN_WINDOW_MS = 24 * 60 * 60 * 1000;

type OrderAccessPayload = {
  orderId: number;
  publicToken: string;
  iat: number;
  exp: number;
};

type OrderReadAccessTarget = {
  id: number;
  public_token: string | null;
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

function getCookieName(orderId: number) {
  return `${ORDER_ACCESS_COOKIE_PREFIX}_${orderId}`;
}

function createOrderAccessToken(payload: OrderAccessPayload) {
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = sign(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

function parseOrderAccessToken(token: string): OrderAccessPayload | null {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature || !safeEqual(signature, sign(encodedPayload))) {
    return null;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(encodedPayload)) as OrderAccessPayload;
    if (
      typeof payload.orderId !== "number"
      || typeof payload.publicToken !== "string"
      || typeof payload.iat !== "number"
      || typeof payload.exp !== "number"
    ) {
      return null;
    }

    if (payload.exp < Math.floor(Date.now() / 1000)) {
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
}) {
  const now = Math.floor(Date.now() / 1000);
  const cookieStore = await cookies();
  const token = createOrderAccessToken({
    orderId: input.orderId,
    publicToken: input.publicToken,
    iat: now,
    exp: now + ORDER_ACCESS_MAX_AGE_SECONDS,
  });

  cookieStore.set(getCookieName(input.orderId), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ORDER_ACCESS_MAX_AGE_SECONDS,
  });
}

export async function hasOrderAccess(input: {
  orderId: number;
  publicToken?: string | null;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get(getCookieName(input.orderId))?.value;
  if (!token) {
    return false;
  }

  const payload = parseOrderAccessToken(token);
  if (!payload) {
    return false;
  }

  return (
    payload.orderId === input.orderId
    && (!input.publicToken || payload.publicToken === input.publicToken)
  );
}

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

export async function hasReadAccessToOrder(input: OrderReadAccessTarget) {
  const hasAccess = await hasOrderAccess({
    orderId: input.id,
    publicToken: input.public_token
  });

  if (!hasAccess) {
    return false;
  }

  const normalizedStatus = input.status.trim().toLowerCase();
  const normalizedPaymentStatus = input.payment_status?.trim().toLowerCase() ?? "";

  if (normalizedStatus === "cancelled" || normalizedPaymentStatus === "cancelled" || normalizedPaymentStatus === "failed") {
    return false;
  }

  if (normalizedStatus === "completed") {
    return isWithinReceiptWindow(input.completed_at);
  }

  return true;
}
