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
  // BINÄR durchreichen, nicht als Text. `res.text()` dekodiert die Bytes als
  // UTF-8 und ersetzt jede ungültige Sequenz durch U+FFFD — ein PDF, ein Bild
  // oder ein ZIP kommt danach beschädigt beim Browser an, und zwar OHNE
  // Fehlermeldung: Länge und Content-Type stimmen noch, nur der Inhalt ist
  // Müll. Live am 10.09.2026: die PDF-Vorschau der Hausmappe blieb grau, weil
  // aus 8 MB PDF hier 8 MB Ersatzzeichen wurden.
  const rumpf = await res.arrayBuffer();
  // 204/205/304 tragen KEINEN Rumpf. Ihn trotzdem an `new NextResponse` zu
  // geben ist ein Fehler in der Laufzeit ("Response with null body status
  // cannot have body"), und der kommt beim Aufrufer als 500 an — obwohl das
  // Backend erfolgreich war. Jedes DELETE über diesen Weg meldete deshalb
  // einen Serverfehler und hatte trotzdem gelöscht: die Oberfläche zeigte den
  // Fehler, die Zeile war weg (Wurzel 5 — ein Erfolg, der wie ein Fehler
  // aussieht, ist so schlimm wie umgekehrt).
  const ohneRumpf = res.status === 204 || res.status === 205 || res.status === 304;
  // Header, die der Browser für eine Datei braucht, gehen mit — ohne
  // `content-disposition` zeigt Chrome ein `inline`-PDF nicht an.
  //
  // AUSDRÜCKLICH NICHT `content-length`: die Länge gehört der Verbindung, die
  // sie sendet, nicht der, die wir weiterreichen. Next.js baut die Antwort
  // neu auf (und komprimiert sie unter Umständen), die angekündigte Zahl
  // passte dann nicht mehr zu den gesendeten Bytes — der Browser bricht ab
  // und meldet „localhost hat die Verbindung abgelehnt". Genau so sah es am
  // 10.09.2026 aus, während das Backend im Log sauber 200 lieferte. Die
  // Laufzeit setzt die korrekte Länge selbst.
  const durchreichen: Record<string, string> = {
    "content-type": respContentType || "application/json",
  };
  for (const name of [
    "content-disposition",
    "cache-control",
    "x-content-type-options",
  ]) {
    const wert = res.headers.get(name);
    if (wert) durchreichen[name] = wert;
  }
  const antwort = new NextResponse(ohneRumpf ? null : rumpf, {
    status: res.status,
    headers: durchreichen,
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
