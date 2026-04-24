"use client";

import Image from "next/image";
import Link from "next/link";
import { useCartStore } from "@/lib/store";
import { formatCurrency } from "@/lib/format";
import { useCartHydration } from "@/lib/use-cart-hydration";

export function CartView({ showCheckout = true }: { showCheckout?: boolean }) {
  const items = useCartStore((s) => s.items);
  const updateQty = useCartStore((s) => s.updateQty);
  const removeItem = useCartStore((s) => s.removeItem);
  const total = useCartStore((s) => s.total);
  const hydrated = useCartHydration();

  const safeItems = hydrated ? items : [];
  const safeTotal = hydrated ? total() : 0;

  if (safeItems.length === 0) {
    return (
      <div className="mx-auto max-w-3xl rounded-xl border border-[#dcc8b1] bg-[#fff7ec] p-8 text-center shadow-card">
        <h2 className="text-2xl font-black uppercase tracking-wide text-walnut">Your cart is empty</h2>
        <p className="mx-auto mt-2 max-w-md text-sm font-semibold leading-6 text-[#6a5647]">
          Add smoked favorites from the menu and come back here to review quantities before checkout.
        </p>
        <Link href="/" className="btn-primary mt-5 inline-block rounded-md px-5 py-3 text-sm font-extrabold uppercase tracking-wide">
          Browse Menu
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-xl border border-[#d5bea4] bg-[#fff7ec] p-4 shadow-[0_12px_24px_rgba(67,45,28,0.1)]">
        <div className="border-b border-[#dfcbb5] pb-4">
          <h2 className="text-2xl font-black uppercase tracking-wide text-[#2a211a]">Your Cart</h2>
          <p className="mt-1 text-sm font-semibold text-[#6a5647]">{safeItems.length} line items</p>
        </div>
        <div className="mt-4 space-y-3">
        {safeItems.map((item) => (
          <article key={item.menu_item_id} className="rounded-xl border border-[#deccb7] bg-white p-3">
            <div className="flex gap-4">
              <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-[#ede1d0]">
                {item.image_url ? (
                  <Image src={item.image_url} alt={item.name} fill className="object-cover" sizes="96px" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs font-bold uppercase tracking-wide text-[#7a5c44]">
                    Fresh
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-black text-walnut">{item.name}</h3>
                    <p className="mt-1 text-sm font-semibold text-[#6a5647]">{formatCurrency(item.price)} each</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(item.menu_item_id)}
                    className="rounded-md px-3 py-2 text-xs font-extrabold uppercase tracking-wide text-[#a23b22] transition hover:bg-[#f4e2d5]"
                  >
                    Remove
                  </button>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <div className="flex items-center overflow-hidden rounded-md border border-[#d6bea4] bg-[#fff7ec]">
                    <button
                      type="button"
                      onClick={() => updateQty(item.menu_item_id, item.qty - 1)}
                      className="h-10 w-10 text-xl font-black text-[#5b3826] transition hover:bg-[#f4e9d9]"
                      aria-label={`Decrease ${item.name}`}
                    >
                      -
                    </button>
                    <span className="w-10 text-center text-base font-extrabold text-[#2b211b]">{item.qty}</span>
                    <button
                      type="button"
                      onClick={() => updateQty(item.menu_item_id, item.qty + 1)}
                      className="h-10 w-10 text-xl font-black text-[#5b3826] transition hover:bg-[#f4e9d9]"
                      aria-label={`Increase ${item.name}`}
                    >
                      +
                    </button>
                  </div>
                  <p className="text-lg font-black text-[#2b211b]">{formatCurrency(item.qty * item.price)}</p>
                </div>
              </div>
            </div>
          </article>
        ))}
        </div>
      </section>

      <aside className="h-fit rounded-xl border border-[#d5bea4] bg-[#fff7ec] p-4 shadow-[0_12px_24px_rgba(67,45,28,0.1)] lg:sticky lg:top-6">
        <h2 className="text-xl font-black uppercase tracking-wide text-walnut">Summary</h2>
        <div className="mt-4 flex items-center justify-between border-t border-[#dfcbb5] pt-4">
          <span className="text-sm font-bold uppercase tracking-wide text-[#6a5647]">Total</span>
          <span className="text-2xl font-black text-walnut">{formatCurrency(safeTotal)}</span>
        </div>
        {showCheckout ? (
          <Link href="/checkout" className="btn-primary mt-4 block rounded-md px-4 py-3 text-center text-sm font-extrabold uppercase tracking-wide">
            Continue to Checkout
          </Link>
        ) : null}
      </aside>
    </div>
  );
}
