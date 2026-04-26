import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-[#B8BAB6] bg-[#DDDDD9] text-[#30241F]">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 text-sm md:grid-cols-[1fr_auto] md:px-8">
        <div>
          <p className="font-heading text-2xl tracking-normal text-[#30241F]">FIRESTONE COUNTRY SMOKEHOUSE</p>
          <p className="mt-2 max-w-xl leading-6 text-[#555854]">
            Slow-fired takeaway, built around paid pickup orders, live stock, and kitchen handoff codes.
          </p>
        </div>
        <nav aria-label="Footer links" className="flex flex-wrap gap-4 md:justify-end">
          <Link href="/" className="font-semibold text-[#3B3D3A] hover:text-[#171716]">
            Menu
          </Link>
          <Link href="/cart" className="font-semibold text-[#3B3D3A] hover:text-[#171716]">
            Cart
          </Link>
          <Link href="/offline" className="font-semibold text-[#3B3D3A] hover:text-[#171716]">
            Offline
          </Link>
        </nav>
      </div>
    </footer>
  );
}
