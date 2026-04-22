import { NextResponse } from "next/server";
import { getOrderPaymentSnapshot } from "@/lib/payments/order-payments";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token")?.trim();
  const hint = searchParams.get("hint") === "cancelled" ? "cancelled" : undefined;
  const refresh = searchParams.get("refresh") !== "0";

  if (!token) {
    return NextResponse.json({ message: "Missing token." }, { status: 400 });
  }

  try {
    const order = await getOrderPaymentSnapshot(token, {
      refresh,
      hint
    });

    return NextResponse.json({ ok: true, order });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to fetch payment status." },
      { status: 500 }
    );
  }
}
