import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy policy for Firestone Country Smokehouse — how we collect, use, and protect your data.",
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen overflow-x-clip bg-[#ECECEA]">
      <SiteHeader />
      <main>
        <section className="border-b border-[#242321]/12 bg-[#24201D] text-[#EEEEEA]">
          <div className="mx-auto max-w-7xl px-4 py-10 md:px-8">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#A66B55]">Legal</p>
            <h1 className="mt-3 font-heading text-5xl leading-none tracking-normal text-[#F0F0EC] md:text-6xl">
              PRIVACY POLICY
            </h1>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-[#C9CBC7]">
              Last updated: May 2026
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 py-10 md:px-8">
          <div className="space-y-8 text-[#30241F]">

            <div className="rounded-2xl border border-[#C3C5C1] bg-[#F7F7F4] p-6 shadow-card">
              <h2 className="font-heading text-2xl tracking-normal text-[#30241F]">Who we are</h2>
              <p className="mt-3 text-sm leading-7 text-[#5F5D58]">
                Firestone Country Smokehouse (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) operates the online
                ordering platform at this website. This Privacy Policy explains what personal information we collect when you
                use our Service, how we use it, and your rights regarding that information.
              </p>
            </div>

            <div className="rounded-2xl border border-[#C3C5C1] bg-[#F7F7F4] p-6 shadow-card">
              <h2 className="font-heading text-2xl tracking-normal text-[#30241F]">Information we collect</h2>

              <h3 className="mt-5 text-base font-black text-[#30241F]">When you place an order (guest checkout)</h3>
              <ul className="mt-2 space-y-1 text-sm leading-7 text-[#5F5D58]">
                <li>— Your name and phone number (required to prepare and hand off your order)</li>
                <li>— Your order items, quantities, and total</li>
                <li>— A device identifier stored in your browser to let you reopen your order receipt</li>
                <li>— Payment transaction data processed by Pesapal (we never see or store your card details)</li>
              </ul>

              <h3 className="mt-5 text-base font-black text-[#30241F]">When you create an account</h3>
              <ul className="mt-2 space-y-1 text-sm leading-7 text-[#5F5D58]">
                <li>— Your email address</li>
                <li>— Your full name (if provided during sign-up or from your Google profile)</li>
                <li>— An authentication record managed by Supabase Auth</li>
              </ul>

              <h3 className="mt-5 text-base font-black text-[#30241F]">When you sign in with Google</h3>
              <p className="mt-2 text-sm leading-7 text-[#5F5D58]">
                If you choose to sign in with Google, we receive your Google account email address and display name via
                OAuth 2.0. We do not receive your Google password, contacts, files, or any other Google account data. We
                use only what is necessary to create and identify your Smokehouse account.
              </p>

              <h3 className="mt-5 text-base font-black text-[#30241F]">Automatically collected data</h3>
              <ul className="mt-2 space-y-1 text-sm leading-7 text-[#5F5D58]">
                <li>— Standard web server logs (IP address, browser type, pages visited) collected by Vercel, our hosting provider</li>
                <li>— Anonymised page-view analytics collected by Vercel Analytics</li>
                <li>— Browser push notification subscription tokens, stored only if you opt in to pickup-ready alerts</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-[#C3C5C1] bg-[#F7F7F4] p-6 shadow-card">
              <h2 className="font-heading text-2xl tracking-normal text-[#30241F]">How we use your information</h2>
              <ul className="mt-3 space-y-2 text-sm leading-7 text-[#5F5D58]">
                <li>— <strong>To fulfil your order:</strong> we use your name, phone, and order details to prepare your food and hand it off at the counter.</li>
                <li>— <strong>To process payment:</strong> your order total and a reference number are sent to Pesapal to initiate and verify payment.</li>
                <li>— <strong>To send pickup notifications:</strong> if you opt in, we send a browser push notification when your order is ready.</li>
                <li>— <strong>To operate your account:</strong> if you have an account, we use your email to authenticate you and associate your order history.</li>
                <li>— <strong>To improve the Service:</strong> aggregated, anonymised analytics help us understand which menu items are popular and how the app performs.</li>
              </ul>
              <p className="mt-4 text-sm leading-7 text-[#5F5D58]">
                We do not use your data for advertising, and we do not sell or rent your personal information to any third party.
              </p>
            </div>

            <div className="rounded-2xl border border-[#C3C5C1] bg-[#F7F7F4] p-6 shadow-card">
              <h2 className="font-heading text-2xl tracking-normal text-[#30241F]">Third-party services</h2>
              <p className="mt-3 text-sm leading-7 text-[#5F5D58]">
                We rely on the following trusted third-party services to operate:
              </p>
              <div className="mt-4 space-y-4">
                <div>
                  <p className="text-sm font-black text-[#30241F]">Supabase</p>
                  <p className="mt-1 text-sm leading-6 text-[#5F5D58]">
                    Hosts our database and authentication system. Your account credentials and order data are stored in
                    Supabase&apos;s infrastructure. Supabase complies with GDPR. See{" "}
                    <a href="https://supabase.com/privacy" target="_blank" rel="noreferrer" className="font-semibold text-[#A66B55] hover:underline">
                      supabase.com/privacy
                    </a>.
                  </p>
                </div>
                <div>
                  <p className="text-sm font-black text-[#30241F]">Google (OAuth sign-in)</p>
                  <p className="mt-1 text-sm leading-6 text-[#5F5D58]">
                    If you use &ldquo;Sign in with Google,&rdquo; your authentication is handled by Google. We receive only your email
                    and name. See{" "}
                    <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer" className="font-semibold text-[#A66B55] hover:underline">
                      Google&apos;s Privacy Policy
                    </a>.
                  </p>
                </div>
                <div>
                  <p className="text-sm font-black text-[#30241F]">Pesapal</p>
                  <p className="mt-1 text-sm leading-6 text-[#5F5D58]">
                    Processes all payments. Your card and mobile money details are handled entirely by Pesapal; we never
                    see or store them. See{" "}
                    <a href="https://www.pesapal.com/privacy" target="_blank" rel="noreferrer" className="font-semibold text-[#A66B55] hover:underline">
                      Pesapal&apos;s Privacy Policy
                    </a>.
                  </p>
                </div>
                <div>
                  <p className="text-sm font-black text-[#30241F]">Vercel</p>
                  <p className="mt-1 text-sm leading-6 text-[#5F5D58]">
                    Hosts this website and provides anonymised analytics. See{" "}
                    <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noreferrer" className="font-semibold text-[#A66B55] hover:underline">
                      Vercel&apos;s Privacy Policy
                    </a>.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[#C3C5C1] bg-[#F7F7F4] p-6 shadow-card">
              <h2 className="font-heading text-2xl tracking-normal text-[#30241F]">Data retention</h2>
              <p className="mt-3 text-sm leading-7 text-[#5F5D58]">
                Guest order records are retained for operational and legal purposes (tax records, dispute resolution). Account
                information is retained for as long as your account is active. Push notification subscription tokens are removed
                when they expire or become invalid. You can request deletion of your account and associated data at any time by
                contacting us.
              </p>
            </div>

            <div className="rounded-2xl border border-[#C3C5C1] bg-[#F7F7F4] p-6 shadow-card">
              <h2 className="font-heading text-2xl tracking-normal text-[#30241F]">Cookies and local storage</h2>
              <p className="mt-3 text-sm leading-7 text-[#5F5D58]">
                We use browser cookies to maintain your authenticated session (if you have an account). We use
                <code className="mx-1 rounded bg-[#EDE9E4] px-1.5 py-0.5 font-mono text-xs">localStorage</code> to remember
                your active guest order token and theme preference on your device. We do not use advertising cookies or
                third-party tracking cookies.
              </p>
            </div>

            <div className="rounded-2xl border border-[#C3C5C1] bg-[#F7F7F4] p-6 shadow-card">
              <h2 className="font-heading text-2xl tracking-normal text-[#30241F]">Your rights</h2>
              <p className="mt-3 text-sm leading-7 text-[#5F5D58]">
                You have the right to:
              </p>
              <ul className="mt-2 space-y-1 text-sm leading-7 text-[#5F5D58]">
                <li>— <strong>Access</strong> the personal data we hold about you</li>
                <li>— <strong>Correct</strong> inaccurate information in your account</li>
                <li>— <strong>Delete</strong> your account and associated personal data</li>
                <li>— <strong>Withdraw consent</strong> for push notifications at any time through your browser settings</li>
                <li>— <strong>Revoke Google access</strong> via your Google Account settings at{" "}
                  <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer" className="font-semibold text-[#A66B55] hover:underline">
                    myaccount.google.com/permissions
                  </a>
                </li>
              </ul>
              <p className="mt-4 text-sm leading-7 text-[#5F5D58]">
                To exercise any of these rights, contact us via the{" "}
                <Link href="/contact" className="font-semibold text-[#A66B55] hover:underline">
                  Contact page
                </Link>
                .
              </p>
            </div>

            <div className="rounded-2xl border border-[#C3C5C1] bg-[#F7F7F4] p-6 shadow-card">
              <h2 className="font-heading text-2xl tracking-normal text-[#30241F]">Children&apos;s privacy</h2>
              <p className="mt-3 text-sm leading-7 text-[#5F5D58]">
                Our Service is not directed at children under 13. We do not knowingly collect personal information from
                children. If you believe a child has provided us with personal data, please contact us and we will delete it.
              </p>
            </div>

            <div className="rounded-2xl border border-[#C3C5C1] bg-[#F7F7F4] p-6 shadow-card">
              <h2 className="font-heading text-2xl tracking-normal text-[#30241F]">Changes to this policy</h2>
              <p className="mt-3 text-sm leading-7 text-[#5F5D58]">
                We may update this policy as the Service evolves. Material changes will be reflected in the
                &ldquo;Last updated&rdquo; date above. Continued use of the Service after changes constitutes acceptance of the
                revised policy.
              </p>
            </div>

            <div className="rounded-2xl border border-[#C3C5C1] bg-[#F7F7F4] p-6 shadow-card">
              <h2 className="font-heading text-2xl tracking-normal text-[#30241F]">Contact us</h2>
              <p className="mt-3 text-sm leading-7 text-[#5F5D58]">
                For privacy questions or data requests, reach us via the{" "}
                <Link href="/contact" className="font-semibold text-[#A66B55] hover:underline">
                  Contact page
                </Link>
                . You can also review our{" "}
                <Link href="/terms" className="font-semibold text-[#A66B55] hover:underline">
                  Terms of Service
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
