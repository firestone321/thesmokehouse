import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact Firestone Country Smokehouse for orders, directions, and WhatsApp support."
};

const whatsappNumber = "256700000000";
const phoneNumberDisplay = "+256 700 000 000";

export default function ContactPage() {
  return (
    <div className="min-h-screen overflow-x-clip bg-[#ECECEA]">
      <SiteHeader />
      <main>
        <section className="border-b border-[#242321]/12 bg-[#24201D] text-[#EEEEEA] shadow-[inset_0_-1px_0_rgba(238,238,232,0.04)]">
          <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-10 md:flex-row md:items-end md:justify-between md:px-8">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#A66B55]">Contact smokehouse</p>
              <h1 className="mt-3 font-heading text-5xl leading-none tracking-normal text-[#F0F0EC] md:text-6xl">CONTACT</h1>
              <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-[#C9CBC7]">
                Reach out for pickup help, directions, or anything else we should know before you place your next order.
              </p>
            </div>
            <Link
              href="/checkout"
              className="inline-flex w-fit rounded-md border border-[#6F554A] bg-[#30241F] px-5 py-3 text-sm font-extrabold uppercase tracking-wide text-[#EEEEEA] hover:border-[#A66B55] hover:bg-[#3A2A24]"
            >
              Back to Checkout
            </Link>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-8 md:px-8">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <section className="min-w-0 rounded-2xl border border-[#C3C5C1] bg-[#F7F7F4] p-5 shadow-card md:p-6">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#A66B55]">Smokehouse contact</p>
              <h2 className="mt-3 font-heading text-4xl leading-none tracking-normal text-[#30241F] md:text-5xl">We’re here to help</h2>
              <p className="mt-4 max-w-2xl text-sm font-semibold leading-7 text-[#5F5D58]">
                This page is set up for the full contact experience. For now, the phone number and WhatsApp link are placeholders
                until the final line is confirmed.
              </p>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <a
                  href={`https://wa.me/${whatsappNumber}?text=Hello%20Firestone%20Country%20Smokehouse`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-2xl border border-[#D5C6B9] bg-[#FFF8EF] p-4 shadow-[0_12px_30px_rgba(42,33,26,0.08)] transition hover:border-[#A66B55]"
                >
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8A6246]">WhatsApp</p>
                  <p className="mt-2 text-lg font-black text-[#30241F]">{phoneNumberDisplay}</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-[#6A5647]">Tap to open a placeholder WhatsApp chat.</p>
                </a>

                <a
                  href={`tel:${whatsappNumber}`}
                  className="rounded-2xl border border-[#D5C6B9] bg-[#FFF8EF] p-4 shadow-[0_12px_30px_rgba(42,33,26,0.08)] transition hover:border-[#A66B55]"
                >
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8A6246]">Phone</p>
                  <p className="mt-2 text-lg font-black text-[#30241F]">{phoneNumberDisplay}</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-[#6A5647]">Placeholder phone line for calls and order questions.</p>
                </a>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-[#D5C6B9] bg-[#FFF8EF] p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8A6246]">Hours</p>
                  <p className="mt-2 text-base font-black text-[#30241F]">Daily service hours</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-[#6A5647]">Add the final opening times here when they are confirmed.</p>
                </div>

                <div className="rounded-2xl border border-[#D5C6B9] bg-[#FFF8EF] p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8A6246]">Pickup help</p>
                  <p className="mt-2 text-base font-black text-[#30241F]">Need directions?</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-[#6A5647]">Use the map placeholder on the right for the eventual location embed.</p>
                </div>
              </div>
            </section>

            <aside className="min-w-0 space-y-4">
              <div className="overflow-hidden rounded-2xl border border-[#C3C5C1] bg-[#F7F7F4] shadow-card">
                <div className="border-b border-[#D5C6B9] px-5 py-4">
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#A66B55]">Map placeholder</p>
                  <h2 className="mt-2 text-2xl font-black text-[#30241F]">Find us here</h2>
                </div>
                <div className="relative min-h-[320px] bg-[linear-gradient(135deg,#2C221D_0%,#3B2A21_45%,#5E3D2C_100%)] p-5 text-[#FFF7EC]">
                  <div className="absolute inset-0 opacity-20">
                    <div className="absolute left-6 top-8 h-24 w-24 rounded-full bg-[#E6B36B]/30 blur-2xl" />
                    <div className="absolute right-6 bottom-8 h-28 w-28 rounded-full bg-[#A66B55]/25 blur-3xl" />
                  </div>
                  <div className="relative flex h-full min-h-[280px] flex-col justify-end rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-[1px]">
                    <div className="rounded-xl border border-[#E6B36B]/30 bg-[#1F1814]/75 p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#E6B36B]">Map coming soon</p>
                      <p className="mt-2 text-lg font-black text-[#FFF7EC]">We’ll drop the live map embed in here.</p>
                      <p className="mt-2 text-sm font-semibold leading-6 text-[#E0D2C1]">
                        For now, this section holds the location block so the page is ready for the real place pin later.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-[#C3C5C1] bg-[#F7F7F4] p-5 shadow-card">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#A66B55]">Quick note</p>
                <p className="mt-3 text-sm font-semibold leading-7 text-[#5F5D58]">
                  Keep this page live while we finalize the actual contact details. The contact buttons can be swapped to the real
                  number and WhatsApp link without changing the layout.
                </p>
              </div>
            </aside>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
