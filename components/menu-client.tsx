"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { MenuItem } from "@/lib/types";
import { formatCurrency } from "@/lib/format";
import { useCartStore } from "@/lib/store";
import { useCartHydration } from "@/lib/use-cart-hydration";
import { STOREFRONT_LOW_STOCK_COUNT_THRESHOLD } from "@/lib/stock-thresholds";
import { getUgandaServiceDate } from "@/lib/menu-stock";
import {
  isFridayThroughSundayServiceDate,
  isPubliclyAvailableOnServiceDate,
  isWeekendSpecialMenuItem
} from "@/lib/special-menu-availability";

const storefrontCategoryOrder = ["country_platter", "beef", "goat", "chicken", "sides"];

export function MenuClient({ items: initialItems }: { items: MenuItem[] }) {
  const [active, setActive] = useState<string>("");
  const [pickupTime, setPickupTime] = useState("15");
  const [items, setItems] = useState<MenuItem[]>(initialItems);
  const [autoAddedId, setAutoAddedId] = useState<number | null>(null);
  const autoAddTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/menu")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (Array.isArray(data)) setItems(data);
      })
      .catch(() => null);
  }, []);

  useEffect(() => {
    return () => {
      if (autoAddTimer.current) clearTimeout(autoAddTimer.current);
    };
  }, []);

  const cartItems = useCartStore((s) => s.items);
  const addItem = useCartStore((s) => s.addItem);
  const updateQty = useCartStore((s) => s.updateQty);
  const setGroupAddOn = useCartStore((s) => s.setGroupAddOn);
  const updateAccompanimentQty = useCartStore((s) => s.updateAccompanimentQty);
  const removeItem = useCartStore((s) => s.removeItem);
  const removeAccompaniment = useCartStore((s) => s.removeAccompaniment);
  const count = useCartStore((s) => s.count);
  const total = useCartStore((s) => s.total);
  const hydrated = useCartHydration();

  const drinkItems = useMemo(() => items.filter((item) => item.category === "drinks"), [items]);
  const accompanimentItems = useMemo(() => items.filter((item) => item.category === "accompaniments"), [items]);
  const storefrontItems = useMemo(
    () => items.filter((item) => item.category !== "drinks" && item.category !== "accompaniments"),
    [items]
  );
  const accompanimentList = useMemo(() => accompanimentItems, [accompanimentItems]);

  const availableCategories = useMemo(() => {
    const getCategoryRank = (category: { key: string; label: string }) => {
      const normalizedKey = category.key.toLowerCase().replace(/[-\s]/g, "_");
      const normalizedLabel = category.label.toLowerCase().replace(/[-\s]/g, "_");
      const rank = storefrontCategoryOrder.findIndex((value) => value === normalizedKey || value === normalizedLabel);
      return rank === -1 ? storefrontCategoryOrder.length : rank;
    };

    return Array.from(
        storefrontItems.reduce((categoryMap, item) => {
          if (!categoryMap.has(item.category)) {
            categoryMap.set(item.category, { key: item.category, label: item.category_label });
          }
          return categoryMap;
        }, new Map<string, { key: string; label: string }>())
      )
      .map(([, category]) => category)
      .sort((left, right) => getCategoryRank(left) - getCategoryRank(right));
  }, [storefrontItems]);

  useEffect(() => {
    if (availableCategories.length === 0) return;
    if (!availableCategories.some((category) => category.key === active)) {
      setActive(availableCategories[0]!.key);
    }
  }, [active, availableCategories]);

  const safeCartItems = hydrated ? cartItems : [];
  const safeCount = hydrated ? count() : 0;
  const cartTotal = hydrated ? total() : 0;

  const filtered = useMemo(() => storefrontItems.filter((item) => item.category === active), [active, storefrontItems]);

  function flashAutoAdd(id: number) {
    if (autoAddTimer.current) clearTimeout(autoAddTimer.current);
    setAutoAddedId(id);
    autoAddTimer.current = setTimeout(() => setAutoAddedId(null), 700);
  }

  function toggleAddon(menuItemId: number, addon: MenuItem) {
    if (!addon.is_available) return;

    const cartItem = safeCartItems.find((i) => i.menu_item_id === menuItemId);

    if (cartItem) {
      const enabled = !(cartItem.accompaniments ?? []).some((a) => a.menu_item_id === addon.id);
      setGroupAddOn(
        menuItemId,
        { menu_item_id: addon.id, name: addon.name, price: addon.price, image_url: addon.image_url },
        enabled
      );
      return;
    }

    // Parent not in cart — auto-add it with this addon attached.
    // addItem() is idempotent: if a concurrent click already added it before this
    // render cycle sees the update, the second call just increments qty.
    const parentItem = items.find((i) => i.id === menuItemId);
    if (!parentItem?.is_available) return;

    addItem(
      { menu_item_id: parentItem.id, name: parentItem.name, price: parentItem.price, image_url: parentItem.image_url },
      [{ menu_item_id: addon.id, name: addon.name, price: addon.price, image_url: addon.image_url }]
    );
    flashAutoAdd(parentItem.id);
  }

  function addMenuItem(item: MenuItem) {
    if (!item.is_available || !isPubliclyAvailableOnServiceDate(item.name, getUgandaServiceDate())) return;

    addItem({ menu_item_id: item.id, name: item.name, price: item.price, image_url: item.image_url });
  }

  return (
    <section id="menu-section" className="mx-auto w-full max-w-7xl min-w-0 px-4 pb-24 pt-5 md:px-8 md:pt-6 lg:pb-10">
      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          <div className="mb-3 flex w-full max-w-full gap-2 overflow-x-auto pb-1">
            {availableCategories.map((cat) => {
              const activeCls =
                active === cat.key
                  ? "bg-ember text-white border-ember"
                  : "bg-[#efe6d8] text-[#2c231d] border-[#dcc8b1]";
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
              const isWeekendOnlyUnavailable =
                isWeekendSpecialMenuItem(item.name) && !isFridayThroughSundayServiceDate(getUgandaServiceDate());
              const isUnavailable = isOutOfStock || isWeekendOnlyUnavailable;
              const isCountryPlatter = item.category === "country_platter";
              const cartItem = safeCartItems.find((cartLine) => cartLine.menu_item_id === item.id);
              const selectedAddonIds = (cartItem?.accompaniments ?? []).map((a) => a.menu_item_id);
              const pendingSubtotal =
                item.price + (cartItem?.accompaniments ?? []).reduce((sum, a) => sum + a.price, 0);
              const stockMessage = isWeekendOnlyUnavailable
                ? "Available on weekends"
                : isOutOfStock
                ? "Out of stock"
                : item.available_quantity <= STOREFRONT_LOW_STOCK_COUNT_THRESHOLD
                  ? `Only ${item.available_quantity} left`
                  : null;

              return (
                <article
                  key={item.id}
                  className="overflow-hidden rounded-xl border border-[#d8c1a7] bg-[#fffaf2] shadow-[0_8px_20px_rgba(64,45,30,0.1)]"
                >
                  <div className="relative h-40 w-full bg-[#ede1d0]">
                    {item.image_url ? (
                      <Image
                        src={item.image_url}
                        alt={item.name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 1024px) 50vw, 33vw"
                      />
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
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-extrabold text-[#1f1a17]">{item.name}</h3>
                      {item.portion_label ? (
                        <span className="inline-flex items-center rounded-full border border-[#dbc6ab] bg-[#f5eadb] px-2.5 py-1 text-[11px] font-bold text-[#5d4634] shadow-[0_1px_2px_rgba(75,53,35,0.08)]">
                          {item.portion_label.replace(/G$/, "g")}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-2 h-px w-full bg-[#eadbc9]" />
                    <p className="mt-2 min-h-10 text-sm font-medium text-[#4f4138]">
                      {item.description ?? "House-smoked and finished fresh to order."}
                    </p>
                    {isCountryPlatter ? (
                      <>
                        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-[#dbc6ab] bg-[#f5eadb] px-2.5 py-1 text-[11px] font-bold text-[#5d4634] shadow-[0_1px_2px_rgba(75,53,35,0.08)]">
                          <span aria-hidden="true">👥</span>
                          Feeds up to 4 people
                        </p>

                        <section className="mt-4 border-t border-[#e4d0b9] pt-4" aria-labelledby={`country-platter-contents-${item.id}`}>
                          <h4
                            id={`country-platter-contents-${item.id}`}
                            className="text-xs font-black uppercase tracking-[0.16em] text-[#6a4d38]"
                          >
                            What&apos;s Included
                          </h4>

                          <div className="mt-3 space-y-4">
                            <div>
                              <h5 className="text-[11px] font-extrabold uppercase tracking-wide text-[#80624a]">Smoked Meats</h5>
                              <dl className="mt-2 space-y-1.5 text-xs font-medium text-[#4f4138]">
                                {[
                                  ["Beef ribs", "400g"],
                                  ["Beef chunks", "300g"],
                                  ["Beef oxtail", "300g"],
                                  ["Goat ribs", "350g"],
                                  ["Goat chops", "300g"],
                                  ["Smoked chicken", "Half bird"]
                                ].map(([name, amount]) => (
                                  <div key={name} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4">
                                    <dt>{name}</dt>
                                    <dd className="font-bold tabular-nums text-[#6a4d38]">{amount}</dd>
                                  </div>
                                ))}
                              </dl>
                            </div>

                            <div>
                              <h5 className="text-[11px] font-extrabold uppercase tracking-wide text-[#80624a]">Sides</h5>
                              <dl className="mt-2 space-y-1.5 text-xs font-medium text-[#4f4138]">
                                {["Gonja", "Fries", "Fresh salad"].map((name) => (
                                  <div key={name}>
                                    <dt>{name}</dt>
                                  </div>
                                ))}
                              </dl>
                            </div>

                            <div>
                              <h5 className="text-[11px] font-extrabold uppercase tracking-wide text-[#80624a]">Extras</h5>
                              <dl className="mt-2 space-y-1.5 text-xs font-medium text-[#4f4138]">
                                <div>
                                  <dt>Signature sauces</dt>
                                </div>
                                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4">
                                  <dt>One 2-litre soda</dt>
                                </div>
                              </dl>
                            </div>
                          </div>
                        </section>
                      </>
                    ) : null}

                    {stockMessage && !isCountryPlatter ? (
                      <p
                        className={`mt-2 text-xs font-bold uppercase tracking-wide ${isOutOfStock ? "text-[#8d3d2f]" : "text-[#9a5a1d]"}`}
                      >
                        {stockMessage}
                      </p>
                    ) : null}

                    {!isCountryPlatter && item.category !== "sides" && accompanimentList.length > 0 ? (
                      <div className="mt-3 border-t border-[#e4d0b9] pt-3">
                        <p className="text-xs font-black uppercase tracking-wide text-[#6a4d38]">
                          Add Accompaniments
                        </p>
                        <p className="mt-1 text-[10px] font-medium text-[#8a6d58]">
                          Selecting an accompaniment automatically adds this item to your order.
                        </p>
                        <div className="mt-2 space-y-2">
                          {accompanimentList.map((accompaniment) => {
                            const checked = selectedAddonIds.includes(accompaniment.id);
                            const isUnavailable = !accompaniment.is_available;
                            const addonStatus = checked
                              ? "Selected"
                              : isUnavailable
                                ? "Sold out"
                                : `+ ${formatCurrency(accompaniment.price)}`;

                            return (
                              <label
                                key={accompaniment.id}
                                className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm font-bold ${
                                  isUnavailable
                                    ? "border-[#e5d8c8] bg-[#f1e7db] text-[#9b8674]"
                                    : "border-[#dcc8b1] bg-[#fff7ec] text-[#2c231d]"
                                }`}
                              >
                                <span className="flex min-w-0 items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    disabled={isUnavailable}
                                    onChange={() => toggleAddon(item.id, accompaniment)}
                                    className="h-4 w-4 accent-[#a23b22]"
                                  />
                                  <span className="truncate">{accompaniment.name}</span>
                                </span>
                                <span className="shrink-0 text-xs">{addonStatus}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}

                    {!isCountryPlatter && drinkItems.length > 0 ? (
                      <div className="mt-3 border-t border-[#e4d0b9] pt-3">
                        <p className="text-xs font-black uppercase tracking-wide text-[#6a4d38]">Add drinks</p>
                        <div className="mt-2 space-y-2">
                          {drinkItems.map((addon) => {
                            const checked = selectedAddonIds.includes(addon.id);
                            const isUnavailable = !addon.is_available;
                            const addonStatus = checked
                              ? "Selected"
                              : addon.is_available
                                ? `+ ${formatCurrency(addon.price)}`
                                : "Sold out";

                            return (
                              <label
                                key={addon.id}
                                className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm font-bold ${
                                  !isUnavailable || checked
                                    ? "border-[#dcc8b1] bg-[#fff7ec] text-[#2c231d]"
                                    : "border-[#e5d8c8] bg-[#f1e7db] text-[#9b8674]"
                                }`}
                              >
                                <span className="flex min-w-0 items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    disabled={isUnavailable}
                                    onChange={() => toggleAddon(item.id, addon)}
                                    className="h-4 w-4 accent-[#a23b22]"
                                  />
                                  <span className="truncate">{addon.name}</span>
                                </span>
                                <span className="shrink-0 text-xs">{addonStatus}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex items-center justify-between border-t border-[#dfcbb5] bg-[#f4e9d9] px-3 py-2">
                    <div>
                      <span className="text-base font-black text-[#2b211b]">{formatCurrency(pendingSubtotal)}</span>
                      {pendingSubtotal !== item.price ? (
                        <p className="text-[10px] font-bold uppercase tracking-wide text-[#6a5647]">Card subtotal</p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      disabled={isUnavailable}
                      onClick={() => addMenuItem(item)}
                      className={`rounded-md px-4 py-2 text-xs font-extrabold uppercase tracking-wide ${
                        isUnavailable
                          ? "cursor-not-allowed bg-[#d2bdaa] text-[#fff7ec] opacity-80"
                          : "btn-primary"
                      }`}
                    >
                      {isWeekendOnlyUnavailable ? "Available on weekends" : isOutOfStock ? "Sold Out" : "Add"}
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
              <select
                value={pickupTime}
                onChange={(e) => setPickupTime(e.target.value)}
                className="mt-1 w-full rounded-md px-3 py-2 text-sm font-semibold"
              >
                <option value="15">15 min</option>
                <option value="30">30 min</option>
                <option value="45">45 min</option>
                <option value="60">60 min</option>
              </select>
            </label>
          </div>

          <div className="mt-4 flex-1 overflow-y-auto pr-1">
            {safeCartItems.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#d4c1aa] bg-[#f6ecdf] p-4 text-sm font-semibold leading-6 text-[#6a5647]">
                Your order is empty. Add smoked favorites from the menu.
              </div>
            ) : (
              <div className="space-y-3">
                {safeCartItems.map((item) => {
                  const isHighlighted = autoAddedId === item.menu_item_id;
                  return (
                    <div
                      key={item.menu_item_id}
                      className={`rounded-xl border bg-white p-3 transition-all duration-300 ${
                        isHighlighted ? "border-[#a23b22] ring-1 ring-[#a23b22]/30" : "border-[#deccb7]"
                      }`}
                    >
                      <div className="flex gap-3">
                        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-[#ede1d0]">
                          {item.image_url ? (
                            <Image
                              src={item.image_url}
                              alt={item.name}
                              fill
                              className="object-cover"
                              sizes="64px"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-[10px] font-bold uppercase tracking-wide text-[#7a5c44]">
                              Fresh
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-extrabold text-[#2b211b]">{item.name}</p>
                              <p className="mt-0.5 text-xs font-semibold text-[#6a5647]">
                                {formatCurrency(item.price)} each
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeItem(item.menu_item_id)}
                              className="rounded-md px-2 py-1 text-xs font-extrabold uppercase tracking-wide text-[#a23b22] transition hover:bg-[#f4e2d5]"
                            >
                              Remove
                            </button>
                          </div>
                          <div className="mt-3 flex items-center justify-between gap-3">
                            <div className="flex items-center overflow-hidden rounded-md border border-[#d6bea4] bg-[#fff7ec]">
                              <button
                                type="button"
                                onClick={() => updateQty(item.menu_item_id, item.qty - 1)}
                                className="h-8 w-8 text-lg font-black text-[#5b3826] transition hover:bg-[#f4e9d9]"
                                aria-label={`Decrease ${item.name}`}
                              >
                                -
                              </button>
                              <span className="w-8 text-center text-sm font-extrabold text-[#2b211b]">
                                {item.qty}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateQty(item.menu_item_id, item.qty + 1)}
                                className="h-8 w-8 text-lg font-black text-[#5b3826] transition hover:bg-[#f4e9d9]"
                                aria-label={`Increase ${item.name}`}
                              >
                                +
                              </button>
                            </div>
                            <p className="shrink-0 text-sm font-black text-[#2b211b]">
                              {formatCurrency(item.qty * item.price)}
                            </p>
                          </div>
                          {item.accompaniments?.length ? (
                            <div className="mt-3 space-y-2 border-l-2 border-[#e4d0b9] pl-3">
                              {item.accompaniments.map((accompaniment) => (
                                <div key={accompaniment.menu_item_id} className="rounded-lg bg-[#fff7ec] px-2 py-2">
                                  <div className="flex min-w-0 gap-2">
                                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-[#2b211b]">
                                      {accompaniment.image_url ? (
                                        <Image
                                          src={accompaniment.image_url}
                                          alt={accompaniment.name}
                                          fill
                                          className="object-cover"
                                          sizes="48px"
                                        />
                                      ) : (
                                        <div className="flex h-full items-center justify-center text-[9px] font-bold uppercase tracking-wide text-[#d2a178]">
                                          Add-on
                                        </div>
                                      )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                          <p className="truncate text-xs font-extrabold text-[#3d2f25]">
                                            {accompaniment.name}
                                          </p>
                                          <p className="mt-0.5 text-[11px] font-semibold text-[#7a5c44]">
                                            {formatCurrency(accompaniment.price)} each
                                          </p>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            removeAccompaniment(item.menu_item_id, accompaniment.menu_item_id)
                                          }
                                          className="rounded px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide text-[#a23b22] transition hover:bg-[#f4e2d5]"
                                        >
                                          Remove
                                        </button>
                                      </div>
                                      <div className="mt-2 flex items-center justify-between gap-2">
                                        <div className="flex items-center overflow-hidden rounded-md border border-[#d6bea4] bg-white">
                                          <button
                                            type="button"
                                            onClick={() =>
                                              updateAccompanimentQty(
                                                item.menu_item_id,
                                                accompaniment.menu_item_id,
                                                accompaniment.qty - 1
                                              )
                                            }
                                            className="h-7 w-7 text-base font-black text-[#5b3826] transition hover:bg-[#f4e9d9]"
                                            aria-label={`Decrease ${accompaniment.name}`}
                                          >
                                            -
                                          </button>
                                          <span className="w-7 text-center text-xs font-extrabold text-[#2b211b]">
                                            {accompaniment.qty}
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              updateAccompanimentQty(
                                                item.menu_item_id,
                                                accompaniment.menu_item_id,
                                                accompaniment.qty + 1
                                              )
                                            }
                                            disabled={accompaniment.qty >= item.qty}
                                            className="h-7 w-7 text-base font-black text-[#5b3826] transition hover:bg-[#f4e9d9] disabled:cursor-not-allowed disabled:opacity-40"
                                            aria-label={`Increase ${accompaniment.name}`}
                                          >
                                            +
                                          </button>
                                        </div>
                                        <p className="shrink-0 text-xs font-black text-[#2b211b]">
                                          {formatCurrency(accompaniment.qty * accompaniment.price)}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-4 border-t border-[#dbc5ad] pt-3">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-bold uppercase tracking-wide text-[#5b4a3f]">Total</p>
              <p className="text-2xl font-black text-[#241b15]">{formatCurrency(cartTotal)}</p>
            </div>
            {safeCartItems.length === 0 ? (
              <button
                type="button"
                disabled
                className="w-full rounded-md bg-[#c9b39a] px-4 py-3 text-sm font-extrabold uppercase tracking-wide text-[#fff7ec] opacity-80"
              >
                Place Order
              </button>
            ) : (
              <Link
                href="/checkout"
                className="btn-primary block w-full rounded-md px-4 py-3 text-center text-sm font-extrabold uppercase tracking-wide"
              >
                Place Order
              </Link>
            )}
          </div>
        </aside>
      </div>

      {safeCount > 0 ? (
        <Link
          href="/cart"
          className="fixed bottom-4 left-4 right-4 z-40 flex items-center justify-between rounded-xl bg-walnut px-4 py-3 text-cream shadow-xl lg:hidden"
        >
          <span className="text-sm font-bold uppercase tracking-wide">{safeCount} Items</span>
          <span className="text-base font-black">{formatCurrency(cartTotal)}</span>
          <span className="rounded-md bg-ember px-3 py-1 text-sm font-bold uppercase tracking-wide text-white">
            View Cart
          </span>
        </Link>
      ) : null}
    </section>
  );
}
