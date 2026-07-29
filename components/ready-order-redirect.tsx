"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getCurrentOrder } from "@/lib/api";

function isInstalledApp() {
  try {
    if (window.matchMedia("(display-mode: standalone)").matches) {
      return true;
    }
  } catch {
    // Fall through to the iOS standalone flag.
  }

  return (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function ReadyOrderRedirect() {
  const router = useRouter();

  useEffect(() => {
    if (!isInstalledApp()) {
      return;
    }

    let active = true;

    void getCurrentOrder()
      .then((order) => {
        if (!active || order.status !== "ready" || !order.public_token) {
          return;
        }

        router.replace(`/order/${order.public_token}`);
      })
      .catch(() => {
        // No accessible Ready order is saved on this device; leave the customer on the homepage.
      });

    return () => {
      active = false;
    };
  }, [router]);

  return null;
}
