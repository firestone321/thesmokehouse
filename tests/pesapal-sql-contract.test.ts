import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const orderPayments = source("lib/payments/order-payments.ts");
const callbackRoute = source("app/api/payments/pesapal/callback/route.ts");
const ipnRoute = source("app/api/payments/pesapal/ipn/route.ts");
const cronRoute = source("app/api/internal/payments/recovery/cron/route.ts");
const adminPaidOrderPush = source("lib/push/admin-paid-order.ts");

test("provider verification mutations use the row-locked database RPC", () => {
  assert.match(orderPayments, /rpc\("apply_pesapal_payment_verification"/);
  assert.doesNotMatch(orderPayments, /\.from\("orders"\)\s*\.update/);
  assert.doesNotMatch(orderPayments, /\.from\("payment_attempts"\)\s*\.update/);
});

test("cancelled=1 cannot directly cancel an order", () => {
  const trackingGuard = callbackRoute.indexOf("if (!orderTrackingId)");
  const cancellationCall = callbackRoute.indexOf("await markOrderPaymentCancelled({");
  assert.ok(trackingGuard >= 0);
  assert.ok(cancellationCall > trackingGuard);
});

test("the API 3.0 IPN route acknowledges with JSON rather than text", () => {
  assert.match(ipnRoute, /NextResponse\.json\(buildPesapalIpnAck\(payload, 200\)/);
  assert.match(ipnRoute, /NextResponse\.json\(buildPesapalIpnAck\(payload, 500\)/);
  assert.doesNotMatch(ipnRoute, /text\/plain/);
});

test("recovery expiry uses the active attempt initiation timestamp", () => {
  assert.match(orderPayments, /isTrackedPendingPaymentExpired\(attempt:/);
  assert.match(orderPayments, /isOlderThan\(attempt\.created_at/);
});

test("cancellation verifies provider state before calling the cancellation API", () => {
  const verificationCall = orderPayments.indexOf(
    "const verification = await verifyPesapalPaymentForOrder"
  );
  const cancellationCall = orderPayments.indexOf(
    "const cancellation = await cancelPesapalOrder"
  );
  assert.ok(verificationCall >= 0);
  assert.ok(cancellationCall > verificationCall);
});

test("independent recovery requires a dedicated bearer secret", () => {
  assert.match(cronRoute, /PAYMENT_RECOVERY_CRON_SECRET/);
  assert.match(cronRoute, /timingSafeEqual/);
  assert.match(cronRoute, /reconcileDuePendingPayments\("supabase_cron"/);
  assert.match(cronRoute, /processDueAdminPaidOrderPushDispatches\(\)/);
});

test("admin paid-order pushes have immediate and due-queue delivery paths", () => {
  assert.match(callbackRoute, /triggerAdminPaidOrderPushDispatch\(paidOrderId\)/);
  assert.match(ipnRoute, /triggerAdminPaidOrderPushDispatch\(paidOrderId\)/);
  assert.match(adminPaidOrderPush, /admin_push_dispatches/);
  assert.match(adminPaidOrderPush, /status\.in\.\(pending,no_subscribers\)/);
});
