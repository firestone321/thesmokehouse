import "server-only";

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const GUEST_DEVICE_COOKIE_NAME = "smokehouse_guest_device";
const GUEST_DEVICE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

export type GuestDevicePayload = {
  deviceId: string;
  issuedAt: number;
  expiresAt: number;
  sessionVersion?: number;
};

function requireGuestDeviceSecret() {
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
  return createHmac("sha256", requireGuestDeviceSecret()).update(value).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function createGuestDeviceToken(payload: GuestDevicePayload) {
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = sign(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

function parseGuestDeviceToken(token: string): GuestDevicePayload | null {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature || !safeEqual(signature, sign(encodedPayload))) {
    return null;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(encodedPayload)) as GuestDevicePayload;
    if (
      typeof payload.deviceId !== "string"
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

export async function setGuestDeviceCookie(input?: {
  deviceId?: string;
  maxAgeSeconds?: number;
  sessionVersion?: number;
}): Promise<GuestDevicePayload> {
  const now = Math.floor(Date.now() / 1000);
  const maxAgeSeconds = input?.maxAgeSeconds ?? GUEST_DEVICE_MAX_AGE_SECONDS;
  const payload: GuestDevicePayload = {
    deviceId: input?.deviceId?.trim() || randomUUID(),
    issuedAt: now,
    expiresAt: now + maxAgeSeconds,
    sessionVersion: input?.sessionVersion ?? 1
  };
  const cookieStore = await cookies();
  const token = createGuestDeviceToken(payload);

  cookieStore.set(GUEST_DEVICE_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSeconds
  });

  return payload;
}

export async function clearGuestDeviceCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(GUEST_DEVICE_COOKIE_NAME);
}

export async function getGuestDeviceSession(): Promise<GuestDevicePayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(GUEST_DEVICE_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  const payload = parseGuestDeviceToken(token);
  if (!payload) {
    await clearGuestDeviceCookie();
    return null;
  }

  if (payload.expiresAt < Math.floor(Date.now() / 1000)) {
    await clearGuestDeviceCookie();
    return null;
  }

  return payload;
}

export async function ensureGuestDeviceSession(): Promise<GuestDevicePayload> {
  const existing = await getGuestDeviceSession();
  if (existing) {
    return existing;
  }

  return setGuestDeviceCookie();
}
