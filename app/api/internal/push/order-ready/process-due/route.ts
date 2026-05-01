import { NextResponse } from "next/server";
import { z } from "zod";
import {
  extractBearerToken,
  InternalRequestAuthError,
  requireInternalRequestSigningSecret,
  verifyInternalRequestToken
} from "@/lib/internal-auth";
import { processDueOrderReadyPushes } from "@/lib/push/order-ready";

export const runtime = "nodejs";

const READY_DUE_PROCESS_PURPOSE = "storefront_order_ready_process_due";

const processDueBodySchema = z.object({
  limit: z.coerce.number().int().min(1).max(10).optional()
});

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = processDueBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          message: "Invalid push processing request.",
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
      purpose: READY_DUE_PROCESS_PURPOSE,
      method: "POST",
      path: new URL(request.url).pathname
    });

    const stats = await processDueOrderReadyPushes(parsed.data.limit ?? 10);

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
        message: error instanceof Error ? error.message : "Unable to process queued Ready notifications."
      },
      { status: 500 }
    );
  }
}
