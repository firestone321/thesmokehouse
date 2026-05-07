"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { useCartStore } from "@/lib/store";
import { createOrder } from "@/lib/api";
import { flattenCartForCheckout } from "@/lib/cart";
import { formatCurrency } from "@/lib/format";
import { rememberGuestOrder } from "@/lib/guest-order";
import { useCartHydration } from "@/lib/use-cart-hydration";

export function CheckoutForm() {
  const items = useCartStore((s) => s.items);
  const total = useCartStore((s) => s.total);
  const hydrated = useCartHydration();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pickupTime, setPickupTime] = useState("15");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idempotencyKey = useRef(crypto.randomUUID());

  const safeItems = hydrated ? items : [];
  const safeTotal = hydrated ? total() : 0;
  const disabled = useMemo(() => !hydrated || safeItems.length === 0 || submitting, [hydrated, safeItems.length, submitting]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !phone.trim()) {
      setError("Please fill in your name and phone number.");
      return;
    }

    setSubmitting(true);

    try {
      const result = await createOrder({
        items: flattenCartForCheckout(safeItems),
        pickup_time: pickupTime,
        name: name.trim(),
        phone: phone.trim(),
        notes: notes.trim(),
        idempotency_key: idempotencyKey.current
      });

      rememberGuestOrder(result.public_token);

      if (result.redirect_url) {
        window.location.assign(result.redirect_url);
        return;
      }

      window.location.assign(`/payment/result?token=${encodeURIComponent(result.public_token)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to place order");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-4 rounded-2xl border border-[#C3C5C1] bg-[#F7F7F4] p-5 shadow-card">
        <h2 className="text-xl font-bold text-[#30241F]">Guest Checkout</h2>

        <label className="block text-sm font-semibold text-[#30241F]">
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-xl px-3 py-2" required />
        </label>

        <label className="block text-sm font-semibold text-[#30241F]">
          Phone
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 w-full rounded-xl px-3 py-2" required />
        </label>

        <label className="block text-sm font-semibold text-[#30241F]">
          Pickup Time
          <select value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} className="mt-1 w-full rounded-xl px-3 py-2">
            <option value="15">15 min</option>
            <option value="30">30 min</option>
            <option value="45">45 min</option>
            <option value="60">60 min</option>
          </select>
        </label>

        <label className="block text-sm font-semibold text-[#30241F]">
          Notes
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className="mt-1 w-full rounded-xl px-3 py-2"
            placeholder="Allergies, no onions, etc."
          />
        </label>

        {error ? <p className="rounded-lg bg-[#E5D8D4] px-3 py-2 text-sm font-semibold text-[#6A3025]">{error}</p> : null}
      </div>

      <aside className="h-fit min-w-0 rounded-2xl border border-[#C3C5C1] bg-[#F7F7F4] p-5 shadow-card lg:sticky lg:top-6">
        <h3 className="text-lg font-bold text-[#30241F]">Order Summary</h3>
        <p className="mt-1 text-sm text-[#666A67]">{safeItems.length} meal groups</p>
        <ul className="mt-3 space-y-2 text-sm text-[#424440]">
          {safeItems.map((item) => (
            <li key={item.menu_item_id} className="space-y-1">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <span className="min-w-0 break-words">
                  {item.qty}x {item.name}
                </span>
                <span className="shrink-0">{formatCurrency(item.qty * item.price)}</span>
              </div>
              {item.accompaniments?.length ? (
                <ul className="space-y-1 border-l border-[#C9CAC7] pl-3 text-[#555854]">
                  {item.accompaniments.map((accompaniment) => (
                    <li key={accompaniment.menu_item_id} className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                      <span className="min-w-0 break-words">
                        {accompaniment.qty}x {accompaniment.name}
                      </span>
                      <span className="shrink-0">{formatCurrency(accompaniment.qty * accompaniment.price)}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
        <div className="mt-4 flex items-start justify-between gap-3 border-t border-[#C9CAC7] pt-3">
          <span className="font-semibold text-[#30241F]">Total</span>
          <span className="shrink-0 text-xl font-bold text-[#30241F]">{formatCurrency(safeTotal)}</span>
        </div>
        <button type="submit" disabled={disabled} className="btn-primary mt-4 w-full rounded-xl px-4 py-3 text-sm font-semibold">
          {submitting ? "Preparing Payment..." : "Pay with Pesapal"}
        </button>
      </aside>
    </form>
  );
}
