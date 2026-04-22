"use client";

import { FormEvent, useMemo, useState } from "react";
import { useCartStore } from "@/lib/store";
import { createOrder } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { useCartHydration } from "@/lib/use-cart-hydration";

export function CheckoutForm() {
  const items = useCartStore((s) => s.items);
  const total = useCartStore((s) => s.total);
  const hydrated = useCartHydration();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pickupTime, setPickupTime] = useState("ASAP");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        items: safeItems.map((item) => ({ menu_item_id: item.menu_item_id, qty: item.qty })),
        pickup_time: pickupTime,
        name: name.trim(),
        phone: phone.trim(),
        notes: notes.trim()
      });

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
    <form onSubmit={onSubmit} className="grid gap-4 lg:grid-cols-[2fr_1fr]">
      <div className="space-y-4 rounded-2xl bg-white p-5 shadow-card">
        <h2 className="text-xl font-bold text-walnut">Guest Checkout</h2>

        <label className="block text-sm font-semibold text-walnut">
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-xl px-3 py-2" required />
        </label>

        <label className="block text-sm font-semibold text-walnut">
          Phone
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 w-full rounded-xl px-3 py-2" required />
        </label>

        <label className="block text-sm font-semibold text-walnut">
          Pickup Time
          <select value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} className="mt-1 w-full rounded-xl px-3 py-2">
            <option value="ASAP">ASAP</option>
            <option value="30">30 min</option>
            <option value="45">45 min</option>
            <option value="60">60 min</option>
          </select>
        </label>

        <label className="block text-sm font-semibold text-walnut">
          Notes
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className="mt-1 w-full rounded-xl px-3 py-2"
            placeholder="Allergies, no onions, etc."
          />
        </label>

        {error ? <p className="rounded-lg bg-red-100 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      </div>

      <aside className="h-fit rounded-2xl bg-white p-5 shadow-card lg:sticky lg:top-6">
        <h3 className="text-lg font-bold text-walnut">Order Summary</h3>
        <p className="mt-1 text-sm text-stone-600">{safeItems.length} line items</p>
        <ul className="mt-3 space-y-2 text-sm text-stone-700">
          {safeItems.map((item) => (
            <li key={item.menu_item_id} className="flex justify-between gap-4">
              <span>
                {item.qty}x {item.name}
              </span>
              <span>{formatCurrency(item.qty * item.price)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex items-center justify-between border-t border-[#e1d2c1] pt-3">
          <span className="font-semibold text-walnut">Total</span>
          <span className="text-xl font-bold text-walnut">{formatCurrency(safeTotal)}</span>
        </div>
        <button type="submit" disabled={disabled} className="btn-primary mt-4 w-full rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-60">
          {submitting ? "Preparing Payment..." : "Pay with Pesapal"}
        </button>
      </aside>
    </form>
  );
}
