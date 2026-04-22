export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0
  }).format(amount);
}

export function formatStatus(status: string): string {
  return status.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatPaymentStatus(paymentStatus: string): string {
  const normalized = paymentStatus.trim().toLowerCase();

  if (normalized === "paid") return "Paid";
  if (normalized === "failed" || normalized === "payment_failed") return "Payment Failed";
  if (normalized === "cancelled" || normalized === "canceled") return "Cancelled";

  return "Pending";
}
