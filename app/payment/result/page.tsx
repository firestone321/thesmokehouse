import type { Metadata } from "next";
import { Suspense } from "react";
import { PaymentResultView } from "@/components/payment-result-view";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Payment Result",
  robots: {
    index: false,
    follow: false
  }
};

export default function PaymentResultPage() {
  return (
    <div className="min-h-screen bg-[#F4EFE6]">
      <SiteHeader />
      <Suspense
        fallback={
          <main className="min-h-[70vh] bg-[#F4EFE6] px-4 py-12 md:px-8">
            <div className="mx-auto max-w-4xl rounded-md border border-[#2B211B]/10 bg-[#FFF8EF] p-6 text-[#4B2E1F] shadow-card">
              Checking the payment fire...
            </div>
          </main>
        }
      >
        <PaymentResultView />
      </Suspense>
      <SiteFooter />
    </div>
  );
}
