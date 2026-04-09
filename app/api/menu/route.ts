import { NextResponse } from "next/server";
import { mapSharedMenuItem } from "@/lib/shared-schema";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const { data, error } = await getSupabaseAdmin()
    .from("menu_items")
    .select(
      `
      id,
      name,
      description,
      base_price,
      image_url,
      prep_type,
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

  return NextResponse.json((data ?? []).map((item) => mapSharedMenuItem(item as never)));
}
