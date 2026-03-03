import { randomUUID } from "crypto";
import { generatePickupCode, generatePublicToken } from "@/lib/order-utils";
import { MenuItem, Order, OrderItem, OrderStatus } from "@/lib/types";

const mockMenuItems: MenuItem[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Texas Brisket Plate",
    description: "12-hour smoked brisket with house pickles",
    category: "roasted_meat",
    price: 48000,
    image_url: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1200&q=80",
    is_available: true
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Smoked Chicken Quarter",
    description: "Juicy smoked chicken, lightly glazed",
    category: "roasted_meat",
    price: 36000,
    image_url: "https://images.unsplash.com/photo-1527477396000-e27163b481c2?auto=format&fit=crop&w=1200&q=80",
    is_available: true
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    name: "Maple Pork Ribs",
    description: "Sticky maple glaze, fall-off-the-bone",
    category: "roasted_meat",
    price: 45000,
    image_url: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1400&q=80",
    is_available: true
  },
  {
    id: "99999999-9999-4999-8999-999999999999",
    name: "Smoked Goat Chops",
    description: "Char-finished goat chops with spice rub",
    category: "roasted_meat",
    price: 42000,
    image_url: "https://images.unsplash.com/photo-1558030006-450675393462?auto=format&fit=crop&w=1200&q=80",
    is_available: true
  },
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    name: "BBQ Beef Short Ribs",
    description: "Slow-smoked short ribs glazed in house BBQ",
    category: "roasted_meat",
    price: 52000,
    image_url: "https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=1200&q=80",
    is_available: true
  },
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    name: "Whole Smoked Tilapia",
    description: "Lake-style smoked tilapia with lemon pepper",
    category: "roasted_meat",
    price: 34000,
    image_url: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=1200&q=80",
    is_available: true
  },
  {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    name: "Pepper Crust Pork Belly",
    description: "Crisp-edged pork belly with black pepper crust",
    category: "roasted_meat",
    price: 39000,
    image_url: "https://images.unsplash.com/photo-1527477396000-e27163b481c2?auto=format&fit=crop&w=1400&q=80",
    is_available: true
  },
  {
    id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    name: "Honey Smoked Turkey",
    description: "Tender turkey slices with mild honey glaze",
    category: "roasted_meat",
    price: 37000,
    image_url: "https://images.unsplash.com/photo-1606728035253-49e8a23146de?auto=format&fit=crop&w=1200&q=80",
    is_available: true
  },
  {
    id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    name: "Smoked Lamb Shoulder",
    description: "Slow-roasted lamb shoulder with garlic herb rub",
    category: "roasted_meat",
    price: 47000,
    image_url: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1200&q=80",
    is_available: true
  },
  {
    id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    name: "Charred Pork Spare Ribs",
    description: "Wood-smoked pork ribs finished over open flame",
    category: "roasted_meat",
    price: 44000,
    image_url: "https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=1200&q=80",
    is_available: true
  },
  {
    id: "12121212-1212-4121-8121-121212121212",
    name: "Smoked Beef Sausage Platter",
    description: "House beef sausages with mustard and pickled onions",
    category: "roasted_meat",
    price: 33000,
    image_url: "https://images.unsplash.com/photo-1527477396000-e27163b481c2?auto=format&fit=crop&w=1200&q=80",
    is_available: true
  },
  {
    id: "13131313-1313-4131-8131-131313131313",
    name: "Fire-Grilled Turkey Wings",
    description: "Smoked turkey wings glazed with pepper butter",
    category: "roasted_meat",
    price: 35000,
    image_url: "https://images.unsplash.com/photo-1606728035253-49e8a23146de?auto=format&fit=crop&w=1200&q=80",
    is_available: true
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    name: "Buttermilk Slaw",
    description: "Fresh crunchy slaw",
    category: "sides",
    price: 9000,
    image_url: null,
    is_available: true
  },
  {
    id: "55555555-5555-4555-8555-555555555555",
    name: "Smokehouse Beans",
    description: "Slow-cooked beans with smoky depth",
    category: "sides",
    price: 10000,
    image_url: null,
    is_available: true
  },
  {
    id: "66666666-6666-4666-8666-666666666666",
    name: "Cornbread",
    description: "Warm honey-butter cornbread",
    category: "sides",
    price: 7000,
    image_url: null,
    is_available: true
  },
  {
    id: "77777777-7777-4777-8777-777777777777",
    name: "Sweet Tea",
    description: "Southern sweet tea",
    category: "drinks",
    price: 5000,
    image_url: null,
    is_available: true
  },
  {
    id: "88888888-8888-4888-8888-888888888888",
    name: "House Lemonade",
    description: "Fresh lemon and mint",
    category: "drinks",
    price: 6000,
    image_url: null,
    is_available: true
  }
];

const mockOrders: Order[] = [];
const mockOrderItems = new Map<string, OrderItem[]>();
let orderCounter = 1000;

export function getMockMenuItems(): MenuItem[] {
  return [...mockMenuItems]
    .filter((item) => item.is_available)
    .sort((a, b) => `${a.category}-${a.name}`.localeCompare(`${b.category}-${b.name}`));
}

export function createMockOrder(input: {
  items: { menu_item_id: string; qty: number }[];
  pickup_time: string;
  name: string;
  phone: string;
  notes?: string;
}): { public_token: string; order_number: number; pickup_code: string } {
  const menuMap = new Map(getMockMenuItems().map((item) => [item.id, item]));

  let total = 0;
  const items: OrderItem[] = [];

  for (const row of input.items) {
    const menuItem = menuMap.get(row.menu_item_id);
    if (!menuItem || !menuItem.is_available) {
      throw new Error("One or more menu items are unavailable");
    }

    total += menuItem.price * row.qty;

    items.push({
      id: randomUUID(),
      menu_item_id: row.menu_item_id,
      quantity: row.qty,
      price_at_time: menuItem.price,
      menu_items: {
        name: menuItem.name,
        image_url: menuItem.image_url
      }
    });
  }

  orderCounter += 1;

  const order: Order = {
    id: randomUUID(),
    order_number: orderCounter,
    public_token: generatePublicToken(),
    pickup_code: generatePickupCode(),
    name: input.name,
    phone: input.phone,
    notes: input.notes || null,
    status: "received",
    pickup_time: input.pickup_time,
    total_amount: total,
    created_at: new Date().toISOString()
  };

  mockOrders.unshift(order);
  mockOrderItems.set(order.id, items);

  return {
    public_token: order.public_token,
    order_number: order.order_number,
    pickup_code: order.pickup_code
  };
}

export function getMockOrderByPublicToken(publicToken: string): Order | null {
  const order = mockOrders.find((entry) => entry.public_token === publicToken);
  if (!order) return null;

  return {
    ...order,
    items: mockOrderItems.get(order.id) ?? []
  };
}

export function getMockAdminOrders(): Order[] {
  return [...mockOrders].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function updateMockOrderStatus(id: string, status: OrderStatus): Order | null {
  const index = mockOrders.findIndex((order) => order.id === id);
  if (index === -1) return null;

  mockOrders[index] = {
    ...mockOrders[index],
    status
  };

  return mockOrders[index];
}
