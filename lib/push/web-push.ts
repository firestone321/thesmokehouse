import "server-only";

import { createHash } from "node:crypto";
import webpush from "web-push";

export type StoredPushSubscription = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  platform: string | null;
  user_agent: string | null;
};

export type PushNotificationPayload = {
  title: string;
  body: string;
  url: string;
  tag?: string;
  icon?: string;
  badge?: string;
  data?: Record<string, unknown>;
};

export type WebPushErrorDetails = {
  statusCode: number | null;
  body: string | null;
  endpoint: string | null;
};

let vapidConfigured = false;
const PUSH_TTL_SECONDS = 300;
const MAX_PUSH_TOPIC_LENGTH = 32;

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function configureWebPush() {
  if (vapidConfigured) {
    return;
  }

  webpush.setVapidDetails(
    requireEnv("VAPID_SUBJECT"),
    requireEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY"),
    requireEnv("VAPID_PRIVATE_KEY")
  );
  vapidConfigured = true;
}

function buildPushTopic(tag: string | undefined) {
  if (!tag) {
    return undefined;
  }
  // Apple Web Push rejects Topic headers that are not valid base64url-decodable
  // strings (responds 400 BadWebPushTopic), even when the characters are
  // base64url-safe. Hashing the tag and base64url-encoding the digest produces
  // a deterministic, always-valid topic that all push providers accept.
  return createHash("sha256")
    .update(tag, "utf8")
    .digest("base64url")
    .slice(0, MAX_PUSH_TOPIC_LENGTH);
}

export async function sendWebPushNotification(
  subscription: StoredPushSubscription,
  payload: PushNotificationPayload
) {
  configureWebPush();

  const topic = buildPushTopic(payload.tag);

  return webpush.sendNotification(
    {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth
      }
    },
    JSON.stringify(payload),
    {
      TTL: PUSH_TTL_SECONDS,
      urgency: "high",
      ...(topic ? { topic } : {})
    }
  );
}

export function getWebPushErrorDetails(error: unknown): WebPushErrorDetails {
  if (typeof error !== "object" || error === null) {
    return { statusCode: null, body: null, endpoint: null };
  }

  const errorRecord = error as Record<string, unknown>;
  const statusCode = typeof errorRecord.statusCode === "number" ? errorRecord.statusCode : null;
  const body = typeof errorRecord.body === "string" ? errorRecord.body : null;
  const endpoint = typeof errorRecord.endpoint === "string" ? errorRecord.endpoint : null;

  return {
    statusCode,
    body,
    endpoint
  };
}

export function isStalePushSubscriptionError(error: unknown) {
  const { statusCode } = getWebPushErrorDetails(error);
  return (
    statusCode === 400
    || statusCode === 401
    || statusCode === 403
    || statusCode === 404
    || statusCode === 410
  );
}
