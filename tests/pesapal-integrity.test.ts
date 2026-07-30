import assert from "node:assert/strict";
import test from "node:test";
import {
  assertCompletedPesapalBinding,
  assertPesapalTrackingBinding,
  assertSupabaseWriteSucceeded,
  type CanonicalPaymentStatus,
  PesapalPaymentIntegrityError,
  resolveMonotonicPaymentStatus,
  shouldExhaustInvalidRecovery
} from "../lib/payments/pesapal-integrity";
import { buildPesapalIpnAck } from "../lib/payments/pesapal-ipn";

const persisted = {
  publicToken: "order-public-token",
  expectedAmountUGX: 85_000,
  orderTrackingId: "tracking-order-1",
  attemptTrackingId: "tracking-order-1"
};

const completed = {
  suppliedTrackingId: "tracking-order-1",
  providerTrackingId: "tracking-order-1",
  merchantReference: "order-public-token",
  amount: 85_000,
  currency: "UGX",
  providerStatus: "COMPLETED"
};

function assertIntegrityCode(
  code: PesapalPaymentIntegrityError["code"],
  operation: () => void
) {
  assert.throws(operation, (error: unknown) => {
    return error instanceof PesapalPaymentIntegrityError && error.code === code;
  });
}

function applyObservations(
  initial: CanonicalPaymentStatus,
  observations: CanonicalPaymentStatus[]
) {
  return observations.reduce(resolveMonotonicPaymentStatus, initial);
}

test("accepts a completely bound COMPLETED transaction", () => {
  assert.doesNotThrow(() => assertCompletedPesapalBinding(persisted, completed));
});

test("rejects a wrong supplied tracking ID for a valid order", () => {
  assertIntegrityCode("supplied_tracking_mismatch", () => {
    assertCompletedPesapalBinding(persisted, {
      ...completed,
      suppliedTrackingId: "tracking-wrong"
    });
  });
});

test("rejects a valid tracking ID bound to another order attempt", () => {
  assertIntegrityCode("supplied_tracking_mismatch", () => {
    assertCompletedPesapalBinding(
      {
        ...persisted,
        orderTrackingId: "tracking-other-order"
      },
      completed
    );
  });
});

test("rejects a provider tracking ID that differs from the persisted attempt", () => {
  assertIntegrityCode("provider_tracking_mismatch", () => {
    assertCompletedPesapalBinding(persisted, {
      ...completed,
      providerTrackingId: "tracking-other-order"
    });
  });
});

test("rejects a merchant reference mismatch", () => {
  assertIntegrityCode("merchant_reference_mismatch", () => {
    assertCompletedPesapalBinding(persisted, {
      ...completed,
      merchantReference: "another-order-token"
    });
  });
});

test("rejects an amount mismatch", () => {
  assertIntegrityCode("amount_mismatch", () => {
    assertCompletedPesapalBinding(persisted, {
      ...completed,
      amount: 84_999
    });
  });
});

test("rejects a currency mismatch", () => {
  assertIntegrityCode("currency_mismatch", () => {
    assertCompletedPesapalBinding(persisted, {
      ...completed,
      currency: "USD"
    });
  });
});

test("rejects any provider state other than COMPLETED for a paid transition", () => {
  assertIntegrityCode("payment_not_completed", () => {
    assertCompletedPesapalBinding(persisted, {
      ...completed,
      providerStatus: "PENDING"
    });
  });
});

test("an INVALID lookup without transaction details can still reach bounded recovery", () => {
  assert.doesNotThrow(() => {
    assertPesapalTrackingBinding(persisted, {
      ...completed,
      merchantReference: null,
      amount: null,
      currency: null,
      providerStatus: "INVALID"
    });
  });
});

test("COMPLETED wins whether it races before or after PENDING", () => {
  assert.equal(applyObservations("pending", ["paid", "pending"]), "paid");
  assert.equal(applyObservations("pending", ["pending", "paid"]), "paid");
});

test("COMPLETED wins whether it races before or after CANCELLED", () => {
  assert.equal(applyObservations("pending", ["paid", "cancelled"]), "paid");
  assert.equal(applyObservations("pending", ["cancelled", "paid"]), "paid");
});

test("duplicated completed IPNs are idempotent", () => {
  assert.equal(applyObservations("pending", ["paid", "paid"]), "paid");
});

test("simultaneous callback and IPN completion cannot produce a downgrade", async () => {
  let status: CanonicalPaymentStatus = "pending";
  const apply = async (observed: CanonicalPaymentStatus) => {
    await Promise.resolve();
    status = resolveMonotonicPaymentStatus(status, observed);
  };

  await Promise.all([apply("paid"), apply("paid")]);
  assert.equal(status, "paid");
});

test("a Supabase payment-attempt write error is propagated", () => {
  assert.throws(
    () => assertSupabaseWriteSucceeded(
      { message: "database write failed", code: "XX000" },
      "Unable to persist payment attempt"
    ),
    /Unable to persist payment attempt \(XX000\): database write failed/
  );
});

test("INVALID recovery is bounded and exhausts at the configured attempt", () => {
  assert.equal(shouldExhaustInvalidRecovery(2, 3), false);
  assert.equal(shouldExhaustInvalidRecovery(3, 3), true);
  assert.equal(shouldExhaustInvalidRecovery(4, 3), true);
});

test("API 3.0 IPN acknowledgement uses the documented JSON shape", () => {
  assert.deepEqual(
    buildPesapalIpnAck(
      {
        OrderNotificationType: "IPNCHANGE",
        OrderTrackingId: "tracking-order-1",
        OrderMerchantReference: "order-public-token"
      },
      200
    ),
    {
      orderNotificationType: "IPNCHANGE",
      orderTrackingId: "tracking-order-1",
      orderMerchantReference: "order-public-token",
      status: 200
    }
  );
});
