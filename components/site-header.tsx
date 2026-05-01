"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { useCartStore } from "@/lib/store";
import { useCartHydration } from "@/lib/use-cart-hydration";

const links: Array<{ href: "/" | "/order" | "/cart" | "/checkout"; label: string; description: string }> = [
  { href: "/", label: "Menu", description: "Smoked proteins, sides, and drinks" },
  { href: "/order", label: "Current Order", description: "Reopen your pickup code or receipt" },
  { href: "/cart", label: "Cart", description: "Review this device's order" },
  { href: "/checkout", label: "Checkout", description: "Pay and lock in pickup" }
];

function isActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const pathname = usePathname();
  const [mobileMenuPath, setMobileMenuPath] = useState<string | null>(null);
  const mobileDrawerId = useId();
  const hydrated = useCartHydration();
  const cartCount = useCartStore((state) => state.count());
  const safeCartCount = hydrated ? cartCount : 0;
  const isMobileMenuOpen = mobileMenuPath === pathname;

  useEffect(() => {
    if (!isMobileMenuOpen) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    if (!isMobileMenuOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileMenuPath(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMobileMenuOpen]);

  return (
    <>
      <header className="sticky top-0 z-[80] border-b border-[#B8BAB6] bg-[#E8E8E4]/95 text-[#242321] shadow-[0_8px_22px_rgba(31,31,29,0.1)] backdrop-blur-xl">
        <div className="mx-auto flex min-h-[76px] w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 md:px-8">
          <button
            type="button"
            aria-expanded={isMobileMenuOpen}
            aria-controls={mobileDrawerId}
            aria-label={isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            onClick={() => {
              setMobileMenuPath((currentPath) => (currentPath === pathname ? null : pathname));
            }}
            className="inline-flex min-w-0 items-center gap-3 rounded-md border border-[#B8BAB6] bg-[#F2F2EF] px-3 py-2 text-left shadow-[0_8px_18px_rgba(31,31,29,0.1)] transition hover:bg-[#DADBD7] md:hidden"
          >
            <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md border border-[#A6A8A4] bg-[#30241F]">
              <Image src="/icons/logo-bigger.jpg" alt="Firestone Country Smokehouse" fill className="object-cover" sizes="44px" priority />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-heading text-2xl leading-none tracking-normal text-[#242321]">
                FIRESTONE
              </span>
              <span className="mt-1 block truncate text-[10px] font-bold uppercase tracking-[0.2em] text-[#666A67]">
                Browse menu
              </span>
            </span>
            <span className={`ml-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#B8BAB6] bg-white text-[#4B2E1F] transition ${isMobileMenuOpen ? "rotate-180" : ""}`}>
              v
            </span>
          </button>

          <Link href="/" className="hidden min-w-0 items-center gap-3 md:flex">
            <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md border border-[#A6A8A4] bg-[#30241F] shadow-[0_8px_18px_rgba(31,31,29,0.14)]">
              <Image src="/icons/logo-bigger.jpg" alt="Firestone Country Smokehouse" fill className="object-cover" sizes="48px" priority />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-heading text-3xl leading-none tracking-normal text-[#242321]">
                FIRESTONE
              </span>
              <span className="mt-1 block truncate text-[11px] font-bold uppercase tracking-[0.2em] text-[#666A67]">
                Country Smokehouse
              </span>
            </span>
          </Link>

          <nav
            aria-label="Primary navigation"
            className="hidden min-h-12 flex-1 items-center justify-center gap-1 rounded-md border border-[#B8BAB6] bg-[#F2F2EF] p-1 md:flex"
          >
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-md px-3 py-2 text-center text-xs font-bold uppercase tracking-wide transition lg:px-4 lg:text-sm ${
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

      <div
        aria-hidden={!isMobileMenuOpen}
        onClick={() => {
          setMobileMenuPath(null);
        }}
        className={`fixed inset-0 z-[60] bg-[#11100F]/35 backdrop-blur-sm transition-opacity duration-200 md:hidden ${
          isMobileMenuOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        id={mobileDrawerId}
        aria-hidden={!isMobileMenuOpen}
        className={`fixed inset-y-2 left-2 z-[90] flex w-[min(24rem,calc(100vw-1rem))] flex-col overflow-hidden rounded-[24px] border border-[#B8BAB6] bg-[#F2F2EF] shadow-[0_24px_70px_rgba(17,16,15,0.32)] transition-transform duration-200 md:hidden ${
          isMobileMenuOpen ? "pointer-events-auto translate-x-0" : "pointer-events-none -translate-x-[110%]"
        }`}
        style={{
          paddingTop: "calc(env(safe-area-inset-top) + 0.5rem)",
          paddingBottom: "calc(env(safe-area-inset-bottom) + 0.5rem)"
        }}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#B8BAB6] px-5 pb-4">
          <div className="min-w-0">
            <p className="font-heading text-3xl leading-none tracking-normal text-[#242321]">FIRESTONE</p>
            <p className="mt-2 text-sm font-semibold text-[#666A67]">Menu, cart, checkout, and pickup code.</p>
          </div>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => {
              setMobileMenuPath(null);
            }}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-[#B8BAB6] bg-white text-xl font-bold text-[#30241F] shadow-[0_8px_18px_rgba(31,31,29,0.1)]"
          >
            x
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5">
          <nav className="space-y-2" aria-label="Mobile navigation">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => {
                  setMobileMenuPath(null);
                }}
                className={`block rounded-md border px-4 py-3.5 transition ${
                  isActive(pathname, link.href)
                    ? "border-[#4B2E1F] bg-white text-[#4B2E1F] shadow-[0_8px_18px_rgba(31,31,29,0.1)]"
                    : "border-transparent bg-[#E8E8E4] text-[#242321] hover:border-[#B8BAB6] hover:bg-white"
                }`}
              >
                <span className="block text-base font-black uppercase tracking-wide">{link.label}</span>
                <span className="mt-1 block text-sm font-semibold leading-5 text-[#666A67]">{link.description}</span>
              </Link>
            ))}
          </nav>

          <div className="mt-6 rounded-[1.5rem] border border-[#B8BAB6] bg-[#E8E8E4] p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#666A67]">Guest pickup</p>
            <p className="mt-2 text-base font-bold text-[#30241F]">This phone can reopen its latest active order.</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-[#666A67]">
              Use Current Order to return to the pickup code or the 24-hour completed receipt.
            </p>
            <Link
              href="/order"
              onClick={() => {
                setMobileMenuPath(null);
              }}
              className="mt-4 flex items-center justify-between rounded-md bg-[#30241F] px-4 py-3 text-sm font-extrabold uppercase tracking-wide text-[#EEEEEA]"
            >
              <span>Current Order</span>
              <span>Open</span>
            </Link>
          </div>
        </div>
      </aside>
    </>
  );
}
