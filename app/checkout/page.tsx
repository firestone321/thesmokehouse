import type { Metadata } from "next";
import Link from "next/link";
import { CheckoutForm } from "@/components/checkout-form";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Pay for your Firestone Country Smokehouse pickup order.",
  robots: {
    index: false,
    follow: false
  }
};

export default function CheckoutPage() {
  return (
    <div className="min-h-screen bg-[#F4EFE6]">
      <SiteHeader />
      <main>
        <section className="border-b border-[#2B211B]/10 bg-[#1C1410] text-[#FFF7EC]">
          <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-10 md:flex-row md:items-end md:justify-between md:px-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#E6B36B]">Secure payment</p>
              <h1 className="mt-3 font-heading text-5xl leading-none tracking-normal text-[#F8E6C8] md:text-6xl">CHECKOUT</h1>
              <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-[#D8C4AA]">
                Confirm your pickup details and head to Pesapal. Stock is reserved after payment verification.
              </p>
            </div>
            <Link
              href="/cart"
              className="inline-flex w-fit rounded-md border border-[#F7C35F]/35 bg-[#2A211A] px-5 py-3 text-sm font-extrabold uppercase tracking-wide text-[#FFF7EC] hover:border-[#F7C35F]"
            >
              Back to Cart
            </Link>
          </div>
        </section>
        <section className="mx-auto max-w-7xl px-4 py-8 md:px-8">
          <CheckoutForm />
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
