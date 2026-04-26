"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useCartStore } from "@/lib/store";
import { formatCurrency, formatPaymentStatus, formatStatus } from "@/lib/format";

type PaymentResultOrder = {
  publicToken: string;
  orderNumber: string;
  customerName: string;
  orderStatus: string;
  pickupCode: string | null;
  totalUGX: number;
  paymentStatus: string;
  viewState: "success" | "failed" | "cancelled" | "pending";
  verified: boolean;
  items: Array<{
    name: string;
    quantity: number;
  }>;
};

type PaymentStatusResponse = {
  ok?: boolean;
  order?: PaymentResultOrder;
  message?: string;
};

const POLL_INTERVAL_MS = 10_000;
const MAX_POLL_ATTEMPTS = 5;

const stateStyles = {
  success: {
    eyebrow: "Payment cleared",
    panel: "border-[#2F6B45]/25 bg-[#F2FBF5]",
    marker: "bg-[#2F6B45]",
    title: "text-[#1F4F33]"
  },
  pending: {
    eyebrow: "Verification running",
    panel: "border-[#C28A2E]/30 bg-[#FFF7E5]",
    marker: "bg-[#C28A2E]",
    title: "text-[#6D4415]"
  },
  failed: {
    eyebrow: "Payment problem",
    panel: "border-[#A23B22]/25 bg-[#FFF1E8]",
    marker: "bg-[#A23B22]",
    title: "text-[#7A2A18]"
  },
  cancelled: {
    eyebrow: "Checkout stopped",
    panel: "border-[#61564D]/25 bg-[#F4EFE6]",
    marker: "bg-[#61564D]",
    title: "text-[#3A3029]"
  }
};

function getTitle(viewState: PaymentResultOrder["viewState"] | null) {
  if (viewState === "success") return "Payment confirmed";
  if (viewState === "failed") return "Payment failed";
  if (viewState === "cancelled") return "Payment cancelled";
  return "Payment pending";
}

function getMessage(order: PaymentResultOrder | null) {
  if (!order) {
    return "We could not load your payment result.";
  }

  if (order.viewState === "success") {
    return `Hi ${order.customerName}, we have confirmed your payment and your order is now moving ahead.`;
  }

  if (order.viewState === "failed") {
    return "Pesapal reported the transaction as failed. Your stock remains untouched.";
  }

  if (order.viewState === "cancelled") {
    return "The payment was cancelled or abandoned. Your order remains unpaid and stock is untouched.";
  }

  return "We have not verified a successful payment yet. You can refresh this page in a moment.";
}

export function PaymentResultView() {
  const searchParams = useSearchParams();
  const clearCart = useCartStore((state) => state.clear);
  const [payload, setPayload] = useState<PaymentStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestSequence, setRequestSequence] = useState(0);
  const [pollAttempts, setPollAttempts] = useState(0);
  const hasClearedCartRef = useRef(false);

  const token = searchParams.get("token");
  const hint = searchParams.get("hint") === "cancelled" ? "cancelled" : null;

  const statusUrl = useMemo(() => {
    if (!token) {
      return null;
    }

    const params = new URLSearchParams({
      token,
      refresh: "1"
    });

    if (hint) {
      params.set("hint", hint);
    }

    return `/api/payments/pesapal/status?${params.toString()}`;
  }, [hint, token]);

  useEffect(() => {
    let cancelled = false;

    async function loadStatus() {
      if (!statusUrl) {
        setError("Missing order token.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(statusUrl, { cache: "no-store" });
        const nextPayload = (await response.json().catch(() => null)) as PaymentStatusResponse | null;

        if (!response.ok) {
          throw new Error(nextPayload?.message ?? "Unable to fetch payment status.");
        }

        if (!cancelled) {
          setPayload(nextPayload);
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : "Unable to fetch payment status.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadStatus();

    return () => {
      cancelled = true;
    };
  }, [requestSequence, statusUrl]);

  const order = payload?.order ?? null;
  const title = getTitle(order?.viewState ?? null);
  const message = getMessage(order);
  const currentState = order?.viewState ?? (hint === "cancelled" ? "cancelled" : "pending");
  const styles = stateStyles[currentState];
  const itemCount = order?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;

  useEffect(() => {
    if (order?.viewState !== "success" || hasClearedCartRef.current) {
      return;
    }

    clearCart();
    hasClearedCartRef.current = true;
  }, [clearCart, order?.viewState]);

  useEffect(() => {
    if (!token || isLoading || error || order?.viewState !== "pending" || pollAttempts >= MAX_POLL_ATTEMPTS) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setPollAttempts((current) => current + 1);
      setRequestSequence((current) => current + 1);
    }, POLL_INTERVAL_MS);

    return () => window.clearTimeout(timeout);
  }, [error, isLoading, order?.viewState, pollAttempts, token]);

  return (
    <main className="bg-[#F4EFE6]">
      <section className="border-b border-[#2B211B]/10 bg-[#1C1410] text-[#FFF7EC]">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 md:grid-cols-[minmax(0,1fr)_360px] md:items-end md:px-8 md:py-14">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#E6B36B]">{styles.eyebrow}</p>
            <h1 className="mt-3 font-heading text-5xl leading-none tracking-normal text-[#F8E6C8] md:text-7xl">{title}</h1>
            <p className="mt-4 max-w-2xl text-base font-semibold leading-7 text-[#D8C4AA]">
              {isLoading ? "Verifying your payment with Pesapal and the Smokehouse kitchen..." : error ?? message}
            </p>
          </div>
          <div className="rounded-md border border-[#F7C35F]/15 bg-[#2A211A] p-5">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#E6B36B]">Pickup signal</p>
            <p className="mt-3 text-4xl font-black text-[#F7C35F]">{order?.pickupCode ?? "----"}</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-[#D8C4AA]">
              Show this code when your order reaches ready. Pending payments keep stock untouched.
            </p>
          </div>
        </div>
      </section>

      <section className="px-4 py-8 md:px-8">
        <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
          <section className={`rounded-md border p-5 shadow-[0_20px_50px_rgba(42,33,26,0.1)] ${styles.panel}`}>
            <div className="flex items-start gap-4">
              <span className={`mt-1 h-4 w-4 shrink-0 rounded-full ${styles.marker}`} />
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#6A5647]">Payment status</p>
                <h2 className={`mt-2 text-2xl font-black uppercase tracking-wide ${styles.title}`}>
                  {isLoading ? "Checking payment" : error ? "Status unavailable" : formatPaymentStatus(order?.paymentStatus ?? "pending")}
                </h2>
                <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-[#4A3A30]">
                  {isLoading ? "This can take a few seconds after returning from Pesapal." : error ?? message}
                </p>
              </div>
            </div>

            {order && !isLoading && !error ? (
              <div className="mt-6 grid gap-3 md:grid-cols-2">
                <div className="rounded-md border border-[#2B211B]/10 bg-white/70 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8A6246]">Order number</p>
                  <p className="mt-2 text-2xl font-black text-[#2A211A]">#{order.orderNumber}</p>
                </div>
                <div className="rounded-md border border-[#2B211B]/10 bg-white/70 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8A6246]">Total</p>
                  <p className="mt-2 text-2xl font-black text-[#2A211A]">{formatCurrency(order.totalUGX)}</p>
                </div>
                <div className="rounded-md border border-[#2B211B]/10 bg-white/70 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8A6246]">Kitchen state</p>
                  <p className="mt-2 text-lg font-black text-[#2A211A]">{formatStatus(order.orderStatus)}</p>
                </div>
                <div className="rounded-md border border-[#2B211B]/10 bg-white/70 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8A6246]">Pesapal check</p>
                  <p className="mt-2 text-lg font-black text-[#2A211A]">{order.verified ? "Verified" : "Not verified yet"}</p>
                </div>
              </div>
            ) : null}

            {order?.items.length ? (
              <div className="mt-6 rounded-md border border-[#2B211B]/10 bg-white/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-black uppercase tracking-wide text-[#2A211A]">Order items</h3>
                  <p className="text-sm font-bold text-[#6A5647]">{itemCount} items</p>
                </div>
                <ul className="mt-3 divide-y divide-[#2B211B]/10 text-sm font-semibold text-[#4A3A30]">
                  {order.items.map((item) => (
                    <li key={item.name} className="flex justify-between gap-4 py-2">
                      <span>{item.name}</span>
                      <span>x{item.quantity}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

          <aside className="h-fit rounded-md border border-[#2B211B]/10 bg-[#FFF8EF] p-5 shadow-[0_20px_50px_rgba(42,33,26,0.1)] lg:sticky lg:top-24">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#8A6246]">Next move</p>
            <div className="mt-4 space-y-3">
              {order ? (
                <Link href={`/order/${order.publicToken}`} className="btn-primary block rounded-md px-4 py-3 text-center text-sm font-extrabold uppercase tracking-wide">
                  View Order
                </Link>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setPollAttempts(0);
                  setRequestSequence((current) => current + 1);
                }}
                disabled={!token || isLoading}
                className="block w-full rounded-md border border-[#4B2E1F]/25 bg-white px-4 py-3 text-center text-sm font-extrabold uppercase tracking-wide text-[#4B2E1F] transition hover:bg-[#F8E6C8] disabled:opacity-60"
              >
                Check Status
              </button>
              <Link href="/checkout" className="block rounded-md border border-[#4B2E1F]/25 bg-white px-4 py-3 text-center text-sm font-extrabold uppercase tracking-wide text-[#4B2E1F] hover:bg-[#F8E6C8]">
                Back to Checkout
              </Link>
              <Link href="/" className="block rounded-md border border-[#4B2E1F]/25 bg-white px-4 py-3 text-center text-sm font-extrabold uppercase tracking-wide text-[#4B2E1F] hover:bg-[#F8E6C8]">
                Browse Menu
              </Link>
            </div>
            <div className="mt-5 border-t border-[#2B211B]/10 pt-5 text-sm font-semibold leading-6 text-[#6A5647]">
              <p>Paid orders enter the kitchen queue automatically. Ready orders are completed only after pickup-code verification.</p>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
