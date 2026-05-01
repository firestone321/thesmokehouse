import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--border)] bg-[var(--surface-alt)] text-[var(--foreground)]">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 text-sm md:grid-cols-[1fr_auto] md:px-8">
        <div>
          <p className="font-heading text-2xl tracking-normal text-[var(--foreground)]">FIRESTONE COUNTRY SMOKEHOUSE</p>
          <p className="mt-2 max-w-xl leading-6 text-[var(--muted)]">
            Slow-fired takeaway, built around paid pickup orders, live stock, and kitchen handoff codes.
          </p>
        </div>
        <nav aria-label="Footer links" className="flex flex-wrap gap-4 md:justify-end">
          <Link href="/" className="font-semibold text-[var(--foreground)] hover:text-[var(--accent)]">
            Menu
          </Link>
          <Link href="/cart" className="font-semibold text-[var(--foreground)] hover:text-[var(--accent)]">
            Cart
          </Link>
          <Link href="/offline" className="font-semibold text-[var(--foreground)] hover:text-[var(--accent)]">
            Offline
          </Link>
        </nav>
      </div>
    </footer>
  );
}
