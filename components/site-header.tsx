"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCartStore } from "@/lib/store";
import { useCartHydration } from "@/lib/use-cart-hydration";

const links: Array<{ href: "/" | "/cart" | "/checkout"; label: string }> = [
  { href: "/", label: "Menu" },
  { href: "/cart", label: "Cart" },
  { href: "/checkout", label: "Checkout" }
];

function isActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const pathname = usePathname();
  const hydrated = useCartHydration();
  const cartCount = useCartStore((state) => state.count());
  const safeCartCount = hydrated ? cartCount : 0;

  return (
    <header className="sticky top-0 z-50 border-b border-[#2B211B]/10 bg-[#130F0C]/95 text-[#FFF7EC] shadow-[0_16px_40px_rgba(19,15,12,0.22)] backdrop-blur">
      <div className="mx-auto flex min-h-[76px] w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 md:px-8">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md border border-[#F7C35F]/35 bg-[#2A211A] shadow-[0_10px_24px_rgba(0,0,0,0.22)]">
            <Image src="/icons/logo-square.png" alt="Firestone Country Smokehouse" fill className="object-cover" sizes="48px" priority />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-heading text-2xl leading-none tracking-normal text-[#F8E6C8] md:text-3xl">
              FIRESTONE
            </span>
            <span className="mt-1 block truncate text-[11px] font-bold uppercase tracking-[0.2em] text-[#E6B36B]">
              Country Smokehouse
            </span>
          </span>
        </Link>

        <nav aria-label="Primary navigation" className="hidden items-center gap-1 rounded-md border border-[#F7C35F]/15 bg-[#211812] p-1 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-md px-4 py-2 text-sm font-bold uppercase tracking-wide transition ${
                isActive(pathname, link.href)
                  ? "bg-[#F7C35F] text-[#24170F]"
                  : "text-[#F8E6C8] hover:bg-[#33251B] hover:text-white"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <Link
          href="/cart"
          className="inline-flex h-11 items-center gap-2 rounded-md border border-[#F7C35F]/30 bg-[#2A211A] px-3 text-sm font-extrabold uppercase tracking-wide text-[#FFF7EC] transition hover:border-[#F7C35F] hover:bg-[#3A2A1E]"
        >
          <span>Cart</span>
          <span className="inline-flex min-w-6 justify-center rounded bg-[#D9733A] px-1.5 py-0.5 text-xs text-white">
            {safeCartCount}
          </span>
        </Link>
      </div>
    </header>
  );
}
