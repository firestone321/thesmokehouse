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
    <header className="sticky top-0 z-50 border-b border-[#B8BAB6] bg-[#E8E8E4] text-[#242321] shadow-[0_8px_22px_rgba(31,31,29,0.1)]">
      <div className="mx-auto flex min-h-[76px] w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 md:px-8">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md border border-[#A6A8A4] bg-[#30241F] shadow-[0_8px_18px_rgba(31,31,29,0.14)]">
            <Image src="/icons/logo-bigger.jpg" alt="Firestone Country Smokehouse" fill className="object-cover" sizes="48px" priority />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-heading text-2xl leading-none tracking-normal text-[#242321] md:text-3xl">
              FIRESTONE
            </span>
            <span className="mt-1 block truncate text-[11px] font-bold uppercase tracking-[0.2em] text-[#666A67]">
              Country Smokehouse
            </span>
          </span>
        </Link>

        <nav aria-label="Primary navigation" className="hidden items-center gap-1 rounded-md border border-[#B8BAB6] bg-[#F2F2EF] p-1 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-md px-4 py-2 text-sm font-bold uppercase tracking-wide transition ${
                isActive(pathname, link.href)
                  ? "bg-[#30241F] text-[#EEEEEA]"
                  : "text-[#333331] hover:bg-[#DADBD7] hover:text-[#171716]"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <Link
          href="/cart"
          className="inline-flex h-11 items-center gap-2 rounded-md border border-[#B8BAB6] bg-[#F2F2EF] px-3 text-sm font-extrabold uppercase tracking-wide text-[#242321] transition hover:border-[#8D918C] hover:bg-[#DADBD7]"
        >
          <span>Cart</span>
          <span className="inline-flex min-w-6 justify-center rounded bg-[#4D3327] px-1.5 py-0.5 text-xs text-[#EEEEEA]">
            {safeCartCount}
          </span>
        </Link>
      </div>
    </header>
  );
}
