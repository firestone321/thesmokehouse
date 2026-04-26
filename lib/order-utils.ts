import { randomBytes, randomInt } from "crypto";

export function generatePublicToken(): string {
  return randomBytes(24).toString("base64url");
}

export function generatePickupCode(): string {
  return String(randomInt(1000, 9999));
}

export const ORDER_STATUSES = ["new", "confirmed", "in_prep", "ready", "completed", "cancelled"] as const;
