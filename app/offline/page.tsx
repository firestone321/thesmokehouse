import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Offline"
};

export default function OfflinePage() {
  return (
    <main className="min-h-screen bg-cream px-4 py-10 md:px-8">
      <div className="mx-auto max-w-xl rounded-2xl bg-white p-6 shadow-card">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-ember">Offline</p>
        <h1 className="mt-2 text-3xl font-extrabold text-walnut">You&apos;re offline right now</h1>
        <p className="mt-3 text-sm text-stone-700">
          Firestone Country Smokehouse needs a connection to refresh menu availability and place orders. Reconnect, then try again.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/" className="btn-primary rounded-xl px-5 py-3 text-sm font-semibold">
            Back Home
          </Link>
          <Link href="/cart" className="rounded-xl border border-[#d7c5b1] px-5 py-3 text-sm font-semibold text-walnut">
            View Cart
          </Link>
        </div>
      </div>
    </main>
  );
}
