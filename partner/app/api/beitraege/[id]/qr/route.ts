// QR-Code eines Beitragslinks als SVG — Durchreiche an die FastAPI mit dem
// Bearer aus dem Partner-Cookie (BFF: der Browser kennt kein Token). Die API
// scopet auf (post_id, affiliate_id); eine fremde ID ist ein 404.
import { type NextRequest, NextResponse } from "next/server";

import { readToken } from "@nextdays/auth/server";

import { PARTNER_COOKIES } from "@/lib/api-server";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const token = await readToken(PARTNER_COOKIES.access);
  if (!token) return new NextResponse(null, { status: 401 });
  const basis = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  const res = await fetch(`${basis}/api/v1/affiliates/posts/${encodeURIComponent(id)}/qr`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return new NextResponse(null, { status: res.status });
  return new NextResponse(await res.text(), {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "private, max-age=3600" },
  });
}
