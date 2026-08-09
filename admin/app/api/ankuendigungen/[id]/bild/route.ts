// BFF-Route-Handler für Screenshots in Ankündigungen.
//
// Warum nicht der normale Weg: der geteilte JSON-DAL (lib/api-server →
// packages/auth/src/server.ts) setzt hart `content-type: application/json` und
// kann kein multipart. Eine Server Action scheidet ebenfalls aus — admin/
// hat (anders als web/) kein erhöhtes `bodySizeLimit`, ein 4-MB-Screenshot
// liefe in das 1-MB-Limit. Also: multipart hier annehmen, den Bearer aus dem
// httpOnly-Cookie ziehen (er darf nie ins Browser-JS) und server-zu-server
// durchreichen. Muster: gastgeber/app/api/objekte/[id]/fotos/route.ts.
//
// Die eigentliche Prüfung macht das Backend: Magic-Bytes (PNG/WebP, nicht der
// Client-content_type), Größe, Guard CurrentPlatformAdmin + require_platform_write.
// Diese Route ist bewusst kein zweiter Wahrheitsort dafür.
import { readToken } from "@nextdays/auth/server";

import { ADMIN_COOKIES } from "@/lib/api-server";

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** Ein Bild hochladen (multipart „file"). Antwort: { url }. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const token = await readToken(ADMIN_COOKIES.access);
  if (!token) return new Response("Unauthorized", { status: 401 });

  // FormData einlesen und neu aufbauen (Feldname „file", wie read_upload erwartet).
  const eingang = await req.formData();
  const datei = eingang.get("file");
  if (!(datei instanceof File)) {
    return new Response("Keine Datei", { status: 400 });
  }
  const form = new FormData();
  form.append("file", datei, datei.name);

  const res = await fetch(
    `${BACKEND}/api/v1/platform/announcements/${encodeURIComponent(id)}/bild`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    },
  );
  return new Response(res.body, {
    status: res.status,
    headers: {
      "content-type":
        res.headers.get("content-type") ?? "application/json",
    },
  });
}
