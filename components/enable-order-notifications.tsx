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

function buildSubscribePayload(orderId: number, subscription: PushSubscriptionWithJson) {
  return {
    ...subscription.toJSON(),
    orderId
  };
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

async function linkSubscriptionToOrder(orderId: number, subscription: PushSubscriptionWithJson) {
  const response = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(buildSubscribePayload(orderId, subscription))
  });
  const payload = (await response.json().catch(() => null)) as { message?: string } | null;

  if (!response.ok) {
    throw new Error(payload?.message ?? "Unable to link notifications to this order.");
  }
}

export function EnableOrderNotifications({ orderId }: EnableOrderNotificationsProps) {
  const [linkState, setLinkState] = useState<LinkState>("idle");
  const [permissionState, setPermissionState] = useState<SupportedPermissionState>(() =>
    getPermissionState()
  );
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function autoLinkExistingSubscription() {
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
        const registration = await ensureServiceWorkerRegistration();
        const existingSubscription = await registration.pushManager.getSubscription();

        if (!existingSubscription) {
          if (!cancelled) {
            setLinkState("needs_permission");
          }
          return;
        }

        if (!cancelled) {
          setLinkState("linking");
          setMessage("Linking this browser to your current order notifications...");
        }

        await linkSubscriptionToOrder(orderId, existingSubscription as PushSubscriptionWithJson);

        if (!cancelled) {
          setLinkState("linked");
          setMessage(null);
        }
      } catch (error) {
        console.error("order_notification_auto_link_failed", {
          orderId,
          error: error instanceof Error ? error.message : "unknown_error"
        });

        if (!cancelled) {
          setLinkState("error");
          setMessage(error instanceof Error ? error.message : "Unable to link notifications to this order.");
        }
      }
    }

    void autoLinkExistingSubscription();

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
      setMessage("On iPhone, install Smokehouse to your Home Screen before enabling notifications.");
      return;
    }

    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
    if (!vapidPublicKey) {
      setLinkState("error");
      setMessage("Push notifications are not configured yet. Please try again later.");
      return;
    }

    setLinkState("linking");
    setMessage("Linking notifications to this order...");

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

      const registration = await ensureServiceWorkerRegistration();
      const existingSubscription = await registration.pushManager.getSubscription();
      const subscription = existingSubscription
        ?? await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
        });

      await linkSubscriptionToOrder(orderId, subscription as PushSubscriptionWithJson);

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

  const isBusy = linkState === "checking" || linkState === "linking";
  const actionLabel = permissionState === "granted" && linkState === "error"
    ? "Retry notifications"
    : "Enable notifications";

  return (
    <div className="mt-5 rounded-md border border-[#2F6B45]/20 bg-[#F2FBF5] p-4 text-sm font-semibold leading-6 text-[#1F4F33]">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#2F6B45]">Pickup alert</p>
      <p className="mt-2 text-[#315F42]">Get a notification when staff mark this order ready.</p>
      <button
        type="button"
        onClick={() => {
          void handleEnableNotifications();
        }}
        disabled={isBusy}
        className="mt-3 rounded-md border border-[#2F6B45]/30 bg-white px-4 py-2 text-xs font-black uppercase tracking-wide text-[#1F4F33] transition hover:bg-[#E0F2E7] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isBusy ? (linkState === "checking" ? "Checking" : "Linking") : actionLabel}
      </button>
      {message ? <p className="mt-2 text-[#476F54]">{message}</p> : null}
    </div>
  );
}
