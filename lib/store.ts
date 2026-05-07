import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { getCartGroupId } from "@/lib/cart";
import { CartAccompaniment, CartItem } from "@/lib/types";

type CartLineInput = Omit<CartItem, "qty" | "group_id" | "accompaniments">;
type CartAccompanimentInput = Omit<CartAccompaniment, "qty">;

interface CartState {
  items: CartItem[];
  hasHydrated: boolean;
  setHasHydrated: (value: boolean) => void;
  addItem: (item: CartLineInput, accompaniments?: CartAccompanimentInput[]) => void;
  updateQty: (menu_item_id: number, qty: number) => void;
  setGroupAddOn: (parent_menu_item_id: number, accompaniment: CartAccompanimentInput, enabled: boolean) => void;
  updateAccompanimentQty: (parent_menu_item_id: number, menu_item_id: number, qty: number) => void;
  removeItem: (menu_item_id: number) => void;
  removeAccompaniment: (parent_menu_item_id: number, menu_item_id: number) => void;
  clear: () => void;
  total: () => number;
  count: () => number;
}

function sanitizeQuantity(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(Math.max(Math.trunc(parsed), 1), 20) : 1;
}

function sanitizeAccompaniments(parentMenuItemId: number, items: CartAccompaniment[] | undefined): CartAccompaniment[] {
  const seen = new Set<number>();

  return (items ?? [])
    .map((item) => ({
      ...item,
      menu_item_id: Number(item.menu_item_id),
      price: Number(item.price),
      qty: sanitizeQuantity(item.qty)
    }))
    .filter((item) => {
      if (
        !Number.isInteger(item.menu_item_id) ||
        item.menu_item_id <= 0 ||
        item.menu_item_id === parentMenuItemId ||
        !Number.isFinite(item.price) ||
        item.qty <= 0 ||
        seen.has(item.menu_item_id)
      ) {
        return false;
      }

      seen.add(item.menu_item_id);
      return true;
    });
}

function sanitizeCartItems(items: CartItem[]): CartItem[] {
  return items
    .map((item) => ({
      ...item,
      menu_item_id: Number(item.menu_item_id),
      price: Number(item.price),
      qty: sanitizeQuantity(item.qty),
      group_id: typeof item.group_id === "string" && item.group_id.length > 0 ? item.group_id : getCartGroupId(Number(item.menu_item_id)),
      accompaniments: sanitizeAccompaniments(Number(item.menu_item_id), item.accompaniments)
    }))
    .filter(
      (item) =>
        Number.isInteger(item.menu_item_id) &&
        item.menu_item_id > 0 &&
        Number.isFinite(item.price) &&
        item.qty > 0
    );
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      hasHydrated: false,
      setHasHydrated: (value) => set({ hasHydrated: value }),
      addItem: (item, accompaniments = []) => {
        const existing = get().items.find((i) => i.menu_item_id === item.menu_item_id);
        const selectedAccompaniments = sanitizeAccompaniments(
          item.menu_item_id,
          accompaniments.map((accompaniment) => ({ ...accompaniment, qty: 1 }))
        );

        if (existing) {
          set({
            items: get().items.map((i) =>
              i.menu_item_id === item.menu_item_id
                ? {
                    ...i,
                    qty: Math.min(i.qty + 1, 20),
                    group_id: i.group_id ?? getCartGroupId(i.menu_item_id)
                  }
                : i
            )
          });
          return;
        }
        set({
          items: [
            ...get().items,
            {
              ...item,
              qty: 1,
              group_id: getCartGroupId(item.menu_item_id),
              accompaniments: selectedAccompaniments
            }
          ]
        });
      },
      updateQty: (menu_item_id, qty) => {
        if (qty <= 0) {
          set({ items: get().items.filter((i) => i.menu_item_id !== menu_item_id) });
          return;
        }
        set({
          items: get().items.map((i) => (i.menu_item_id === menu_item_id ? { ...i, qty: Math.min(qty, 20) } : i))
        });
      },
      setGroupAddOn: (parent_menu_item_id, accompaniment, enabled) => {
        set({
          items: get().items.map((item) => {
            if (item.menu_item_id !== parent_menu_item_id) {
              return item;
            }

            if (!enabled) {
              return {
                ...item,
                accompaniments: (item.accompaniments ?? []).filter((current) => current.menu_item_id !== accompaniment.menu_item_id)
              };
            }

            const [nextAccompaniment] = sanitizeAccompaniments(parent_menu_item_id, [{ ...accompaniment, qty: 1 }]);
            if (!nextAccompaniment) {
              return item;
            }

            if ((item.accompaniments ?? []).some((current) => current.menu_item_id === nextAccompaniment.menu_item_id)) {
              return item;
            }

            return {
              ...item,
              group_id: item.group_id ?? getCartGroupId(item.menu_item_id),
              accompaniments: [...(item.accompaniments ?? []), nextAccompaniment]
            };
          })
        });
      },
      updateAccompanimentQty: (parent_menu_item_id, menu_item_id, qty) => {
        set({
          items: get().items.map((item) => {
            if (item.menu_item_id !== parent_menu_item_id) {
              return item;
            }

            if (qty <= 0) {
              return {
                ...item,
                accompaniments: (item.accompaniments ?? []).filter((accompaniment) => accompaniment.menu_item_id !== menu_item_id)
              };
            }

            return {
              ...item,
              accompaniments: (item.accompaniments ?? []).map((accompaniment) =>
                accompaniment.menu_item_id === menu_item_id ? { ...accompaniment, qty: Math.min(qty, 20) } : accompaniment
              )
            };
          })
        });
      },
      removeItem: (menu_item_id) => set({ items: get().items.filter((i) => i.menu_item_id !== menu_item_id) }),
      removeAccompaniment: (parent_menu_item_id, menu_item_id) => {
        set({
          items: get().items.map((item) =>
            item.menu_item_id === parent_menu_item_id
              ? {
                  ...item,
                  accompaniments: (item.accompaniments ?? []).filter((accompaniment) => accompaniment.menu_item_id !== menu_item_id)
                }
              : item
          )
        });
      },
      clear: () => set({ items: [] }),
      total: () =>
        get().items.reduce(
          (acc, item) =>
            acc +
            item.price * item.qty +
            (item.accompaniments ?? []).reduce((addonTotal, accompaniment) => addonTotal + accompaniment.price * accompaniment.qty, 0),
          0
        ),
      count: () =>
        get().items.reduce(
          (acc, item) => acc + item.qty + (item.accompaniments ?? []).reduce((addonCount, accompaniment) => addonCount + accompaniment.qty, 0),
          0
        )
    }),
    {
      name: "smokehouse-cart",
      storage: createJSONStorage(() => localStorage),
      migrate: (persistedState) => {
        const state = persistedState as { items?: CartItem[] } | undefined;

        return {
          ...(persistedState as object),
          items: sanitizeCartItems(state?.items ?? [])
        };
      },
      skipHydration: true,
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.items = sanitizeCartItems(state.items);
        }
        state?.setHasHydrated(true);
      }
    }
  )
);
