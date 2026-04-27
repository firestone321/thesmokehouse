"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { EnableOrderNotifications } from "@/components/enable-order-notifications";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getOrderByPublicToken } from "@/lib/api";
import { Order } from "@/lib/types";
import { formatCurrency, formatPaymentStatus, formatStatus } from "@/lib/format";

function getOrderHeading(order: Order) {
  if (order.payment_status === "paid") {
    return "Order Confirmed";
  }

  if (order.payment_status === "failed") {
    return "Payment Failed";
  }

  if (order.payment_status === "cancelled") {
    return "Payment Cancelled";
  }

  return "Payment Pending";
}

function getOrderMessage(order: Order) {
  if (order.payment_status === "paid") {
    return "Your payment is confirmed and the kitchen can move this order through prep to pickup.";
  }

  if (order.payment_status === "failed") {
    return "Pesapal did not clear this payment. Stock has not been reserved for this order.";
  }

  if (order.payment_status === "cancelled") {
    return "Checkout was cancelled or abandoned. Stock has not been reserved for this order.";
  }

  return "We are still waiting for payment verification. This page refreshes automatically.";
}

function getUnpaidAsideMessage(order: Order) {
  if (order.payment_status === "cancelled") {
    return "This checkout was cancelled, so stock was not reserved. Start a fresh order when you are ready.";
  }

  if (order.payment_status === "failed") {
    return "Payment did not clear, so stock was not reserved. You can return to the menu and place a fresh order.";
  }

  return "Stock stays untouched until Pesapal confirms payment.";
}

const paymentStyles = {
  paid: {
    eyebrow: "Order confirmed",
    panel: "border-[#2F6B45]/25 bg-[#F2FBF5]",
    marker: "bg-[#2F6B45]",
    title: "text-[#1F4F33]"
  },
  pending: {
    eyebrow: "Payment pending",
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

export default function OrderTrackingPage() {
  const params = useParams<{ public_token: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const data = await getOrderByPublicToken(params.public_token);
        if (active) {
          setOrder(data);
          setError(null);
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Order not found");
      }
    }

    void load();
    const timer = setInterval(() => {
      void load();
    }, 15000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [params.public_token]);

  if (error) {
    return (
      <div className="min-h-screen bg-[#F4EFE6]">
        <SiteHeader />
        <main className="min-h-[70vh] px-4 py-12 md:px-8">
          <section className="mx-auto max-w-4xl rounded-md border border-[#A23B22]/20 bg-[#FFF1E8] p-6 shadow-[0_20px_50px_rgba(42,33,26,0.1)]">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#A23B22]">Tracking unavailable</p>
            <h1 className="mt-3 font-heading text-5xl leading-none tracking-normal text-[#4B2E1F]">ORDER NOT FOUND</h1>
            <p className="mt-4 text-sm font-semibold leading-7 text-[#6A5647]">{error}</p>
            <Link href="/" className="btn-primary mt-6 inline-flex rounded-md px-5 py-3 text-sm font-extrabold uppercase tracking-wide">
              Back to Menu
            </Link>
          </section>
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-[#F4EFE6]">
        <SiteHeader />
        <main className="min-h-[70vh] px-4 py-12 md:px-8">
          <div className="mx-auto max-w-4xl rounded-md border border-[#2B211B]/10 bg-[#FFF8EF] p-6 text-[#4B2E1F] shadow-card">
            Loading order...
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const styles = paymentStyles[order.payment_status];
  const itemCount = order.items?.reduce((sum, item) => sum + item.quantity, 0) ?? 0;

  return (
    <div className="min-h-screen bg-[#F4EFE6]">
      <SiteHeader />
      <main>
        <section className="border-b border-[#2B211B]/10 bg-[#1C1410] text-[#FFF7EC]">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 md:grid-cols-[minmax(0,1fr)_360px] md:items-end md:px-8 md:py-14">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#E6B36B]">{styles.eyebrow}</p>
              <h1 className="mt-3 font-heading text-5xl leading-none tracking-normal text-[#F8E6C8] md:text-7xl">
                {getOrderHeading(order)}
              </h1>
              <p className="mt-4 max-w-2xl text-base font-semibold leading-7 text-[#D8C4AA]">
                Track this pickup ticket live. We refresh the kitchen state every few seconds.
              </p>
            </div>
            <div className="rounded-md border border-[#F7C35F]/15 bg-[#2A211A] p-5">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#E6B36B]">Pickup code</p>
              <p className="mt-3 text-4xl font-black text-[#F7C35F]">{order.pickup_code ?? "----"}</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-[#D8C4AA]">
                Show this code when staff mark your order ready.
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
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#6A5647]">Current state</p>
                  <h2 className={`mt-2 text-2xl font-black uppercase tracking-wide ${styles.title}`}>
                    {formatStatus(order.status)}
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-[#4A3A30]">
                    {getOrderMessage(order)}
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-2">
                <div className="rounded-md border border-[#2B211B]/10 bg-white/70 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8A6246]">Order number</p>
                  <p className="mt-2 text-2xl font-black text-[#2A211A]">#{order.order_number}</p>
                </div>
                <div className="rounded-md border border-[#2B211B]/10 bg-white/70 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8A6246]">
                    {order.payment_status === "paid" ? "Total paid" : "Order total"}
                  </p>
                  <p className="mt-2 text-2xl font-black text-[#2A211A]">{formatCurrency(order.total_amount)}</p>
                </div>
                <div className="rounded-md border border-[#2B211B]/10 bg-white/70 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8A6246]">Payment</p>
                  <p className="mt-2 text-lg font-black text-[#2A211A]">{formatPaymentStatus(order.payment_status)}</p>
                </div>
                <div className="rounded-md border border-[#2B211B]/10 bg-white/70 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8A6246]">Pickup time</p>
                  <p className="mt-2 text-lg font-black text-[#2A211A]">{order.pickup_time}</p>
                </div>
              </div>

              {order.items?.length ? (
                <div className="mt-6 rounded-md border border-[#2B211B]/10 bg-white/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-black uppercase tracking-wide text-[#2A211A]">Order items</h3>
                    <p className="text-sm font-bold text-[#6A5647]">{itemCount} items</p>
                  </div>
                  <ul className="mt-3 divide-y divide-[#2B211B]/10 text-sm font-semibold text-[#4A3A30]">
                    {order.items.map((item) => (
                      <li key={item.id} className="flex items-center justify-between gap-4 py-2">
                        <span>
                          {item.quantity}x {item.menu_items?.name ?? "Item"}
                        </span>
                        <span>{formatCurrency(item.price_at_time * item.quantity)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>

            <aside className="h-fit rounded-md border border-[#2B211B]/10 bg-[#FFF8EF] p-5 shadow-[0_20px_50px_rgba(42,33,26,0.1)] lg:sticky lg:top-24">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#8A6246]">Pickup guide</p>
              <div className="mt-4 space-y-3 text-sm font-semibold leading-6 text-[#6A5647]">
                <p>Paid orders move into the kitchen queue automatically.</p>
                <p>When this page says ready, bring the pickup code to the counter.</p>
                <p>Staff complete the order only after matching your code.</p>
              </div>
              {order.payment_status !== "paid" ? (
                <div className="mt-5 rounded-md border border-[#C28A2E]/25 bg-[#FFF7E5] p-4 text-sm font-semibold leading-6 text-[#6D4415]">
                  {getUnpaidAsideMessage(order)}
                </div>
              ) : null}
              {order.payment_status === "paid" ? <EnableOrderNotifications orderId={order.id} /> : null}
              <div className="mt-5 grid gap-3 border-t border-[#2B211B]/10 pt-5">
                <Link href="/" className="btn-primary block rounded-md px-4 py-3 text-center text-sm font-extrabold uppercase tracking-wide">
                  Order Again
                </Link>
                <Link href="/cart" className="block rounded-md border border-[#4B2E1F]/25 bg-white px-4 py-3 text-center text-sm font-extrabold uppercase tracking-wide text-[#4B2E1F] hover:bg-[#F8E6C8]">
                  View Cart
                </Link>
              </div>
            </aside>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
