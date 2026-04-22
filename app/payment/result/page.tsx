import { Suspense } from "react";
import { PaymentResultView } from "@/components/payment-result-view";

export default function PaymentResultPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-cream p-6">
          <div className="mx-auto max-w-3xl rounded-2xl bg-white p-6 shadow-card">Loading payment result...</div>
        </main>
      }
    >
      <PaymentResultView />
    </Suspense>
  );
}
