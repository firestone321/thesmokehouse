import type { Metadata } from "next";
import Link from "next/link";
import { CartView } from "@/components/cart-view";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Cart",
  description: "Review your Firestone Country Smokehouse pickup order.",
  robots: {
    index: false,
    follow: false
  }
};

export default function CartPage() {
  return (
    <div className="min-h-screen bg-[#ECECEA]">
      <SiteHeader />
      <main>
        <section className="border-b border-[#242321]/12 bg-[#24201D] text-[#EEEEEA]">
          <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-10 md:flex-row md:items-end md:justify-between md:px-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#A66B55]">Review pickup order</p>
              <h1 className="mt-3 font-heading text-5xl leading-none tracking-normal text-[#F0F0EC] md:text-6xl">YOUR CART</h1>
              <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-[#C9CBC7]">
                Check quantities, remove anything you changed your mind about, then head to Pesapal checkout.
              </p>
            </div>
            <Link
              href="/"
              className="inline-flex w-fit rounded-md border border-[#6F554A] bg-[#30241F] px-5 py-3 text-sm font-extrabold uppercase tracking-wide text-[#EEEEEA] hover:border-[#A66B55] hover:bg-[#3A2A24]"
            >
              Continue Shopping
            </Link>
          </div>
        </section>
        <section className="px-4 py-8 md:px-8">
          <CartView />
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
