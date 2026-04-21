"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { MenuItem } from "@/lib/types";
import { formatCurrency } from "@/lib/format";
import { useCartStore } from "@/lib/store";
import { useCartHydration } from "@/lib/use-cart-hydration";

export function MenuClient({ items }: { items: MenuItem[] }) {
  const [active, setActive] = useState<string>("");
  const [pickupTime, setPickupTime] = useState("ASAP");

  const cartItems = useCartStore((s) => s.items);
  const addItem = useCartStore((s) => s.addItem);
  const count = useCartStore((s) => s.count);
  const total = useCartStore((s) => s.total);
  const hydrated = useCartHydration();

  const availableCategories = useMemo(
    () =>
      Array.from(
        items.reduce((categoryMap, item) => {
          if (!categoryMap.has(item.category)) {
            categoryMap.set(item.category, {
              key: item.category,
              label: item.category_label
            });
          }

          return categoryMap;
        }, new Map<string, { key: string; label: string }>())
      ).map(([, category]) => category),
    [items]
  );

  useEffect(() => {
    if (availableCategories.length === 0) {
      return;
    }

    if (!availableCategories.some((category) => category.key === active)) {
      setActive(availableCategories[0]!.key);
    }
  }, [active, availableCategories]);

  const safeCartItems = hydrated ? cartItems : [];
  const safeCount = hydrated ? count() : 0;
  const safeTotal = hydrated ? total() : 0;

  const filtered = useMemo(() => items.filter((item) => item.category === active), [active, items]);

  return (
    <section id="menu-section" className="mx-auto max-w-7xl px-4 pb-24 pt-5 md:px-8 md:pt-6 lg:pb-10">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <div className="mb-3 flex gap-2 overflow-auto pb-1">
            {availableCategories.map((cat) => {
              const activeCls = active === cat.key ? "bg-ember text-white border-ember" : "bg-[#efe6d8] text-[#2c231d] border-[#dcc8b1]";
              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setActive(cat.key)}
                  className={`min-w-fit rounded-md border px-4 py-2 text-sm font-extrabold uppercase tracking-wide transition ${activeCls}`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((item) => {
              const isOutOfStock = !item.is_available;
              const stockMessage = isOutOfStock
                ? "Out of stock"
                : item.available_quantity <= 10
                  ? `Only ${item.available_quantity} left`
                  : null;

              return (
                <article key={item.id} className="overflow-hidden rounded-xl border border-[#d8c1a7] bg-[#fffaf2] shadow-[0_8px_20px_rgba(64,45,30,0.1)]">
                  <div className="relative h-40 w-full bg-[#ede1d0]">
                    {item.image_url ? (
                      <Image src={item.image_url} alt={item.name} fill className="object-cover" sizes="(max-width: 1024px) 50vw, 33vw" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs font-semibold uppercase tracking-wide text-[#6f5745]">
                        Fresh today
                      </div>
                    )}
                    <span className="absolute left-2 top-2 rounded bg-ember px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                      {item.category_label}
                    </span>
                  </div>

                  <div className="px-3 pb-2 pt-3">
                    <h3 className="text-base font-extrabold text-[#1f1a17]">{item.name}</h3>
                    <p className="mt-1 min-h-10 text-sm font-medium text-[#4f4138]">
                      {item.description ?? "House-smoked and finished fresh to order."}
                    </p>
                    {stockMessage ? (
                      <p className={`mt-2 text-xs font-bold uppercase tracking-wide ${isOutOfStock ? "text-[#8d3d2f]" : "text-[#9a5a1d]"}`}>
                        {stockMessage}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex items-center justify-between border-t border-[#dfcbb5] bg-[#f4e9d9] px-3 py-2">
                    <span className="text-base font-black text-[#2b211b]">{formatCurrency(item.price)}</span>
                    <button
                      type="button"
                      disabled={isOutOfStock}
                      onClick={() => addItem({ menu_item_id: item.id, name: item.name, price: item.price, image_url: item.image_url })}
                      className={`rounded-md px-4 py-2 text-xs font-extrabold uppercase tracking-wide ${
                        isOutOfStock ? "cursor-not-allowed bg-[#d2bdaa] text-[#fff7ec] opacity-80" : "btn-primary"
                      }`}
                    >
                      {isOutOfStock ? "Sold Out" : "Add"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <aside className="hidden lg:flex lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] lg:flex-col lg:rounded-xl lg:border lg:border-[#d5bea4] lg:bg-[#fff7ec] lg:p-4 lg:shadow-[0_12px_24px_rgba(67,45,28,0.12)]">
          <div>
            <h2 className="text-xl font-black uppercase tracking-wide text-[#2a211a]">Your Order</h2>
            <label className="mt-3 block text-xs font-bold uppercase tracking-wide text-[#6a5647]">
              Pickup Time
              <select value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} className="mt-1 w-full rounded-md px-3 py-2 text-sm font-semibold">
                <option value="ASAP">ASAP</option>
                <option value="30">30 min</option>
                <option value="45">45 min</option>
                <option value="60">60 min</option>
              </select>
            </label>
          </div>

          <div className="mt-4 flex-1 overflow-y-auto pr-1">
            {safeCartItems.length === 0 ? (
              <div className="rounded-md border border-dashed border-[#d4c1aa] bg-[#f6ecdf] p-4 text-sm font-semibold text-[#6a5647]">
                Your order is empty. Add smoked favorites from the menu.
              </div>
            ) : (
              <div className="space-y-2">
                {safeCartItems.map((item) => (
                  <div key={item.menu_item_id} className="rounded-md border border-[#deccb7] bg-white px-3 py-2">
                    <p className="text-sm font-extrabold text-[#2b211b]">{item.name}</p>
                    <div className="mt-1 flex items-center justify-between text-xs font-semibold text-[#5d4a3f]">
                      <span>{item.qty}x</span>
                      <span>{formatCurrency(item.qty * item.price)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 border-t border-[#dbc5ad] pt-3">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-bold uppercase tracking-wide text-[#5b4a3f]">Total</p>
              <p className="text-2xl font-black text-[#241b15]">{formatCurrency(safeTotal)}</p>
            </div>
            {safeCartItems.length === 0 ? (
              <button type="button" disabled className="w-full rounded-md bg-[#c9b39a] px-4 py-3 text-sm font-extrabold uppercase tracking-wide text-[#fff7ec] opacity-80">
                Place Order
              </button>
            ) : (
              <Link href="/checkout" className="btn-primary block w-full rounded-md px-4 py-3 text-center text-sm font-extrabold uppercase tracking-wide">
                Place Order
              </Link>
            )}
          </div>
        </aside>
      </div>

      <Link
        href="/cart"
        className="fixed bottom-4 left-4 right-4 z-40 flex items-center justify-between rounded-xl bg-walnut px-4 py-3 text-cream shadow-xl lg:hidden"
      >
        <span className="text-sm font-bold uppercase tracking-wide">{safeCount} Items</span>
        <span className="text-base font-black">{formatCurrency(safeTotal)}</span>
        <span className="rounded-md bg-ember px-3 py-1 text-sm font-bold uppercase tracking-wide text-white">View Cart</span>
      </Link>
    </section>
  );
}
