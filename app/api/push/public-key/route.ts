import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();

  if (!publicKey) {
    return NextResponse.json(
      { message: "Push notifications are not configured yet." },
      { status: 503 }
    );
  }

  return NextResponse.json(
    { publicKey },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0"
      }
    }
  );
}
