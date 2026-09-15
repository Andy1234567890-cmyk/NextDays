// BFF-Route-Handler für den Datei-Upload des Werbematerials (0707).
//
// Warum nicht der normale Weg: der geteilte JSON-DAL (lib/api-server →
// packages/auth/src/server.ts) setzt hart `content-type: application/json` und
// kann kein multipart. Eine Server Action scheidet ebenfalls aus — admin/ hat
// (anders als web/) kein erhöhtes `bodySizeLimit`, ein 8-MB-Banner liefe in das
// 1-MB-Limit. Also: multipart hier annehmen, den Bearer aus dem httpOnly-Cookie
// ziehen (er darf nie ins Browser-JS) und server-zu-server durchreichen.
// Muster: app/api/ankuendigungen/[id]/bild/route.ts.
//
// Die eigentliche Prüfung macht das Backend: Magic-Bytes statt Client-
// content_type, SVG-Säuberung, Größendeckel je Art, Guard CurrentPlatformAdmin
// + require_platform_write. Diese Route ist bewusst kein zweiter Wahrheitsort
// dafür — sie reicht nur durch und packt die Fehlermeldung nicht aus.
import { readToken } from "@nextdays/auth/server";

import { ADMIN_COOKIES } from "@/lib/api-server";

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** Textfelder, die neben der Datei mitgehen. Alles andere wird verworfen —
 *  ein Client soll nicht `kind` oder `url` setzen können, beide entstehen
 *  serverseitig aus der Datei. */
const FELDER = [
  "title",
  "description",
  "language",
  "sort",
  "active",
  "folder_id",
] as const;

/**
 * Datei hochladen (multipart „file"). Ohne `assetId` entsteht ein neuer
 * Eintrag, mit `assetId` wird die Datei eines vorhandenen ersetzt.
 */
export async function POST(req: Request) {
  const token = await readToken(ADMIN_COOKIES.access);
  if (!token) return new Response("Unauthorized", { status: 401 });

  const eingang = await req.formData();
  const datei = eingang.get("file");
  if (!(datei instanceof File)) {
    return new Response("Keine Datei", { status: 400 });
  }

  const form = new FormData();
  form.append("file", datei, datei.name);
  for (const feld of FELDER) {
    const wert = eingang.get(feld);
    if (typeof wert === "string") form.append(feld, wert);
  }

  const assetId = eingang.get("assetId");
  const pfad =
    typeof assetId === "string" && assetId
      ? `/api/v1/platform/affiliates/assets/${encodeURIComponent(assetId)}/datei`
      : "/api/v1/platform/affiliates/assets/upload";

  const res = await fetch(`${BACKEND}${pfad}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  return new Response(res.body, {
    status: res.status,
    headers: {
      "content-type": res.headers.get("content-type") ?? "application/json",
    },
  });
}
