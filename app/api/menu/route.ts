import { NextRequest, NextResponse } from "next/server";
import { isLocalhostBypassEnabledForHost } from "@/lib/local-bypass";
import { loadSellableStockMaps } from "@/lib/menu-stock";
import { mapSharedMenuItem, SharedMenuItemRow } from "@/lib/shared-schema";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function buildLocalStockBypassMap(items: SharedMenuItemRow[]) {
  return new Map(
    items
      .map((item) => Number(item.portion_type_id ?? 0))
      .filter((portionTypeId) => Number.isInteger(portionTypeId) && portionTypeId > 0)
      .map((portionTypeId) => [portionTypeId, 99])
  );
}

export async function GET(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("menu_items")
    .select(
      `
      id,
      name,
      description,
      base_price,
      image_url,
      prep_type,
      portion_type_id,
      is_active,
      is_available_today,
      portion_types (
        portion_label,
        stock_source_portion_type_id,
        stock_source_units_per_serving
      ),
      menu_categories (
        code,
        name
      )
    `
    )
    .eq("is_active", true)
    .eq("is_available_today", true)
    .order("sort_order")
    .order("name");

  if (error) {
    return NextResponse.json({ error: "Failed to fetch menu" }, { status: 500 });
  }

  try {
    const rows = (data ?? []) as SharedMenuItemRow[];
    const sourcePortionTypeIds = rows
      .map((item) => {
        const pt = Array.isArray(item.portion_types) ? item.portion_types[0] : item.portion_types;
        return pt?.stock_source_portion_type_id ?? null;
      })
      .filter((id): id is number => typeof id === "number" && id > 0);

    const { dailyStockMap, finishedStockMap } = await loadSellableStockMaps(
      supabase,
      rows.map((item) => Number(item.portion_type_id ?? 0)),
      undefined,
      sourcePortionTypeIds
    );

    return NextResponse.json(
      rows.map((item) =>
        mapSharedMenuItem({
          ...item,
          dailyStockMap,
          finishedStockMap
        })
      )
    );
  } catch (stockError) {
    if (isLocalhostBypassEnabledForHost(request.headers.get("host") ?? request.nextUrl.host)) {
      console.warn("Localhost menu stock bypass active after stock lookup failed.", stockError);
      const rows = (data ?? []) as SharedMenuItemRow[];
      const dailyStockMap = buildLocalStockBypassMap(rows);

      return NextResponse.json(rows.map((item) => mapSharedMenuItem({ ...item, dailyStockMap })));
    }

    console.error("Failed to resolve menu stock.", stockError);
    return NextResponse.json({ error: "Failed to fetch menu" }, { status: 500 });
  }
}
