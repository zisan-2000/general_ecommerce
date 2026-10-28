import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { pruneTransportEvidence } from "@/lib/payment-control/transport-storage";

export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization") ?? "";
  const expected = secret ? `Bearer ${secret}` : "";
  if (!secret || Buffer.byteLength(supplied) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const deleted = await pruneTransportEvidence();
    return NextResponse.json({ deleted, batchLimit: 1000 }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Transport retention unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
