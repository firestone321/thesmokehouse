"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
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
      <main className="min-h-screen bg-cream p-6">
        <div className="mx-auto max-w-xl rounded-2xl bg-white p-6 shadow-card">
          <h1 className="text-2xl font-bold text-walnut">Order Not Found</h1>
          <p className="mt-2 text-stone-700">{error}</p>
          <Link href="/" className="btn-primary mt-4 inline-block rounded-xl px-4 py-2 text-sm font-semibold">
            Back to Menu
          </Link>
        </div>
      </main>
    );
  }

  if (!order) {
    return (
      <main className="min-h-screen bg-cream p-6">
        <div className="mx-auto max-w-xl rounded-2xl bg-white p-6 shadow-card">Loading order...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-cream p-6">
      <div className="mx-auto max-w-2xl rounded-2xl bg-white p-6 shadow-card">
        <h1 className="text-3xl font-extrabold text-walnut">{getOrderHeading(order)}</h1>
        <p className="mt-1 text-sm text-stone-600">Track updates live on this page.</p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-sand p-4">
            <p className="text-xs uppercase tracking-wide text-stone-500">Order Number</p>
            <p className="text-2xl font-bold text-walnut">#{order.order_number}</p>
          </div>
          <div className="rounded-xl bg-sand p-4">
            <p className="text-xs uppercase tracking-wide text-stone-500">Pickup Code</p>
            <p className="text-2xl font-bold text-ember">{order.pickup_code ?? "Pending"}</p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-[#e1d2c1] p-4">
          <p className="text-sm text-stone-600">Status</p>
          <p className="text-xl font-bold text-walnut">{formatStatus(order.status)}</p>
          <p className="mt-1 text-sm text-stone-700">Payment: {formatPaymentStatus(order.payment_status)}</p>
          <p className="mt-1 text-sm text-stone-700">Pickup time: {order.pickup_time}</p>
        </div>

        {order.payment_status !== "paid" ? (
          <div className="mt-4 rounded-xl bg-[#fff8ef] p-4 text-sm leading-6 text-stone-700">
            Stock stays untouched until payment is verified. Once Pesapal confirms payment, this order will move into
            the live prep queue automatically.
          </div>
        ) : null}

        <div className="mt-4 space-y-2">
          {order.items?.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-lg bg-[#fff8ef] px-3 py-2 text-sm">
              <span>
                {item.quantity}x {item.menu_items?.name ?? "Item"}
              </span>
              <span>{formatCurrency(item.price_at_time * item.quantity)}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-[#eadccc] pt-3">
          <span className="font-semibold text-walnut">
            {order.payment_status === "paid" ? "Total Paid" : "Order Total"}
          </span>
          <span className="text-lg font-bold text-walnut">{formatCurrency(order.total_amount)}</span>
        </div>

        <Link href="/" className="btn-primary mt-5 inline-block rounded-xl px-5 py-3 text-sm font-semibold">
          Order Again
        </Link>
      </div>
    </main>
  );
}
