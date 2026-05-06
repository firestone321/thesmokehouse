import { NextRequest, NextResponse } from "next/server";
import { isLocalhostBypassEnabledForHost } from "@/lib/local-bypass";
import { getUgandaServiceDate } from "@/lib/menu-stock";
import { mapStorefrontMenuRpcRow, StorefrontMenuRpcRow } from "@/lib/shared-schema";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { MenuItem } from "@/lib/types";

// No force-dynamic: response is public-only and safe to cache at the edge.
// Cache-Control is set on each response below.

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60"
};

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store"
};

export async function GET(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  const serviceDate = getUgandaServiceDate();

  const { data, error } = await supabase.rpc("get_storefront_menu", {
    p_service_date: serviceDate
  });

  if (!error) {
    return NextResponse.json(
      (data as StorefrontMenuRpcRow[] ?? []).map(mapStorefrontMenuRpcRow),
      { headers: CACHE_HEADERS }
    );
  }

  // Localhost fallback: if the RPC is not yet applied (e.g. Phase 39 pending), return stub stock
  // so local development still works. Never reached in production.
  const host = request.headers.get("host") ?? request.nextUrl.host;
  if (isLocalhostBypassEnabledForHost(host)) {
    console.warn("Localhost: get_storefront_menu RPC failed, using stub stock.", error.message);

    interface FallbackRow {
      id: unknown;
      name: string;
      description: string | null;
      base_price: unknown;
      image_url: string | null;
      prep_type: string | null;
      is_active: boolean;
      is_available_today: boolean;
      portion_types: { portion_label?: string | null } | { portion_label?: string | null }[] | null;
      menu_categories: { code?: string | null; name?: string | null } | { code?: string | null; name?: string | null }[] | null;
    }

    const { data: fallbackRaw } = await supabase
      .from("menu_items")
      .select("id,name,description,base_price,image_url,prep_type,is_active,is_available_today,portion_types(portion_label),menu_categories(code,name)")
      .eq("is_active", true)
      .eq("is_available_today", true)
      .order("sort_order")
      .order("name");

    const fallback = (fallbackRaw as unknown as FallbackRow[] | null) ?? [];

    const items: MenuItem[] = fallback.map((item) => {
      const pt = Array.isArray(item.portion_types) ? item.portion_types[0] : item.portion_types;
      const mc = Array.isArray(item.menu_categories) ? item.menu_categories[0] : item.menu_categories;
      return {
        id: Number(item.id),
        name: item.name,
        description: item.description,
        category: mc?.code ?? "smokehouse",
        category_label: mc?.name ?? "Smokehouse",
        price: Number(item.base_price),
        image_url: item.image_url,
        portion_label: pt?.portion_label ?? null,
        available_quantity: 99,
        is_available: true
      };
    });

    return NextResponse.json(items, { headers: NO_CACHE_HEADERS });
  }

  console.error("get_storefront_menu RPC failed.", error.message);
  return NextResponse.json({ error: "Failed to fetch menu" }, { status: 500, headers: NO_CACHE_HEADERS });
}
