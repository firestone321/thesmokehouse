import { NextResponse } from "next/server";
import { z } from "zod";
import {
  extractBearerToken,
  InternalRequestAuthError,
  requireInternalRequestSigningSecret,
  verifyInternalRequestToken
} from "@/lib/internal-auth";
import { reconcileDuePendingPayments } from "@/lib/payments/order-payments";
import { readJsonWithLimit, RequestBodyTooLargeError } from "@/lib/request-limits";

export const runtime = "nodejs";

const PAYMENT_RECOVERY_PROCESS_PURPOSE = "storefront_pending_payment_recovery_process_due";

const processDueBodySchema = z.object({
  limit: z.coerce.number().int().min(1).max(25).optional()
});

export async function POST(request: Request) {
  try {
    const body = await readJsonWithLimit(request, 4 * 1024).catch((error) => {
      if (error instanceof RequestBodyTooLargeError) {
        return "payload_too_large";
      }
      return {};
    });
    if (body === "payload_too_large") {
      return NextResponse.json({ message: "Pending payment recovery payload is too large." }, { status: 413 });
    }

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
