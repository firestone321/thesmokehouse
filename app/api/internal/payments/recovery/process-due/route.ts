import { NextResponse } from "next/server";
import { z } from "zod";
import {
  extractBearerToken,
  InternalRequestAuthError,
  requireInternalRequestSigningSecret,
  verifyInternalRequestToken
} from "@/lib/internal-auth";
import { reconcileDuePendingPayments } from "@/lib/payments/order-payments";

export const runtime = "nodejs";

const PAYMENT_RECOVERY_PROCESS_PURPOSE = "storefront_pending_payment_recovery_process_due";

const processDueBodySchema = z.object({
  limit: z.coerce.number().int().min(1).max(25).optional()
});

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = processDueBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          message: "Invalid pending payment recovery request.",
          issues: parsed.error.flatten()
        },
        { status: 400 }
      );
    }

    const providedToken = extractBearerToken(request);
    if (!providedToken) {
      return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
    }

    verifyInternalRequestToken({
      token: providedToken,
      secret: requireInternalRequestSigningSecret("STOREFRONT_INTERNAL_AUTH_TOKEN"),
      issuer: "thesmokehouse-admin",
      audience: "thesmokehouse-storefront",
      purpose: PAYMENT_RECOVERY_PROCESS_PURPOSE,
      method: "POST",
      path: new URL(request.url).pathname
    });

    const stats = await reconcileDuePendingPayments("admin_manual", {
      limit: parsed.data.limit ?? 10
    });

    return NextResponse.json(
      {
        accepted: true,
        stats
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof InternalRequestAuthError) {
      return NextResponse.json({ message: error.message }, { status: 401 });
    }

    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Unable to process pending payment recoveries."
      },
      { status: 500 }
    );
  }
}
