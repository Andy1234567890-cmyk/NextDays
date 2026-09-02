// Video eines Beitrags hochladen (POST) und die signierte Vorschau-Adresse
// holen (GET) — Durchreiche an die FastAPI mit dem Bearer aus dem
// Partner-Cookie (BFF: der Browser kennt kein Token).
//
// WARUM EINE BFF-ROUTE UND KEINE SERVER ACTION: eine Server Action serialisiert
// ihre Nutzlast über den React-Flight-Kanal. Für ein 200-MB-Video ist das der
// falsche Weg — die Datei liefe zweimal durch den Speicher und Next.js begrenzt
// Action-Nutzlasten ohnehin (Vorgabe 1 MB). Der Strom geht deshalb direkt
// weiter, ohne dass ihn diese Route in den Speicher zieht.
//
// Die API scopet auf (post_id, affiliate_id); eine fremde ID ist ein 404.
import { type NextRequest, NextResponse } from "next/server";

import { readToken } from "@nextdays/auth/server";

import { PARTNER_COOKIES } from "@/lib/api-server";

export const dynamic = "force-dynamic";
// Der Upload darf nicht am Vorgabe-Zeitlimit sterben: ein 200-MB-Video braucht
// auf einer schwachen Leitung länger als die üblichen 30 Sekunden.
export const maxDuration = 300;

function basis(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const token = await readToken(PARTNER_COOKIES.access);
  if (!token) return NextResponse.json({ detail: "unauthorized" }, { status: 401 });

  const daten = await req.formData();
  const datei = daten.get("datei");
  if (!(datei instanceof File)) {
    return NextResponse.json({ detail: "Keine Datei übergeben." }, { status: 422 });
  }
  const weiter = new FormData();
  weiter.append("datei", datei, datei.name);

  const res = await fetch(
    `${basis()}/api/v1/affiliates/posts/${encodeURIComponent(id)}/video`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: weiter,
      cache: "no-store",
    },
  );
  // Fehlermeldungen der API werden 1:1 durchgereicht — sie benennen den echten
  // Grund (falscher Dateityp, zu groß, schon freigegeben) besser als ein hier
  // erfundener Text.
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("content-type") ?? "application/json" },
  });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const token = await readToken(PARTNER_COOKIES.access);
  if (!token) return NextResponse.json({ detail: "unauthorized" }, { status: 401 });
  const res = await fetch(
    `${basis()}/api/v1/affiliates/posts/${encodeURIComponent(id)}/video`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
  );
  return new NextResponse(await res.text(), {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
