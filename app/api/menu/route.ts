import { NextResponse } from "next/server";
import { loadSellableStockMaps } from "@/lib/menu-stock";
import { mapSharedMenuItem, SharedMenuItemRow } from "@/lib/shared-schema";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
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
    const { dailyStockMap, finishedStockMap } = await loadSellableStockMaps(
      supabase,
      (data ?? []).map((item) => Number((item as SharedMenuItemRow).portion_type_id ?? 0))
    );

    return NextResponse.json(
      (data ?? []).map((item) =>
        mapSharedMenuItem({
          ...(item as SharedMenuItemRow),
          dailyStockMap,
          finishedStockMap
        })
      )
    );
  } catch (stockError) {
    console.error("Failed to resolve menu stock.", stockError);
    return NextResponse.json({ error: "Failed to fetch menu" }, { status: 500 });
  }
}
