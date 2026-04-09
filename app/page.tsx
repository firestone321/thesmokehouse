import Image from "next/image";
import { MenuClient } from "@/components/menu-client";
import { mapSharedMenuItem } from "@/lib/shared-schema";
import { getSupabaseAdmin } from "@/lib/supabase";
import { MenuItem } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let menuItems: MenuItem[] = [];

  try {
    const { data: items, error } = await getSupabaseAdmin()
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
      console.error("Failed to load menu items from Supabase.", error.message);
    } else {
      menuItems = (items ?? []).map((item) => mapSharedMenuItem(item as never));
    }
  } catch (error) {
    console.error("Unexpected menu load error.", error);
  }

  return (
    <main className="min-h-screen bg-cream">
      <section className="relative min-h-[64vh] overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src="https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?auto=format&fit=crop&w=1400&q=80"
            alt="Smoked brisket platter"
            fill
            className="object-cover"
            priority
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#130f0c]/85 via-[#261a12]/60 to-[#261a12]/35" />
        </div>

        <div className="relative mx-auto flex min-h-[64vh] max-w-7xl items-end px-4 pb-10 pt-14 md:px-8 md:pb-12 md:pt-16">
          <div className="max-w-2xl">
            <div className="relative mb-5 h-24 w-24 overflow-hidden rounded-[28px] border border-amber-100/30 bg-black/15 shadow-[0_20px_44px_rgba(0,0,0,0.22)] backdrop-blur-sm md:h-28 md:w-28">
              <Image src="/icons/logo-bigger.jpg" alt="The Smoke House logo" fill className="object-cover" sizes="112px" priority />
            </div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-amber-200">Slow-Fired Smokehouse</p>
            <h1 className="font-heading text-6xl leading-[0.9] text-cream md:text-8xl">THE SMOKE HOUSE</h1>
            <p className="mt-3 text-lg font-semibold text-amber-50 md:text-xl">Order ahead. Pick up. Leave.</p>

            <div className="mt-5 flex flex-wrap gap-3">
              <a href="/cart" className="btn-primary rounded-md px-6 py-3 text-sm font-extrabold uppercase tracking-wide">
                Start Order
              </a>
              <a
                href="#menu-section"
                className="rounded-md border border-amber-50/50 bg-black/20 px-6 py-3 text-sm font-bold uppercase tracking-wide text-amber-50 backdrop-blur-sm"
              >
                View Menu
              </a>
            </div>

            <div className="mt-4 inline-flex items-center gap-2 rounded-md border border-emerald-300/25 bg-emerald-950/30 px-3 py-2 text-sm font-semibold text-emerald-100">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              <span>Open - Ready in 15-25 mins</span>
            </div>
          </div>
        </div>
      </section>

      <MenuClient items={menuItems} />
    </main>
  );
}
