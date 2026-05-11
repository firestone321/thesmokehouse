"use client";

import { useEffect, useState } from "react";
import { urlBase64ToUint8Array } from "@/lib/push/vapid";

type EnableOrderNotificationsProps = {
  orderId: number;
};

type LinkState = "idle" | "checking" | "linking" | "linked" | "needs_permission" | "error";
type SupportedPermissionState = NotificationPermission | "unsupported";

type PushSubscriptionWithJson = PushSubscription & {
  toJSON(): PushSubscriptionJSON;
};

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
};

function isIosDevice() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function isStandaloneMode() {
  return (
    window.matchMedia("(display-mode: standalone)").matches
    || (window.navigator as NavigatorWithStandalone).standalone === true
  );
}

function supportsPushNotifications() {
  return (
    typeof window !== "undefined"
    && "Notification" in window
    && "serviceWorker" in navigator
    && "PushManager" in window
  );
}

function getPermissionState(): SupportedPermissionState {
  return supportsPushNotifications() ? Notification.permission : "unsupported";
}

function encodeVapidPublicKey(value: ArrayBuffer | null) {
  if (!value) {
    return "";
  }

  const binary = String.fromCharCode(...new Uint8Array(value));
  return window.btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function subscriptionMatchesVapidKey(subscription: PushSubscription, publicKey: string) {
  const subscriptionKey = encodeVapidPublicKey(subscription.options.applicationServerKey);
  return subscriptionKey === publicKey;
}

function buildSubscribePayload(orderId: number, subscription: PushSubscriptionWithJson, vapidPublicKey: string) {
  return {
    ...subscription.toJSON(),
    orderId,
    vapidPublicKey
  };
}

async function loadRuntimeVapidPublicKey() {
  const response = await fetch("/api/push/public-key", {
    cache: "no-store"
  });
  const payload = (await response.json().catch(() => null)) as {
    publicKey?: string;
    message?: string;
  } | null;

  if (!response.ok) {
    throw new Error(payload?.message ?? "Push notifications are not configured yet.");
  }

  const publicKey = payload?.publicKey?.trim();
  if (!publicKey) {
    throw new Error("Push notifications are not configured yet.");
  }

  return publicKey;
}

async function ensureServiceWorkerRegistration() {
  const existingRegistration = await navigator.serviceWorker.getRegistration();
  const registration = existingRegistration
    ?? await navigator.serviceWorker.register("/sw.js", {
      updateViaCache: "none"
    });

  await navigator.serviceWorker.ready;

  return registration;
}

async function createOrRefreshSubscription(registration: ServiceWorkerRegistration, vapidPublicKey: string) {
  const existingSubscription = await registration.pushManager.getSubscription();

  if (existingSubscription && subscriptionMatchesVapidKey(existingSubscription, vapidPublicKey)) {
    return existingSubscription;
  }

  if (existingSubscription) {
    await existingSubscription.unsubscribe();
  }

  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
  });
}

async function enableNotificationsOnThisDevice(orderId: number, subscription: PushSubscriptionWithJson, vapidPublicKey: string) {
  const response = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(buildSubscribePayload(orderId, subscription, vapidPublicKey))
  });
  const payload = (await response.json().catch(() => null)) as { message?: string } | null;

  if (!response.ok) {
    throw new Error(payload?.message ?? "Unable to enable notifications on this device.");
  }
}

export function EnableOrderNotifications({ orderId }: EnableOrderNotificationsProps) {
  const [linkState, setLinkState] = useState<LinkState>("checking");
  const [permissionState, setPermissionState] = useState<SupportedPermissionState>(() =>
    getPermissionState()
  );
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function inspectDeviceSubscription() {
      const nextPermissionState = getPermissionState();
      if (cancelled) return;

      setPermissionState(nextPermissionState);

      if (nextPermissionState === "unsupported") {
        setLinkState("error");
        setMessage("This device or browser does not support push notifications.");
        return;
      }

      setLinkState("checking");
      setMessage(null);

      if (nextPermissionState !== "granted") {
        if (!cancelled) setLinkState("needs_permission");
        return;
      }

      try {
        const vapidPublicKey = await loadRuntimeVapidPublicKey();

        const registration = await ensureServiceWorkerRegistration();
        const existingSubscription = await registration.pushManager.getSubscription();

        if (
          existingSubscription
          && subscriptionMatchesVapidKey(existingSubscription, vapidPublicKey)
        ) {
          await enableNotificationsOnThisDevice(orderId, existingSubscription as PushSubscriptionWithJson, vapidPublicKey);

          if (!cancelled) {
            setLinkState("linked");
            setMessage(null);
          }
          return;
        }

        if (!cancelled) {
          setLinkState("idle");
          setMessage("Turn on pickup alerts for this device.");
        }
      } catch (error) {
        console.error("order_notification_health_check_failed", {
          orderId,
          error: error instanceof Error ? error.message : "unknown_error"
        });

        if (!cancelled) {
          setLinkState("error");
          setMessage(error instanceof Error ? error.message : "Unable to check notification status.");
        }
      }
    }

    void inspectDeviceSubscription();

    return () => {
      cancelled = true;
    };
  }, [orderId]);

  async function handleEnableNotifications() {
    const nextPermissionState = getPermissionState();
    setPermissionState(nextPermissionState);

    if (nextPermissionState === "unsupported") {
      setLinkState("error");
      setMessage("This device or browser does not support push notifications.");
      return;
    }

    if (isIosDevice() && !isStandaloneMode()) {
      setLinkState("error");
      setMessage("On iPhone or iPad, install Smokehouse to your Home Screen before enabling notifications.");
      return;
    }

    setLinkState("linking");
    setMessage("Turning on pickup alerts for this device...");

    try {
      const permission = nextPermissionState === "granted"
        ? nextPermissionState
        : await Notification.requestPermission();

      setPermissionState(permission);

      if (permission !== "granted") {
        setLinkState("needs_permission");
        setMessage(
          permission === "denied"
            ? "Notifications are blocked in this browser. Allow them in site settings to receive pickup alerts."
            : "Notification permission was dismissed. Tap again if you'd like to enable pickup alerts."
        );
        return;
      }

      const vapidPublicKey = await loadRuntimeVapidPublicKey();
      const registration = await ensureServiceWorkerRegistration();
      const subscription = await createOrRefreshSubscription(registration, vapidPublicKey);

      await enableNotificationsOnThisDevice(orderId, subscription as PushSubscriptionWithJson, vapidPublicKey);

      setLinkState("linked");
      setMessage(null);
    } catch (error) {
      console.error("order_notification_link_failed", {
        orderId,
        error: error instanceof Error ? error.message : "unknown_error"
      });
      setLinkState("error");
      setMessage(error instanceof Error ? error.message : "Unable to enable notifications right now.");
    }
  }

  if (linkState === "linked") {
    return null;
  }

  if (linkState === "checking") {
    return null;
  }

  const isBusy = linkState === "linking";
  const actionLabel = permissionState === "granted" && linkState === "error"
    ? "Retry notifications"
    : "Enable notifications";

  return (
    <div className="mt-5 rounded-md border border-[#2F6B45]/20 bg-[#F2FBF5] p-4 text-sm font-semibold leading-6 text-[#1F4F33]">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#2F6B45]">Pickup alert</p>
      <p className="mt-2 text-[#315F42]">Get a notification when staff mark your order ready on this device.</p>
      {message ? <p className="mt-2 text-[#476F54]">{message}</p> : null}
      <button
        type="button"
        onClick={() => {
          void handleEnableNotifications();
        }}
        disabled={isBusy}
        className="mt-3 rounded-md border border-[#2F6B45]/30 bg-white px-4 py-2 text-xs font-black uppercase tracking-wide text-[#1F4F33] transition hover:bg-[#E0F2E7] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isBusy ? "Linking" : actionLabel}
      </button>
    </div>
  );
}
