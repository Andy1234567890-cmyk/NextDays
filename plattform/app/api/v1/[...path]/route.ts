// Proxy für die Plattform → FastAPI (Muster wie apps/web/app/api/v1/[...path]/route.ts).
//
// Das Domänen-Modul (lib/inserate.ts) ruft `/api/v1/...` auf dem eigenen Origin.
// Dieser Route-Handler leitet server-seitig an das FastAPI-Backend weiter.
// Die Plattform ist aktuell entkoppelt und (noch) ohne eingeloggte Session;
// sobald Auth/Token nötig ist, wird hier — wie in apps/web — das Supabase-
// Session-Token via currentToken() als Bearer injiziert.
import { type NextRequest, NextResponse } from "next/server";

import { backendBasis } from "@/lib/backend-basis";
import { currentToken } from "@/lib/session-token";

async function forward(req: NextRequest, path: string[]): Promise<NextResponse> {
  const search = req.nextUrl.search;
  const target = `${backendBasis()}/api/v1/${path.join("/")}${search}`;

  const headers: Record<string, string> = {};
  const contentType = req.headers.get("content-type");
  if (contentType) headers["Content-Type"] = contentType;
  // Auf /plattform ist der Inhaber des nd_access-Cookies der PORTAL-GAST (die
  // Plattform ist die Demand-Seite; Gastgeber sitzen auf apps/web). Sein
  // Access-Token wird hier als Bearer mitgeschickt, damit die gast-gescopeten
  // Endpunkte (guest-auth/me, guest-bookings, guest-stay, guest-messages,
  // guest-wishlist, guest-reviews) greifen. Public Gast-Pfade (booking-engine,
  // guest-auth/login|register|password-reset, öffentliche Objekt-Bewertungen)
  // haben kein Cookie → kein Token, bleiben public. Die zwei Auth-Welten
  // (Portal-Gast hier vs. Gastgeber auf apps/web) bleiben strikt getrennt.
  const token = await currentToken();
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
  // 204/205/304 tragen KEINEN Rumpf. Ihn trotzdem an `new NextResponse` zu
  // geben ist ein Fehler in der Laufzeit ("Response with null body status
  // cannot have body"), und der kommt beim Aufrufer als 500 an — obwohl das
  // Backend erfolgreich war. Jedes DELETE über diesen Weg meldete deshalb
  // einen Serverfehler und hatte trotzdem gelöscht: die Oberfläche zeigte den
  // Fehler, die Zeile war weg (Wurzel 5 — ein Erfolg, der wie ein Fehler
  // aussieht, ist so schlimm wie umgekehrt).
  const ohneRumpf = res.status === 204 || res.status === 205 || res.status === 304;
  return new NextResponse(ohneRumpf ? null : text, {
    status: res.status,
    headers: { "content-type": respContentType || "application/json" },
  });
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  return forward(req, (await params).path);
}
export async function POST(req: NextRequest, { params }: Ctx) {
  return forward(req, (await params).path);
}
export async function PATCH(req: NextRequest, { params }: Ctx) {
  return forward(req, (await params).path);
}
export async function PUT(req: NextRequest, { params }: Ctx) {
  return forward(req, (await params).path);
}
export async function DELETE(req: NextRequest, { params }: Ctx) {
  return forward(req, (await params).path);
}
