"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";

const links: Array<{ href: "/" | "/order" | "/cart" | "/checkout" | "/contact"; label: string; description: string }> = [
  { href: "/", label: "Menu", description: "Smoked proteins, sides, accompaniments, and drinks" },
  { href: "/order", label: "Current Order", description: "Reopen your pickup code or receipt" },
  { href: "/cart", label: "Cart", description: "Review this device's order" },
  { href: "/checkout", label: "Checkout", description: "Pay and lock in pickup" },
  { href: "/contact", label: "Contact", description: "Phone, WhatsApp, and directions" }
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
      <header className="sticky top-0 z-[80] border-b border-[var(--border)] bg-[var(--header-bg)] text-[var(--foreground)] shadow-[var(--shadow-soft)] backdrop-blur-xl">
        <div className="mx-auto flex min-h-[76px] w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 md:px-8">
          <button
            type="button"
            aria-expanded={isMobileMenuOpen}
            aria-controls={mobileDrawerId}
            aria-label={isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            onClick={() => {
              setMobileMenuPath((currentPath) => (currentPath === pathname ? null : pathname));
            }}
            className="inline-flex min-w-0 items-center gap-3 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-left shadow-[var(--shadow-soft)] transition hover:bg-[var(--surface-alt)] md:hidden"
          >
            <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md border border-[var(--border-strong)] bg-[#30241F]">
              <Image src="/icons/logo-bigger.jpg" alt="Firestone Country Smokehouse" fill className="object-cover" sizes="44px" priority />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-heading text-2xl leading-none tracking-normal text-[var(--foreground)]">
                FIRESTONE
              </span>
              <span className="mt-1 block truncate text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--muted)]">
                Browse menu
              </span>
            </span>
            <span className={`ml-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--accent)] transition ${isMobileMenuOpen ? "rotate-180" : ""}`}>
              v
            </span>
          </button>

          <Link href="/" className="hidden min-w-0 items-center gap-3 md:flex">
            <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md border border-[var(--border-strong)] bg-[#30241F] shadow-[var(--shadow-soft)]">
              <Image src="/icons/logo-bigger.jpg" alt="Firestone Country Smokehouse" fill className="object-cover" sizes="48px" priority />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-heading text-3xl leading-none tracking-normal text-[var(--foreground)]">
                FIRESTONE
              </span>
              <span className="mt-1 block truncate text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--muted)]">
                Country Smokehouse
              </span>
            </span>
          </Link>

          <nav
            aria-label="Primary navigation"
            className="hidden min-h-12 flex-1 items-center justify-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface)] p-1 md:flex"
          >
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-md px-3 py-2 text-center text-xs font-bold uppercase tracking-wide transition lg:px-4 lg:text-sm ${
                  isActive(pathname, link.href)
                    ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                    : "text-[var(--foreground)] hover:bg-[var(--surface-alt)] hover:text-[var(--foreground)]"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <ThemeToggle />
        </div>
      </header>

      <div
        aria-hidden={!isMobileMenuOpen}
        onClick={() => {
          setMobileMenuPath(null);
        }}
        className={`fixed inset-0 z-[60] bg-black/30 backdrop-blur-sm transition-opacity duration-200 md:hidden ${
          isMobileMenuOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        id={mobileDrawerId}
        aria-hidden={!isMobileMenuOpen}
        className={`fixed inset-y-2 left-2 z-[90] flex w-[min(24rem,calc(100vw-1rem))] flex-col overflow-hidden rounded-[24px] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-modal)] transition-transform duration-200 md:hidden ${
          isMobileMenuOpen ? "pointer-events-auto translate-x-0" : "pointer-events-none -translate-x-[110%]"
        }`}
        style={{
          paddingTop: "calc(env(safe-area-inset-top) + 0.5rem)",
          paddingBottom: "calc(env(safe-area-inset-bottom) + 0.5rem)"
        }}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-5 pb-4">
          <div className="min-w-0">
            <p className="font-heading text-3xl leading-none tracking-normal text-[var(--foreground)]">FIRESTONE</p>
            <p className="mt-2 text-sm font-semibold text-[var(--muted)]">Menu, cart, checkout, and pickup code.</p>
          </div>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => {
              setMobileMenuPath(null);
            }}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface-alt)] text-xl font-bold text-[var(--accent)] shadow-[var(--shadow-soft)]"
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
                    ? "border-[var(--accent)] bg-white text-[var(--accent)] shadow-[var(--shadow-soft)]"
                    : "border-transparent bg-[var(--surface-alt)] text-[var(--foreground)] hover:border-[var(--border)] hover:bg-[var(--surface-raised)]"
                }`}
              >
                <span className="block text-base font-black uppercase tracking-wide">{link.label}</span>
                <span className="mt-1 block text-sm font-semibold leading-5 text-[var(--muted)]">{link.description}</span>
              </Link>
            ))}
          </nav>

          <div className="mt-6 rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface-alt)] p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted)]">Guest pickup</p>
            <p className="mt-2 text-base font-bold text-[var(--foreground)]">This phone can reopen its latest active order.</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-[var(--muted)]">
              Use Current Order to return to the pickup code or the 24-hour completed receipt.
            </p>
            <Link
              href="/order"
              onClick={() => {
                setMobileMenuPath(null);
              }}
              className="mt-4 flex items-center justify-between rounded-md bg-[var(--accent)] px-4 py-3 text-sm font-extrabold uppercase tracking-wide text-[var(--accent-foreground)]"
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
