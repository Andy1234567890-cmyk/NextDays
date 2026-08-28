// Proxy für die Plattform → FastAPI (Muster wie apps/web/app/api/v1/[...path]/route.ts).
//
// Das Domänen-Modul (lib/inserate.ts) ruft `/api/v1/...` auf dem eigenen Origin.
// Dieser Route-Handler leitet server-seitig an das FastAPI-Backend weiter.
// Die Plattform ist aktuell entkoppelt und (noch) ohne eingeloggte Session;
// sobald Auth/Token nötig ist, wird hier — wie in apps/web — das Supabase-
// Session-Token via currentToken() als Bearer injiziert.
import { type NextRequest, NextResponse } from "next/server";

import { backendBasis } from "@/lib/backend-basis";

async function forward(req: NextRequest, path: string[]): Promise<NextResponse> {
  const search = req.nextUrl.search;
  const target = `${backendBasis()}/api/v1/${path.join("/")}${search}`;

  const headers: Record<string, string> = {};
  const contentType = req.headers.get("content-type");
  if (contentType) headers["Content-Type"] = contentType;
  // TODO Auth: const token = await currentToken();
  //            if (token) headers.Authorization = `Bearer ${token}`;

  const method = req.method.toUpperCase();
  // Der Körper geht als BYTES weiter, nicht als Text (0445).
  //
  // `req.text()` dekodiert den Körper als UTF-8. Bei JSON ist das folgenlos, bei
  // einem `multipart/form-data` mit einer JPEG- oder PDF-Datei darin NICHT:
  // jedes Byte, das keine gültige UTF-8-Sequenz ist, wird zu U+FFFD, und beim
  // Zurückschreiben kommt eine ANDERE Datei heraus. Sie erreichte das Backend
  // sogar — nur wären die Anfangsbytes zerstört, die Magic-Byte-Prüfung
  // schlüge fehl, und der Gast läse „Nur Bilder und PDF sind möglich", obwohl
  // er genau das geschickt hat.
  const body =
    method === "GET" || method === "HEAD"
      ? undefined
      : await req.arrayBuffer();

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
