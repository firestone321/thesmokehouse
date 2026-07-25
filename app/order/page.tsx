"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getCurrentOrder } from "@/lib/api";
import { getRememberedGuestOrderToken, syncGuestOrderFromServer } from "@/lib/guest-order";

type LookupState = "checking" | "empty" | "expired" | "error";

export default function LastGuestOrderPage() {
  const router = useRouter();
  const [state, setState] = useState<LookupState>("checking");
  const [message, setMessage] = useState("Looking for the pickup order saved on this device...");

  useEffect(() => {
    let active = true;

    async function resolveRememberedOrder() {
      try {
        const order = await getCurrentOrder();
        const { isExpiredReceipt } = syncGuestOrderFromServer(order);

        if (!active) {
          return;
        }

        if (isExpiredReceipt) {
          setState("expired");
          setMessage("Your completed order receipt was kept for 24 hours and has now expired on this device.");
          return;
        }

        router.replace(`/order/${order.public_token}`);
      } catch (error) {
        if (active) {
          const rememberedToken = getRememberedGuestOrderToken();
          const fallbackMessage = error instanceof Error ? error.message : "There is no active pickup order saved on this device.";
          const friendlyMessage = fallbackMessage === "Missing valid order access session."
            ? "You do not have an order saved on this device yet. Place an order first, and you can come back here anytime to check its status."
            : fallbackMessage;

          if (rememberedToken) {
            router.replace(`/order/${rememberedToken}`);
            return;
          }

          setState("empty");
          setMessage(friendlyMessage);
        }
      }
    }

    void resolveRememberedOrder();

    return () => {
      active = false;
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-[#F4EFE6]">
      <SiteHeader />
      <main className="min-h-[70vh] px-4 py-12 md:px-8">
        <section className="mx-auto max-w-4xl rounded-md border border-[#2B211B]/10 bg-[#FFF8EF] p-6 shadow-[0_20px_50px_rgba(42,33,26,0.1)]">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#8A6246]">
            {state === "checking" ? "Checking this device" : "Guest pickup"}
          </p>
          <h1 className="mt-3 font-heading text-5xl leading-none tracking-normal text-[#4B2E1F]">
            {state === "checking" ? "Opening Order" : "No Active Order"}
          </h1>
          <p className="mt-4 text-sm font-semibold leading-7 text-[#6A5647]">{message}</p>
          {state !== "checking" ? (
            <Link href="/" className="btn-primary mt-6 inline-flex rounded-md px-5 py-3 text-sm font-extrabold uppercase tracking-wide">
              Start a New Order
            </Link>
          ) : null}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
