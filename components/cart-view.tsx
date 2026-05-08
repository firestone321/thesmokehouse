"use client";

import Image from "next/image";
import Link from "next/link";
import { useCartStore } from "@/lib/store";
import { formatCurrency } from "@/lib/format";
import { useCartHydration } from "@/lib/use-cart-hydration";

export function CartView({ showCheckout = true }: { showCheckout?: boolean }) {
  const items = useCartStore((s) => s.items);
  const updateQty = useCartStore((s) => s.updateQty);
  const updateAccompanimentQty = useCartStore((s) => s.updateAccompanimentQty);
  const removeItem = useCartStore((s) => s.removeItem);
  const removeAccompaniment = useCartStore((s) => s.removeAccompaniment);
  const total = useCartStore((s) => s.total);
  const hydrated = useCartHydration();

  const safeItems = hydrated ? items : [];
  const safeTotal = hydrated ? total() : 0;

  if (safeItems.length === 0) {
    return (
      <section className="mx-auto grid w-full max-w-6xl min-w-0 gap-6 overflow-hidden rounded-md border border-[#C3C5C1] bg-[#F7F7F4] shadow-[0_20px_50px_rgba(31,31,29,0.12)] md:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 p-6 md:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#666A67]">No fire on the ticket yet</p>
          <h2 className="mt-3 font-heading text-5xl leading-none tracking-normal text-[#30241F]">CART IS EMPTY</h2>
          <p className="mt-4 max-w-xl text-sm font-semibold leading-7 text-[#555854]">
            Add smoked proteins, sides, accompaniments, and drinks from today&apos;s menu. Your pickup order will stay here until payment is confirmed.
          </p>
          <Link href="/" className="btn-primary mt-6 inline-flex rounded-md px-5 py-3 text-sm font-extrabold uppercase tracking-wide">
            Browse Menu
          </Link>
        </div>
        <div className="min-w-0 bg-[#2C2926] p-6 text-[#EEEEEA] md:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#A66B55]">Pickup flow</p>
          <div className="mt-5 space-y-4 text-sm font-semibold leading-6 text-[#C9CBC7]">
            <p>1. Build your order from live stock.</p>
            <p>2. Pay with Pesapal.</p>
            <p>3. Show your pickup code when the kitchen marks it ready.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-7xl min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section className="min-w-0 rounded-md border border-[#C3C5C1] bg-[#F7F7F4] p-4 shadow-[0_20px_50px_rgba(31,31,29,0.1)] md:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#C9CAC7] pb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#666A67]">Current ticket</p>
            <h2 className="mt-1 text-2xl font-black uppercase tracking-wide text-[#242321]">Items on the fireline</h2>
          </div>
          <p className="rounded bg-[#E1E2DE] px-3 py-1 text-sm font-extrabold text-[#30241F]">{safeItems.length} meal groups</p>
        </div>
        <div className="mt-4 space-y-3">
        {safeItems.map((item) => (
          <article key={item.menu_item_id} className="w-full min-w-0 rounded-md border border-[#C9CAC7] bg-[#FCFCFA] p-3 shadow-[0_8px_20px_rgba(31,31,29,0.06)]">
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:gap-4">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md bg-[#242321] sm:h-24 sm:w-24">
                {item.image_url ? (
                  <Image src={item.image_url} alt={item.name} fill className="object-cover" sizes="(max-width: 640px) 80px, 96px" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs font-bold uppercase tracking-wide text-[#A66B55]">
                    Smoke
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="break-words text-lg font-black leading-tight text-walnut">{item.name}</h3>
                    <p className="mt-1 text-sm font-semibold text-[#555854]">{formatCurrency(item.price)} each</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(item.menu_item_id)}
                    className="self-start rounded-md border border-transparent px-3 py-2 text-xs font-extrabold uppercase tracking-wide text-[#743626] transition hover:border-[#C9CAC7] hover:bg-[#ECECEA] sm:ml-2"
                  >
                    Remove
                  </button>
                </div>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex w-fit items-center overflow-hidden rounded-md border border-[#B8BAB6] bg-[#F2F2EF]">
                    <button
                      type="button"
                      onClick={() => updateQty(item.menu_item_id, item.qty - 1)}
                      className="h-10 w-10 text-xl font-black text-[#30241F] transition hover:bg-[#DADBD7]"
                      aria-label={`Decrease ${item.name}`}
                    >
                      -
                    </button>
                    <span className="w-10 text-center text-base font-extrabold text-[#242321]">{item.qty}</span>
                    <button
                      type="button"
                      onClick={() => updateQty(item.menu_item_id, item.qty + 1)}
                      className="h-10 w-10 text-xl font-black text-[#30241F] transition hover:bg-[#DADBD7]"
                      aria-label={`Increase ${item.name}`}
                    >
                      +
                    </button>
                  </div>
                  <p className="text-lg font-black text-[#242321] sm:text-right">{formatCurrency(item.qty * item.price)}</p>
                </div>
                {item.accompaniments?.length ? (
                  <div className="mt-4 space-y-2 border-l-2 border-[#C9CAC7] pl-3">
                    {item.accompaniments.map((accompaniment) => (
                      <div key={accompaniment.menu_item_id} className="rounded-md border border-[#DADBD7] bg-[#F2F2EF] px-2.5 py-2.5">
                        <div className="flex min-w-0 gap-3">
                          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-[#242321]">
                            {accompaniment.image_url ? (
                              <Image src={accompaniment.image_url} alt={accompaniment.name} fill className="object-cover" sizes="56px" />
                            ) : (
                              <div className="flex h-full items-center justify-center text-[10px] font-bold uppercase tracking-wide text-[#A66B55]">
                                Add-on
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 items-start justify-between gap-2">
                              <div className="min-w-0">
                                <h4 className="break-words text-sm font-black leading-tight text-[#30241F]">{accompaniment.name}</h4>
                                <p className="mt-1 text-xs font-semibold text-[#555854]">{formatCurrency(accompaniment.price)} each</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeAccompaniment(item.menu_item_id, accompaniment.menu_item_id)}
                                className="shrink-0 rounded-md border border-transparent px-2 py-1 text-[11px] font-extrabold uppercase tracking-wide text-[#743626] transition hover:border-[#C9CAC7] hover:bg-[#ECECEA]"
                              >
                                Remove
                              </button>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                              <div className="flex w-fit items-center overflow-hidden rounded-md border border-[#B8BAB6] bg-[#FCFCFA]">
                                <button
                                  type="button"
                                  onClick={() => updateAccompanimentQty(item.menu_item_id, accompaniment.menu_item_id, accompaniment.qty - 1)}
                                  className="h-8 w-8 text-lg font-black text-[#30241F] transition hover:bg-[#DADBD7]"
                                  aria-label={`Decrease ${accompaniment.name}`}
                                >
                                  -
                                </button>
                                <span className="w-8 text-center text-sm font-extrabold text-[#242321]">{accompaniment.qty}</span>
                                <button
                                  type="button"
                                  onClick={() => updateAccompanimentQty(item.menu_item_id, accompaniment.menu_item_id, accompaniment.qty + 1)}
                                  disabled={accompaniment.qty >= item.qty}
                                  className="h-8 w-8 text-lg font-black text-[#30241F] transition hover:bg-[#DADBD7] disabled:cursor-not-allowed disabled:opacity-40"
                                  aria-label={`Increase ${accompaniment.name}`}
                                >
                                  +
                                </button>
                              </div>
                              <p className="text-sm font-black text-[#242321]">{formatCurrency(accompaniment.qty * accompaniment.price)}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </article>
        ))}
        </div>
      </section>

      <aside className="h-fit min-w-0 overflow-hidden rounded-md border border-[#C3C5C1] bg-[#F7F7F4] text-[#242321] shadow-[0_20px_50px_rgba(31,31,29,0.12)] lg:sticky lg:top-24">
        <div className="border-b border-[#C9CAC7] p-5">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#666A67]">Order summary</p>
          <h2 className="mt-2 text-xl font-black uppercase tracking-wide text-[#30241F]">Ready for checkout</h2>
        </div>
        <div className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold uppercase tracking-wide text-[#555854]">Total</span>
            <span className="text-2xl font-black text-[#30241F] sm:text-3xl">{formatCurrency(safeTotal)}</span>
          </div>
          <div className="mt-5 space-y-3 border-t border-[#C9CAC7] pt-5 text-sm font-semibold leading-6 text-[#555854]">
            <p>Payment reserves stock only after Pesapal confirms it.</p>
            <p>Pickup code appears after your order is saved.</p>
          </div>
          {showCheckout ? (
            <Link href="/checkout" className="btn-primary mt-5 block rounded-md px-4 py-3 text-center text-sm font-extrabold uppercase tracking-wide">
              Continue to Checkout
            </Link>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
