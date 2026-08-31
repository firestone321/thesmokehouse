import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { reconcileDuePendingPayments } from "@/lib/payments/order-payments";
import { processDueAdminPaidOrderPushDispatches } from "@/lib/push/admin-paid-order";

export const runtime = "nodejs";
export const maxDuration = 60;

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function isAuthorized(request: Request) {
  const configuredSecret = process.env.PAYMENT_RECOVERY_CRON_SECRET?.trim();
  const authorization = request.headers.get("authorization")?.trim();
  const providedSecret = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";

  return Boolean(
    configuredSecret
    && providedSecret
    && safeEqual(configuredSecret, providedSecret)
  );
}

async function processRecoveryCron(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const startedAt = new Date().toISOString();

  try {
    const paymentStats = await reconcileDuePendingPayments("supabase_cron", { limit: 2 });
    const adminPushStats = await processDueAdminPaidOrderPushDispatches();
    console.info("pending_payment_recovery_cron_completed", {
      startedAt,
      completedAt: new Date().toISOString(),
      stats: paymentStats,
      adminPushStats
    });
    return NextResponse.json({ accepted: true, startedAt, stats: paymentStats, adminPushStats }, { status: 200 });
  } catch (error) {
    console.error("pending_payment_recovery_cron_failed", {
      startedAt,
      failedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "unknown_error"
    });
    return NextResponse.json(
      { message: "Unable to process pending payment recoveries." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return processRecoveryCron(request);
}
