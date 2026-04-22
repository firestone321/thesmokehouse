type PesapalTokenResponse = {
  token?: string;
  expiryDate?: string;
  status?: string;
  error?: {
    code?: string | null;
    message?: string | null;
    type?: string | null;
  } | null;
  message?: string | null;
};

type PesapalRegisterIpnResponse = {
  ipn_id?: string;
  url?: string | null;
  status?: string | null;
  error?: {
    code?: string | null;
    message?: string | null;
    type?: string | null;
  } | null;
  message?: string | null;
};

export type PesapalSubmitOrderResponse = {
  order_tracking_id?: string;
  merchant_reference?: string;
  redirect_url?: string | null;
  status?: string | null;
  message?: string | null;
  error?: {
    code?: string | null;
    message?: string | null;
    type?: string | null;
  } | null;
};

type PesapalTransactionStatusResponse = {
  payment_status_description?: string | null;
  confirmation_code?: string | null;
  order_tracking_id?: string | null;
  merchant_reference?: string | null;
  amount?: string | number | null;
  payment_method?: string | null;
};

type TokenCache = {
  token: string;
  expiresAt: number;
};

const provider = "pesapal";
const PESAPAL_REQUEST_TIMEOUT_MS = 10_000;
let tokenCache: TokenCache | null = null;
const ipnRegistrationCache = new Map<string, string>();

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getBaseUrl() {
  return process.env.PESAPAL_BASE_URL?.trim() || "https://cybqa.pesapal.com/pesapalv3";
}

function shouldForcePesapalInitiationRejection() {
  const normalized = process.env.PESAPAL_FORCE_INIT_REJECTION?.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function getCallbackUrl(publicToken: string, requestOrigin: string) {
  const url = new URL("/api/payments/pesapal/callback", requestOrigin);
  url.searchParams.set("token", publicToken);
  return url.toString();
}

function getCancellationUrl(publicToken: string, requestOrigin: string) {
  const url = new URL("/api/payments/pesapal/callback", requestOrigin);
  url.searchParams.set("token", publicToken);
  url.searchParams.set("cancelled", "1");
  return url.toString();
}

function getIpnUrl(requestOrigin: string) {
  return new URL("/api/payments/pesapal/ipn", requestOrigin).toString();
}

function isExplicitPesapalInitiationRejection(response: PesapalSubmitOrderResponse) {
  return Boolean(response.error?.code || response.error?.message || response.message || response.status);
}

export class PesapalInitiationRejectedError extends Error {
  readonly provider = provider;
  readonly code: string | null;
  readonly providerStatus: string | null;
  readonly providerMessage: string;
  readonly providerReference: string | null;
  readonly redirectUrl: string | null;
  readonly rawResponse: PesapalSubmitOrderResponse;

  constructor(input: {
    code?: string | null;
    providerStatus?: string | null;
    providerMessage: string;
    providerReference?: string | null;
    redirectUrl?: string | null;
    rawResponse: PesapalSubmitOrderResponse;
  }) {
    super(input.providerMessage);
    this.name = "PesapalInitiationRejectedError";
    this.code = input.code?.trim() || null;
    this.providerStatus = input.providerStatus?.trim() || null;
    this.providerMessage = input.providerMessage;
    this.providerReference = input.providerReference?.trim() || null;
    this.redirectUrl = input.redirectUrl?.trim() || null;
    this.rawResponse = input.rawResponse;
  }
}

export function isPesapalInitiationRejectedError(error: unknown): error is PesapalInitiationRejectedError {
  return (
    error instanceof PesapalInitiationRejectedError ||
    (typeof error === "object" &&
      error !== null &&
      "provider" in error &&
      (error as { provider?: unknown }).provider === provider &&
      "providerMessage" in error)
  );
}

async function fetchWithTimeout(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PESAPAL_REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function pesapalRequest<T>(path: string, init: RequestInit, options?: { authenticated?: boolean }) {
  const url = `${getBaseUrl()}${path}`;
  const headers = new Headers(init.headers ?? {});
  headers.set("Accept", "application/json");
  headers.set("Content-Type", "application/json");

  if (options?.authenticated) {
    headers.set("Authorization", `Bearer ${await getPesapalAuthToken()}`);
  }

  const response = await fetchWithTimeout(url, {
    ...init,
    headers
  });

  const rawText = await response.text();
  const payload = rawText.length > 0 ? (JSON.parse(rawText) as T) : ({} as T);

  if (!response.ok) {
    throw new Error(`Pesapal request failed (${response.status}): ${rawText || response.statusText}`);
  }

  return payload;
}

async function getPesapalAuthToken() {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 15_000) {
    return tokenCache.token;
  }

  const response = await pesapalRequest<PesapalTokenResponse>("/api/Auth/RequestToken", {
    method: "POST",
    body: JSON.stringify({
      consumer_key: getRequiredEnv("PESAPAL_CONSUMER_KEY"),
      consumer_secret: getRequiredEnv("PESAPAL_CONSUMER_SECRET")
    })
  });

  if (!response.token) {
    throw new Error(response.error?.message ?? response.message ?? "Pesapal token request failed.");
  }

  tokenCache = {
    token: response.token,
    expiresAt: Date.now() + 4 * 60_000
  };

  return response.token;
}

async function ensurePesapalIpnId(requestOrigin: string) {
  const cachedIpnId = ipnRegistrationCache.get(requestOrigin);
  if (cachedIpnId) {
    return cachedIpnId;
  }

  const response = await pesapalRequest<PesapalRegisterIpnResponse>(
    "/api/URLSetup/RegisterIPN",
    {
      method: "POST",
      body: JSON.stringify({
        url: getIpnUrl(requestOrigin),
        ipn_notification_type: "GET"
      })
    },
    { authenticated: true }
  );

  if (!response.ipn_id) {
    throw new Error(response.error?.message ?? response.message ?? "Pesapal IPN registration failed.");
  }

  ipnRegistrationCache.set(requestOrigin, response.ipn_id);
  return response.ipn_id;
}

export async function submitPesapalOrderRequest(input: {
  publicToken: string;
  amountUGX: number;
  description: string;
  customerName: string;
  phone?: string | null;
  email?: string | null;
  requestOrigin: string;
}): Promise<PesapalSubmitOrderResponse> {
  const callbackUrl = getCallbackUrl(input.publicToken, input.requestOrigin);
  const cancellationUrl = getCancellationUrl(input.publicToken, input.requestOrigin);

  if (shouldForcePesapalInitiationRejection()) {
    const forcedResponse: PesapalSubmitOrderResponse = {
      merchant_reference: input.publicToken,
      status: "REJECTED",
      message: "Forced preview rejection for explicit initiation-rejection testing.",
      error: {
        code: "forced_preview_rejection",
        message: "Forced preview rejection for explicit initiation-rejection testing.",
        type: "preview_test_toggle"
      }
    };

    throw new PesapalInitiationRejectedError({
      code: forcedResponse.error?.code ?? null,
      providerStatus: forcedResponse.status ?? null,
      providerMessage: forcedResponse.error?.message ?? forcedResponse.message ?? "Pesapal rejected the order request.",
      rawResponse: forcedResponse
    });
  }

  const ipnId = await ensurePesapalIpnId(input.requestOrigin);
  const [firstName, ...rest] = input.customerName.trim().split(/\s+/);
  const lastName = rest.join(" ");

  const response = await pesapalRequest<PesapalSubmitOrderResponse>(
    "/api/Transactions/SubmitOrderRequest",
    {
      method: "POST",
      body: JSON.stringify({
        id: input.publicToken,
        currency: "UGX",
        amount: input.amountUGX,
        description: input.description,
        redirect_mode: "TOP_WINDOW",
        callback_url: callbackUrl,
        cancellation_url: cancellationUrl,
        notification_id: ipnId,
        billing_address: {
          ...(input.email ? { email_address: input.email } : {}),
          ...(input.phone ? { phone_number: input.phone } : {}),
          country_code: "UG",
          first_name: firstName || "Customer",
          middle_name: "",
          last_name: lastName,
          line_1: "Smokehouse order",
          line_2: "",
          city: "Kampala",
          state: "",
          postal_code: "",
          zip_code: ""
        }
      })
    },
    { authenticated: true }
  );

  if (!response.order_tracking_id || !response.redirect_url) {
    if (isExplicitPesapalInitiationRejection(response)) {
      throw new PesapalInitiationRejectedError({
        code: response.error?.code ?? null,
        providerStatus: response.status ?? null,
        providerMessage: response.error?.message ?? response.message ?? response.status ?? "Pesapal rejected the order request.",
        providerReference: response.order_tracking_id ?? null,
        redirectUrl: response.redirect_url ?? null,
        rawResponse: response
      });
    }

    throw new Error(response.error?.message ?? response.message ?? "Pesapal order request did not return redirect details.");
  }

  return response;
}

export type NormalizedPesapalPaymentState = "pending" | "paid" | "failed";

export function normalizePesapalPaymentState(rawStatus: string | null | undefined): NormalizedPesapalPaymentState {
  const status = rawStatus?.trim().toUpperCase();

  if (status === "COMPLETED") {
    return "paid";
  }

  if (status === "FAILED" || status === "REVERSED") {
    return "failed";
  }

  return "pending";
}

export async function getPesapalTransactionStatus(orderTrackingId: string) {
  const url = new URL(`${getBaseUrl()}/api/Transactions/GetTransactionStatus`);
  url.searchParams.set("orderTrackingId", orderTrackingId);

  const response = await fetchWithTimeout(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${await getPesapalAuthToken()}`
    }
  });

  const rawText = await response.text();
  const payload = rawText.length > 0 ? (JSON.parse(rawText) as PesapalTransactionStatusResponse) : {};

  if (!response.ok) {
    throw new Error(`Pesapal status request failed (${response.status}): ${rawText || response.statusText}`);
  }

  return {
    providerReference: orderTrackingId,
    paymentStatus: normalizePesapalPaymentState(payload.payment_status_description),
    providerStatus: payload.payment_status_description ?? null,
    paymentReference: payload.confirmation_code ?? null,
    rawResponse: payload
  };
}
