export type MenuCategory = string;

export type OrderStatus = "new" | "confirmed" | "in_prep" | "on_smoker" | "ready" | "completed" | "cancelled";

export interface MenuItem {
  id: number;
  name: string;
  description: string | null;
  category: MenuCategory;
  category_label: string;
  price: number;
  image_url: string | null;
  available_quantity: number;
  is_available: boolean;
}

export interface CartItem {
  menu_item_id: number;
  name: string;
  price: number;
  qty: number;
  image_url?: string | null;
}

export interface OrderItem {
  id: number;
  menu_item_id: number;
  quantity: number;
  price_at_time: number;
  menu_items?: Pick<MenuItem, "name" | "image_url">;
}

export interface Order {
  id: number;
  order_number: string;
  public_token: string;
  pickup_code: string | null;
  name: string;
  phone: string;
  status: OrderStatus;
  pickup_time: string;
  notes?: string | null;
  total_amount: number;
  created_at: string;
  items?: OrderItem[];
}
