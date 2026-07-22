// Proxy für den Buchhaltungs-Bestand → FastAPI.
//
// Der übernommene Buchhaltungs-Code (api-client) ruft `/api/v1/...` auf dem
// eigenen Origin (localhost:3000) auf. Dieser Route-Handler nimmt den Aufruf
// server-seitig entgegen, liest das httpOnly-Session-Token via currentToken()
// (kann der Browser nicht), injiziert es als Bearer und reicht den Request an
// das FastAPI-Backend weiter. So bleibt der Bestand unverändert und nutzt die
// echte NextDays-Session (FastAPI-Login ODER Supabase-OAuth).
import { type NextRequest, NextResponse } from "next/server";

import { currentToken } from "@/lib/session-token";

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function forward(req: NextRequest, path: string[]): Promise<NextResponse> {
  const token = await currentToken();
  const search = req.nextUrl.search;
  const target = `${BACKEND}/api/v1/${path.join("/")}${search}`;

  const headers: Record<string, string> = {};
  const contentType = req.headers.get("content-type");
  if (contentType) headers["Content-Type"] = contentType;
  if (token) headers.Authorization = `Bearer ${token}`;

  const method = req.method.toUpperCase();
  const body =
    method === "GET" || method === "HEAD" ? undefined : await req.text();

  let res: Response;
  try {
    res = await fetch(target, { method, headers, body, cache: "no-store" });
  } catch {
    return NextResponse.json(
      { detail: "Backend nicht erreichbar." },
      { status: 503 },
    );
  }

  const respContentType = res.headers.get("content-type") ?? "";
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "content-type": respContentType || "application/json" },
  });
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  return forward(req, (await ctx.params).path);
}
export async function POST(req: NextRequest, ctx: Ctx) {
  return forward(req, (await ctx.params).path);
}
export async function PATCH(req: NextRequest, ctx: Ctx) {
  return forward(req, (await ctx.params).path);
}
export async function PUT(req: NextRequest, ctx: Ctx) {
  return forward(req, (await ctx.params).path);
}
export async function DELETE(req: NextRequest, ctx: Ctx) {
  return forward(req, (await ctx.params).path);
}
