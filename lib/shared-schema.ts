import { MenuCategory, MenuItem, Order, OrderItem, OrderStatus, PaymentStatus } from "@/lib/types";
import { resolveStockForPortion, StockSource } from "@/lib/menu-stock";
import { toKampalaDateTimeString, toKampalaTimeString } from "@/lib/format";

type MenuCategoryRelation =
  | {
      code?: string | null;
      name?: string | null;
    }
  | Array<{
      code?: string | null;
      name?: string | null;
    }>
  | null;

type MenuItemRelation =
  | {
      name?: string | null;
      image_url?: string | null;
    }
  | Array<{
      name?: string | null;
      image_url?: string | null;
    }>
  | null;

type PortionTypeRelation =
  | {
      portion_label?: string | null;
      stock_source_portion_type_id?: number | null;
      stock_source_units_per_serving?: number | null;
    }
  | Array<{
      portion_label?: string | null;
      stock_source_portion_type_id?: number | null;
      stock_source_units_per_serving?: number | null;
    }>
  | null;

function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function unwrapRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function titleCaseFromCode(value: string): string {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function mapPrepTypeToMenuCategory(prepType: string | null | undefined, category: MenuCategoryRelation): {
  code: MenuCategory;
  label: string;
} {
  const normalizedCategory = unwrapRelation(category);
  const categoryCode = normalizedCategory?.code?.trim() ?? "";
  const categoryName = normalizedCategory?.name?.trim() ?? "";

  if (categoryCode.length > 0) {
    return {
      code: categoryCode,
      label: categoryName.length > 0 ? categoryName : titleCaseFromCode(categoryCode)
    };
  }

  if (prepType === "drink") {
    return { code: "drinks", label: "Drinks" };
  }

  if (prepType === "packed") {
    return { code: "kitchen", label: "Kitchen" };
  }

  return { code: "smokehouse", label: "Firestone Country Smokehouse" };
}

export function pickupSelectionToPromisedAt(pickupTime: string, now: Date = new Date()): string | null {
  const minutes = Number(pickupTime);
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return null;
  }

  return new Date(now.getTime() + minutes * 60_000).toISOString();
}

export function promisedAtToPickupLabel(promisedAt: string | null | undefined): string {
  if (!promisedAt) {
    return "15 min";
  }

  const date = new Date(promisedAt);
  if (Number.isNaN(date.getTime())) {
    return "15 min";
  }

  return toKampalaTimeString(date);
}

export interface SharedMenuItemRow {
  id: unknown;
  name: string;
  description: string | null;
  base_price: unknown;
  image_url: string | null;
  prep_type: string | null;
  portion_type_id?: unknown;
  portion_types?: PortionTypeRelation;
  is_active?: boolean | null;
  is_available_today?: boolean | null;
  menu_categories?: MenuCategoryRelation;
  dailyStockMap?: Map<number, number>;
  finishedStockMap?: Map<number, number>;
}

export interface StorefrontMenuRpcRow {
  id: number;
  name: string;
  description: string | null;
  base_price: number;
  image_url: string | null;
  prep_type: string | null;
  portion_label: string | null;
  category_code: string | null;
  category_name: string | null;
  is_active: boolean;
  is_available_today: boolean;
  available_quantity: number;
}

export function mapStorefrontMenuRpcRow(row: StorefrontMenuRpcRow): MenuItem {
  const category = mapPrepTypeToMenuCategory(row.prep_type, {
    code: row.category_code,
    name: row.category_name
  });
  const available_quantity = Math.max(0, toNumber(row.available_quantity));
  return {
    id: toNumber(row.id),
    name: row.name,
    description: row.description,
    category: category.code,
    category_label: category.label,
    price: toNumber(row.base_price),
    image_url: row.image_url,
    portion_label: row.portion_label ?? null,
    available_quantity,
    is_available: Boolean(row.is_active) && Boolean(row.is_available_today) && available_quantity > 0
  };
}

export function mapSharedMenuItem(row: SharedMenuItemRow): MenuItem {
  const category = mapPrepTypeToMenuCategory(row.prep_type, row.menu_categories ?? null);
  const portionType = unwrapRelation(row.portion_types ?? null);
  const stockSource: StockSource | undefined =
    portionType?.stock_source_portion_type_id && portionType.stock_source_portion_type_id > 0
      ? {
          sourcePortionTypeId: portionType.stock_source_portion_type_id,
          unitsPerServing: portionType.stock_source_units_per_serving ?? 1
        }
      : undefined;
  const stock = resolveStockForPortion(
    Number(row.portion_type_id ?? 0),
    row.dailyStockMap ?? new Map<number, number>(),
    row.finishedStockMap ?? new Map<number, number>(),
    stockSource
  );

  return {
    id: toNumber(row.id),
    name: row.name,
    description: row.description,
    category: category.code,
    category_label: category.label,
    price: toNumber(row.base_price),
    image_url: row.image_url,
    portion_label: portionType?.portion_label ?? null,
    available_quantity: stock.availableQuantity,
    is_available: Boolean(row.is_active) && Boolean(row.is_available_today) && stock.isInStock
  };
}

export function mapSharedOrder(row: {
  id: unknown;
  order_number: unknown;
  public_token: string | null;
  device_id?: string | null;
  pickup_code: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  status: string;
  payment_status?: string | null;
  promised_at: string | null;
  notes: string | null;
  total_amount: unknown;
  created_at: string;
  completed_at?: string | null;
  cancelled_at?: string | null;
  order_items?: Array<{
    id: unknown;
    menu_item_id: unknown;
    quantity: unknown;
    unit_price?: unknown;
    price_at_time?: unknown;
    menu_item_name?: string | null;
    menu_items?: MenuItemRelation;
  }> | null;
}): Order {
  const items: OrderItem[] = (row.order_items ?? []).map((item) => {
    const menuItem = unwrapRelation(item.menu_items ?? null);

    return {
      id: toNumber(item.id),
      menu_item_id: toNumber(item.menu_item_id),
      quantity: toNumber(item.quantity),
      price_at_time: toNumber(item.unit_price ?? item.price_at_time),
      menu_items: {
        name: menuItem?.name ?? item.menu_item_name ?? "Item",
        image_url: menuItem?.image_url ?? null
      }
    };
  });

  return {
    id: toNumber(row.id),
    order_number: String(row.order_number ?? ""),
    public_token: row.public_token ?? "",
    device_id: row.device_id ?? null,
    pickup_code: row.pickup_code ?? null,
    name: row.customer_name ?? "",
    phone: row.customer_phone ?? "",
    status: row.status as OrderStatus,
    payment_status: (row.payment_status ?? "pending") as PaymentStatus,
    pickup_time: promisedAtToPickupLabel(row.promised_at),
    notes: row.notes,
    total_amount: toNumber(row.total_amount),
    created_at: row.created_at,
    created_at_eat: toKampalaDateTimeString(row.created_at),
    completed_at: row.completed_at ?? null,
    cancelled_at: row.cancelled_at ?? null,
    items
  };
}
