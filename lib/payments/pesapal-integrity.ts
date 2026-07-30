export type CanonicalPaymentStatus = "pending" | "paid" | "failed" | "cancelled";

export type PesapalVerifiedPayment = {
  suppliedTrackingId: string;
  providerTrackingId: string | null;
  merchantReference: string | null;
  amount: string | number | null;
  currency: string | null;
  providerStatus: string | null;
};

export type PersistedPesapalBinding = {
  publicToken: string;
  expectedAmountUGX: number;
  orderTrackingId: string | null;
  attemptTrackingId: string | null;
};

export type SupabaseWriteError = {
  message: string;
  code?: string | null;
};

export class PesapalPaymentIntegrityError extends Error {
  readonly code:
    | "missing_tracking_binding"
    | "supplied_tracking_mismatch"
    | "provider_tracking_mismatch"
    | "merchant_reference_mismatch"
    | "amount_mismatch"
    | "currency_mismatch"
    | "payment_not_completed";

  constructor(code: PesapalPaymentIntegrityError["code"], message: string) {
    super(message);
    this.name = "PesapalPaymentIntegrityError";
    this.code = code;
  }
}

function normalize(value: string | null | undefined) {
  return value?.trim() ?? "";
}

export function normalizePesapalProviderStatus(value: string | null | undefined) {
  return normalize(value).toUpperCase();
}

export function parsePesapalAmount(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function assertPesapalTrackingBinding(
  persisted: PersistedPesapalBinding,
  verified: PesapalVerifiedPayment
) {
  const storedOrderTrackingId = normalize(persisted.orderTrackingId);
  const storedAttemptTrackingId = normalize(persisted.attemptTrackingId);
  const suppliedTrackingId = normalize(verified.suppliedTrackingId);
  const providerTrackingId = normalize(verified.providerTrackingId);

  if (!storedOrderTrackingId || !storedAttemptTrackingId) {
    throw new PesapalPaymentIntegrityError(
      "missing_tracking_binding",
      "The order does not have a complete persisted Pesapal tracking binding."
    );
  }

  if (
    suppliedTrackingId !== storedOrderTrackingId
    || suppliedTrackingId !== storedAttemptTrackingId
  ) {
    throw new PesapalPaymentIntegrityError(
      "supplied_tracking_mismatch",
      "The supplied Pesapal tracking ID does not match the persisted payment attempt."
    );
  }

  if (!providerTrackingId || providerTrackingId !== storedAttemptTrackingId) {
    throw new PesapalPaymentIntegrityError(
      "provider_tracking_mismatch",
      "Pesapal returned a tracking ID that does not match the persisted payment attempt."
    );
  }

}

export function assertCompletedPesapalBinding(
  persisted: PersistedPesapalBinding,
  verified: PesapalVerifiedPayment
) {
  assertPesapalTrackingBinding(persisted, verified);

  if (normalize(verified.merchantReference) !== persisted.publicToken) {
    throw new PesapalPaymentIntegrityError(
      "merchant_reference_mismatch",
      "Pesapal returned a merchant reference that does not match the order."
    );
  }

  const amount = parsePesapalAmount(verified.amount);
  if (amount === null || amount !== persisted.expectedAmountUGX) {
    throw new PesapalPaymentIntegrityError(
      "amount_mismatch",
      "Pesapal returned an amount that does not match the order total."
    );
  }

  if (normalize(verified.currency).toUpperCase() !== "UGX") {
    throw new PesapalPaymentIntegrityError(
      "currency_mismatch",
      "Pesapal returned a currency that does not match the order currency."
    );
  }

  if (normalizePesapalProviderStatus(verified.providerStatus) !== "COMPLETED") {
    throw new PesapalPaymentIntegrityError(
      "payment_not_completed",
      "Pesapal has not reported this payment as completed."
    );
  }
}

export function resolveMonotonicPaymentStatus(
  current: CanonicalPaymentStatus,
  observed: CanonicalPaymentStatus
): CanonicalPaymentStatus {
  return current === "paid" ? "paid" : observed;
}

export function shouldExhaustInvalidRecovery(attemptCount: number, maximumInvalidAttempts: number) {
  return attemptCount >= maximumInvalidAttempts;
}

export function assertSupabaseWriteSucceeded(
  error: SupabaseWriteError | null | undefined,
  operation: string
) {
  if (error) {
    const suffix = error.code ? ` (${error.code})` : "";
    throw new Error(`${operation}${suffix}: ${error.message}`);
  }
}
