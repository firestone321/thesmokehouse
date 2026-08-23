"use client";

import Link from "next/link";
import { useState } from "react";
import { formatCurrency, formatPaymentStatus, formatStatus } from "@/lib/format";
import type { Order } from "@/lib/types";

type HistoryState = "idle" | "loading" | "ready" | "error";

export function OrderHistoryCard() {
  const [isOpen, setIsOpen] = useState(false);
  const [historyState, setHistoryState] = useState<HistoryState>("idle");
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function loadHistory() {
    setHistoryState("loading");
    setError(null);

    try {
      const response = await fetch("/api/account/orders", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as { orders?: Order[]; error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to load your order history.");
      }

      setOrders(payload?.orders ?? []);
      setHistoryState("ready");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load your order history.");
      setHistoryState("error");
    }
  }

  function handleToggle() {
    const nextIsOpen = !isOpen;
    setIsOpen(nextIsOpen);

    if (nextIsOpen && historyState !== "ready" && historyState !== "loading") {
      void loadHistory();
    }
  }

  return (
    <div className="mt-6 rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface-alt)] p-4">
      <button
        type="button"
        aria-controls="account-order-history-panel"
        aria-expanded={isOpen}
        onClick={handleToggle}
        className="flex w-full items-center justify-between gap-4 text-left"
      >
        <span>
          <span className="block text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
            Order history
          </span>
          <span className="mt-2 block text-sm font-semibold leading-6 text-[var(--foreground)]">
            View orders placed while signed in to this account.
          </span>
        </span>
        <span className="shrink-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-extrabold uppercase tracking-wide text-[var(--foreground)]">
          {isOpen ? "Hide" : "View"}
        </span>
      </button>

      {isOpen ? (
        <div id="account-order-history-panel" className="mt-4 border-t border-[var(--border)] pt-4">
          {historyState === "loading" ? (
            <p className="text-sm font-semibold text-[var(--muted)]">Loading your order history…</p>
          ) : error ? (
            <div className="space-y-3">
              <p className="text-sm font-semibold leading-6 text-red-600">{error}</p>
              <button
                type="button"
                onClick={() => {
                  void loadHistory();
                }}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-extrabold uppercase tracking-wide text-[var(--foreground)]"
              >
                Try again
              </button>
            </div>
          ) : orders.length === 0 ? (
            <p className="text-sm font-semibold leading-6 text-[var(--muted)]">
              No signed-in orders yet. Orders placed as a guest or through the admin POS are not added to this account history.
            </p>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => {
                const itemCount = order.items?.reduce((total, item) => total + item.quantity, 0) ?? 0;

                return (
                  <article key={order.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black uppercase tracking-wide text-[var(--foreground)]">
                          Order #{order.order_number}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-[var(--muted)]">{order.created_at_eat}</p>
                      </div>
                      <p className="text-lg font-black text-[var(--foreground)]">{formatCurrency(order.total_amount)}</p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold uppercase tracking-wide">
                      <span className="rounded-full bg-[var(--surface-alt)] px-2.5 py-1 text-[var(--foreground)]">
                        {formatStatus(order.status)}
                      </span>
                      <span className="rounded-full bg-[var(--surface-alt)] px-2.5 py-1 text-[var(--muted)]">
                        {formatPaymentStatus(order.payment_status)}
                      </span>
                      <span className="rounded-full bg-[var(--surface-alt)] px-2.5 py-1 text-[var(--muted)]">
                        {itemCount} {itemCount === 1 ? "item" : "items"}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          <Link
            href="/order"
            className="mt-4 inline-flex rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-extrabold uppercase tracking-wide text-[var(--foreground)] transition hover:bg-[var(--surface-raised)]"
          >
            Open Current Order for pickup code
          </Link>
        </div>
      ) : null}
    </div>
  );
}
