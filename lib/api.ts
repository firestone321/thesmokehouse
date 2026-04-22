import { MenuItem, Order } from "@/lib/types";

export interface CreateOrderPayload {
  items: { menu_item_id: number; qty: number }[];
  pickup_time: string;
  name: string;
  phone: string;
  notes?: string;
}

export async function getMenu(): Promise<MenuItem[]> {
  const res = await fetch("/api/menu", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch menu");
  return res.json();
}

export async function createOrder(payload: CreateOrderPayload): Promise<{
  public_token: string;
  order_number: string;
  pickup_code: string | null;
  payment_status: string;
  redirect_url: string | null;
}> {
  const res = await fetch("/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to place order" }));
    throw new Error(err.error ?? "Failed to place order");
  }

  return res.json();
}

export async function getOrderByPublicToken(publicToken: string): Promise<Order> {
  const res = await fetch(`/api/orders/${publicToken}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Order not found");
  return res.json();
}
