import type { CartItem } from "@/lib/types";

export interface CheckoutCartLine {
  menu_item_id: number;
  qty: number;
  client_group_id?: string;
  client_item_role?: "main" | "addon";
  client_sort_order?: number;
}

export function getCartGroupId(menuItemId: number) {
  return `main-${menuItemId}`;
}

export function flattenCartForCheckout(items: CartItem[]): CheckoutCartLine[] {
  return items.flatMap((item) => {
    const groupId = item.group_id ?? getCartGroupId(item.menu_item_id);
    const lines: CheckoutCartLine[] = [
      {
        menu_item_id: item.menu_item_id,
        qty: item.qty,
        client_group_id: groupId,
        client_item_role: "main",
        client_sort_order: 0
      }
    ];

    for (const [index, accompaniment] of (item.accompaniments ?? []).entries()) {
      lines.push({
        menu_item_id: accompaniment.menu_item_id,
        qty: accompaniment.qty,
        client_group_id: groupId,
        client_item_role: "addon",
        client_sort_order: index + 1
      });
    }

    return lines;
  });
}
