// Proxy für den Buchhaltungs-Bestand → FastAPI.
//
// Der übernommene Buchhaltungs-Code (api-client) ruft `/api/v1/...` auf dem
// eigenen Origin (localhost:3000) auf. Dieser Route-Handler nimmt den Aufruf
// server-seitig entgegen, liest das httpOnly-Session-Token via currentToken()
// (kann der Browser nicht), injiziert es als Bearer und reicht den Request an
// das FastAPI-Backend weiter. So bleibt der Bestand unverändert und nutzt die
// echte NextDays-Session (FastAPI-Login ODER Supabase-OAuth).
import { cookies } from "next/headers";
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
  const antwort = new NextResponse(text, {
    status: res.status,
    headers: { "content-type": respContentType || "application/json" },
  });
  // Hat currentToken() oben die Session erneuert, hat persistSession die neuen
  // Cookies ins Jar geschrieben — Next hängt sie aber nur an eine Response, die
  // es selbst gebaut hat. Bei einer per `new NextResponse(...)` erzeugten
  // Antwort gingen sie verloren: der Server hätte das Refresh-Token rotiert,
  // der Browser behielte das verbrauchte, und der nächste Aufruf endete in
  // „Already Used" → Zwangsabmeldung.
  //
  // Nur die beiden Session-Cookies und nur, wenn sich der Wert gegenüber dem
  // Request geändert hat. Pauschal alle Cookies zu spiegeln würde fremde
  // Cookies ohne ihre Attribute (httpOnly/secure) neu setzen und sie damit
  // schwächen.
  const jar = await cookies();
  for (const name of ["nd_access", "nd_refresh"] as const) {
    const neu = jar.get(name)?.value;
    if (!neu || neu === req.cookies.get(name)?.value) continue;
    antwort.cookies.set(name, neu, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      // nd_access lebt so lang wie das Token, nd_refresh 30 Tage — identisch
      // zu persistSession in @nextdays/auth.
      maxAge: name === "nd_refresh" ? 60 * 60 * 24 * 30 : undefined,
    });
  }
  return antwort;
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
