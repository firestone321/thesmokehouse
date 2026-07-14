import Image from "next/image";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { MenuClient } from "@/components/menu-client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { isLocalhostBypassEnabledForHost } from "@/lib/local-bypass";
import { getUgandaServiceDate, getUgandaStoreStatus } from "@/lib/menu-stock";
import { mapStorefrontMenuRpcRow, StorefrontMenuRpcRow } from "@/lib/shared-schema";
import { getSupabaseAdmin } from "@/lib/supabase";
import { MenuItem } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Order Smoky BBQ and Takeaway Online",
  description: "Browse the Firestone Country Smokehouse menu, build a pickup order, and track it on your device.",
  alternates: {
    canonical: "/"
  },
  openGraph: {
    title: "Order Smoky BBQ and Takeaway Online",
    description: "Browse the Firestone Country Smokehouse menu, build a pickup order, and track it on your device.",
    url: "/"
  },
  twitter: {
    card: "summary",
    title: "Order Smoky BBQ and Takeaway Online",
    description: "Browse the Firestone Country Smokehouse menu, build a pickup order, and track it on your device."
  }
};

export default async function HomePage() {
  let menuItems: MenuItem[] = [];
  const { isOpen } = getUgandaStoreStatus();
  const supabase = getSupabaseAdmin();
  const headerStore = await headers();
  const localBypassEnabled = isLocalhostBypassEnabledForHost(headerStore.get("host"));

  try {
    const { data, error } = await supabase.rpc("get_storefront_menu", {
      p_service_date: getUgandaServiceDate()
    });

    if (error) {
      // On localhost, log and continue — MenuClient will re-fetch /api/menu on mount.
      if (localBypassEnabled) {
        console.warn("Localhost: get_storefront_menu RPC failed, SSR menu empty.", error.message);
      } else {
        console.error("Failed to load storefront menu.", error.message);
      }
    } else {
      menuItems = (data as StorefrontMenuRpcRow[] ?? []).map(mapStorefrontMenuRpcRow);
    }
  } catch (error) {
    console.error("Unexpected menu load error.", error);
  }

  return (
    <div className="min-h-screen bg-cream">
      <SiteHeader />
      <main>
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
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-amber-200">Countryside Hospitality Wood-Fired Flavour</p>
              <h1 className="font-heading text-5xl leading-[0.9] text-cream md:text-7xl">FIRESTONE COUNTRY SMOKEHOUSE</h1>
              <p className="mt-3 text-lg font-semibold text-amber-50 md:text-xl">Genuine Countryside Hospitality.</p>

              <div className="mt-5 flex flex-wrap gap-3">
                <a href="#menu-section" className="btn-primary rounded-md px-6 py-3 text-sm font-extrabold uppercase tracking-wide">
                  Start Order
                </a>
                <a
                  href="#menu-section"
                  className="rounded-md border border-amber-50/50 bg-black/20 px-6 py-3 text-sm font-bold uppercase tracking-wide text-amber-50 backdrop-blur-sm"
                >
                  View Menu
                </a>
              </div>

              {isOpen ? (
                <div className="mt-4 inline-flex items-center gap-2 rounded-md border border-emerald-300/25 bg-emerald-950/30 px-3 py-2 text-sm font-semibold text-emerald-100">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  <span>Open · Ready in 15 to 60 mins</span>
                </div>
              ) : (
                <div className="mt-4 inline-flex items-center gap-2 rounded-md border border-stone-400/20 bg-stone-900/30 px-3 py-2 text-sm font-semibold text-stone-300">
                  <span className="h-2.5 w-2.5 rounded-full bg-stone-500" />
                  <span>Closed · Opens at 9 AM</span>
                </div>
              )}
            </div>
          </div>
        </section>

        <MenuClient items={menuItems} />
        <SiteFooter />
      </main>
    </div>
  );
}
