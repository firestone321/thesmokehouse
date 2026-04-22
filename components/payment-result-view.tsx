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
    <main className="min-h-screen bg-cream p-6">
      <div className="mx-auto max-w-3xl rounded-2xl bg-white p-6 shadow-card">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-stone-500">Firestone Country Smokehouse</p>
        <h1 className="mt-2 text-3xl font-extrabold text-walnut">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-stone-700">
          {isLoading ? "Verifying your payment with the backend..." : error ?? message}
        </p>

        {order && !isLoading && !error ? (
          <section className="mt-5 rounded-xl border border-[#e1d2c1] bg-[#fff8ef] p-4 text-sm text-stone-700">
            <h2 className="text-lg font-bold text-walnut">Payment summary</h2>
            <div className="mt-3 space-y-2">
              <p>Order number: #{order.orderNumber}</p>
              <p>Order total: {formatCurrency(order.totalUGX)}</p>
              <p>Payment status: {formatPaymentStatus(order.paymentStatus)}</p>
              <p>Order status: {formatStatus(order.orderStatus)}</p>
              <p>Verified with Pesapal: {order.verified ? "yes" : "no"}</p>
              <p>Pickup code: {order.pickupCode ?? "Pending"}</p>
            </div>
          </section>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          {order ? (
            <Link href={`/order/${order.publicToken}`} className="btn-primary rounded-xl px-4 py-3 text-sm font-semibold">
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
            className="rounded-xl border border-[#d8c1a7] px-4 py-3 text-sm font-semibold text-walnut disabled:opacity-60"
          >
            Check Status
          </button>
          <Link href="/checkout" className="rounded-xl border border-[#d8c1a7] px-4 py-3 text-sm font-semibold text-walnut">
            Back to Checkout
          </Link>
          <Link href="/" className="rounded-xl border border-[#d8c1a7] px-4 py-3 text-sm font-semibold text-walnut">
            Browse Menu
          </Link>
        </div>
      </div>
    </main>
  );
}
