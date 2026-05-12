import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms of service for Firestone Country Smokehouse online ordering.",
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return (
    <div className="min-h-screen overflow-x-clip bg-[#ECECEA]">
      <SiteHeader />
      <main>
        <section className="border-b border-[#242321]/12 bg-[#24201D] text-[#EEEEEA]">
          <div className="mx-auto max-w-7xl px-4 py-10 md:px-8">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#A66B55]">Legal</p>
            <h1 className="mt-3 font-heading text-5xl leading-none tracking-normal text-[#F0F0EC] md:text-6xl">
              TERMS OF SERVICE
            </h1>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-[#C9CBC7]">
              Last updated: May 2026
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 py-10 md:px-8">
          <div className="space-y-8 text-[#30241F]">

            <div className="rounded-2xl border border-[#C3C5C1] bg-[#F7F7F4] p-6 shadow-card">
              <h2 className="font-heading text-2xl tracking-normal text-[#30241F]">About these terms</h2>
              <p className="mt-3 text-sm leading-7 text-[#5F5D58]">
                These Terms of Service govern your use of the Firestone Country Smokehouse online ordering platform
                (the &ldquo;Service&rdquo;), operated by Firestone Country Smokehouse (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;).
                By placing an order or creating an account you agree to these terms. If you do not agree, do not use the Service.
              </p>
            </div>

            <div className="rounded-2xl border border-[#C3C5C1] bg-[#F7F7F4] p-6 shadow-card">
              <h2 className="font-heading text-2xl tracking-normal text-[#30241F]">The service</h2>
              <p className="mt-3 text-sm leading-7 text-[#5F5D58]">
                Firestone Country Smokehouse is a takeaway restaurant based in Uganda. The Service allows customers to
                browse our menu, place pickup orders, and pay online via Pesapal. We do not offer delivery. All orders
                are for pickup at our physical location.
              </p>
              <p className="mt-3 text-sm leading-7 text-[#5F5D58]">
                Menu availability, pricing, and operating hours are subject to change without notice. We reserve the right
                to refuse or cancel any order at our discretion, in which case a full refund will be issued.
              </p>
            </div>

            <div className="rounded-2xl border border-[#C3C5C1] bg-[#F7F7F4] p-6 shadow-card">
              <h2 className="font-heading text-2xl tracking-normal text-[#30241F]">Accounts</h2>
              <p className="mt-3 text-sm leading-7 text-[#5F5D58]">
                You may place orders as a guest without creating an account. Optionally, you can create a customer account
                using your email address and password, or by signing in with Google. An account lets you revisit order history
                and check out faster.
              </p>
              <p className="mt-3 text-sm leading-7 text-[#5F5D58]">
                You are responsible for keeping your account credentials secure. You must be at least 18 years old, or have
                the permission of a parent or guardian, to create an account. We reserve the right to suspend accounts that
                violate these terms.
              </p>
            </div>

            <div className="rounded-2xl border border-[#C3C5C1] bg-[#F7F7F4] p-6 shadow-card">
              <h2 className="font-heading text-2xl tracking-normal text-[#30241F]">Orders and payment</h2>
              <p className="mt-3 text-sm leading-7 text-[#5F5D58]">
                Orders are confirmed once payment is successfully processed through Pesapal. Your order is locked in at
                that point and sent to our kitchen. You will receive a pickup code to collect your order.
              </p>
              <p className="mt-3 text-sm leading-7 text-[#5F5D58]">
                Prices are in Ugandan Shillings (UGX) and include applicable taxes. Payment is handled entirely by Pesapal;
                we do not store your card details. Refunds for cancelled or unfulfillable orders are processed through
                Pesapal and may take 3&ndash;10 business days depending on your payment method.
              </p>
            </div>

            <div className="rounded-2xl border border-[#C3C5C1] bg-[#F7F7F4] p-6 shadow-card">
              <h2 className="font-heading text-2xl tracking-normal text-[#30241F]">Acceptable use</h2>
              <p className="mt-3 text-sm leading-7 text-[#5F5D58]">
                You agree not to use the Service to submit false or fraudulent orders, to interfere with the platform&apos;s
                operation, to attempt to access data you are not authorised to access, or to use automated tools to scrape,
                stress-test, or abuse the ordering system. Violations may result in permanent suspension and, where appropriate,
                legal action.
              </p>
            </div>

            <div className="rounded-2xl border border-[#C3C5C1] bg-[#F7F7F4] p-6 shadow-card">
              <h2 className="font-heading text-2xl tracking-normal text-[#30241F]">Intellectual property</h2>
              <p className="mt-3 text-sm leading-7 text-[#5F5D58]">
                All content on this platform — including the name, logo, menu descriptions, images, and design — belongs to
                Firestone Country Smokehouse. You may not reproduce or distribute any part of it without our written permission.
              </p>
            </div>

            <div className="rounded-2xl border border-[#C3C5C1] bg-[#F7F7F4] p-6 shadow-card">
              <h2 className="font-heading text-2xl tracking-normal text-[#30241F]">Limitation of liability</h2>
              <p className="mt-3 text-sm leading-7 text-[#5F5D58]">
                The Service is provided &ldquo;as is.&rdquo; We make no warranties about uptime, accuracy, or fitness for a
                particular purpose. To the extent permitted by Ugandan law, our total liability for any claim arising from your
                use of the Service is limited to the amount you paid for the order giving rise to the claim.
              </p>
            </div>

            <div className="rounded-2xl border border-[#C3C5C1] bg-[#F7F7F4] p-6 shadow-card">
              <h2 className="font-heading text-2xl tracking-normal text-[#30241F]">Governing law</h2>
              <p className="mt-3 text-sm leading-7 text-[#5F5D58]">
                These terms are governed by the laws of Uganda. Any disputes will be resolved in the courts of Uganda.
              </p>
            </div>

            <div className="rounded-2xl border border-[#C3C5C1] bg-[#F7F7F4] p-6 shadow-card">
              <h2 className="font-heading text-2xl tracking-normal text-[#30241F]">Changes to these terms</h2>
              <p className="mt-3 text-sm leading-7 text-[#5F5D58]">
                We may update these terms from time to time. Material changes will be reflected in the &ldquo;Last updated&rdquo;
                date above. Continued use of the Service after changes constitutes acceptance of the revised terms.
              </p>
            </div>

            <div className="rounded-2xl border border-[#C3C5C1] bg-[#F7F7F4] p-6 shadow-card">
              <h2 className="font-heading text-2xl tracking-normal text-[#30241F]">Contact us</h2>
              <p className="mt-3 text-sm leading-7 text-[#5F5D58]">
                Questions about these terms? Reach us via the{" "}
                <Link href="/contact" className="font-semibold text-[#A66B55] hover:underline">
                  Contact page
                </Link>{" "}
                or review our{" "}
                <Link href="/privacy" className="font-semibold text-[#A66B55] hover:underline">
                  Privacy Policy
                </Link>
                .
              </p>
            </div>

          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
