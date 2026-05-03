export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0
  }).format(amount);
}

export function toKampalaDateTimeString(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }

  return new Intl.DateTimeFormat("en-UG", {
    timeZone: "Africa/Kampala",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

export function toKampalaTimeString(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }

  return new Intl.DateTimeFormat("en-UG", {
    timeZone: "Africa/Kampala",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

export function formatDateTimeInKampala(value: string | Date): string {
  return `${toKampalaDateTimeString(value)} EAT`;
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
