import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact Firestone Country Smokehouse for orders, directions, and WhatsApp support."
};

const whatsappNumber = "256700000000";
const whatsappNumberDisplay = "+256 700 000 000";
const phoneNumber = "0393002970";
const phoneNumberDisplay = "0393002970";
const locationLabel = "JRVV+53 Kikandwa";
const googleMapsPlaceUrl =
  "https://www.google.com/maps/place/Firestone+Country+Smokehouse/@0.6429121,32.8400932,1131m/data=!3m2!1e3!4b1!4m6!3m5!1s0x177c3be9438e5e7d:0x93076eb88a9658ab!8m2!3d0.6429121!4d32.8426681!16s%2Fg%2F11zgk3bnv7?entry=ttu&g_ep=EgoyMDI2MDcwOC4wIKXMDSoASAFQAw%3D%3D";
const googleMapsEmbedUrl = "https://www.google.com/maps?q=0.6429121%2C32.8426681&z=16&output=embed";

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
                  <p className="mt-2 text-lg font-black text-[#30241F]">{whatsappNumberDisplay}</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-[#6A5647]">Tap to open a placeholder WhatsApp chat.</p>
                </a>

                <a
                  href={`tel:${phoneNumber}`}
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
                  <p className="mt-2 text-sm font-semibold leading-6 text-[#6A5647]">
                    Use the live map to find Firestone Country Smokehouse at {locationLabel}.
                  </p>
                </div>
              </div>
            </section>

            <aside className="min-w-0 space-y-4">
              <div className="overflow-hidden rounded-2xl border border-[#C3C5C1] bg-[#F7F7F4] shadow-card">
                <div className="border-b border-[#D5C6B9] px-5 py-4">
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#A66B55]">Kikandwa location</p>
                  <h2 className="mt-2 text-2xl font-black text-[#30241F]">Find us in Kikandwa</h2>
                </div>
                <div className="relative min-h-[360px] bg-[#DDDCD7]">
                  <iframe
                    title={"Map showing Firestone Country Smokehouse at " + locationLabel}
                    src={googleMapsEmbedUrl}
                    className="absolute inset-0 h-full w-full border-0"
                    loading="lazy"
                    allowFullScreen
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
                <div className="flex flex-col gap-4 border-t border-[#D5C6B9] bg-[#FFF8EF] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8A6246]">Firestone Country Smokehouse</p>
                    <p className="mt-1 text-base font-black text-[#30241F]">{locationLabel}</p>
                  </div>
                  <a
                    href={googleMapsPlaceUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={"Open Firestone Country Smokehouse at " + locationLabel + " in Google Maps"}
                    className="inline-flex w-fit rounded-md border border-[#6F554A] bg-[#30241F] px-4 py-2.5 text-sm font-extrabold uppercase tracking-wide text-[#EEEEEA] transition hover:border-[#A66B55] hover:bg-[#3A2A24]"
                  >
                    Open in Google Maps
                  </a>
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
