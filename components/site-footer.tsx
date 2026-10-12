import Link from "next/link";
import { WhatsAppFloat } from "@/components/whatsapp-float";

export function SiteFooter() {
  return (
    <>
      <footer className="border-t border-[var(--border)] bg-[var(--surface-alt)] text-[var(--foreground)]">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 pt-8 pb-24 text-sm md:grid-cols-[1fr_auto] md:px-8">
          <div>
            <p className="font-heading text-2xl tracking-normal text-[var(--foreground)]">FIRESTONE COUNTRY SMOKEHOUSE</p>
            <p className="mt-2 max-w-xl leading-6 text-[var(--muted)]">
              Slow-fired meats, convenient ordering, and an experience worth coming back to.
            </p>
          </div>
          <nav aria-label="Footer links" className="flex flex-wrap gap-4 md:justify-end">
            <Link href="/" className="font-semibold text-[var(--foreground)] hover:text-[var(--accent)]">
              Menu
            </Link>
            <Link href="/cart" className="font-semibold text-[var(--foreground)] hover:text-[var(--accent)]">
              Cart
            </Link>
            <Link href="/contact" className="font-semibold text-[var(--foreground)] hover:text-[var(--accent)]">
              Contact
            </Link>
            <Link href="/terms" className="font-semibold text-[var(--foreground)] hover:text-[var(--accent)]">
              Terms
            </Link>
            <Link href="/privacy" className="font-semibold text-[var(--foreground)] hover:text-[var(--accent)]">
              Privacy
            </Link>
          </nav>
        </div>
      </footer>
      <WhatsAppFloat />
    </>
  );
}
