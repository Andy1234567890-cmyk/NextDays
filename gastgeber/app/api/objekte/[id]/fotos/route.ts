// BFF-Route-Handler für Objekt-Fotos. Dateien werden vom Browser als multipart
// hochgeladen — der geteilte JSON-DAL (lib/api-server) kann kein multipart, und
// der Bearer darf nie ins Browser-JS (BFF). Daher hier: Host-Cookie-Bearer lesen,
// die multipart-Anfrage server-zu-server an FastAPI durchreichen. Backend prüft
// Magic-Bytes/Größe/Scope (properties.router POST /{id}/photos).
import { readToken } from "@nextdays/auth/server";

import { HOST_COOKIES } from "@/lib/api-server";

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** Fotoliste eines Objekts (durchgereicht). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const token = await readToken(HOST_COOKIES.access);
  if (!token) return new Response("Unauthorized", { status: 401 });

  const res = await fetch(`${BACKEND}/api/v1/properties/${id}/photos`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return new Response(res.body, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
  });
}

/** Ein Foto hochladen (multipart „file"). Der Body wird 1:1 weitergestreamt. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const token = await readToken(HOST_COOKIES.access);
  if (!token) return new Response("Unauthorized", { status: 401 });

  // FormData einlesen und neu aufbauen (Feldname „file", wie read_upload erwartet).
  const eingang = await req.formData();
  const datei = eingang.get("file");
  if (!(datei instanceof File)) {
    return new Response("Keine Datei", { status: 400 });
  }
  const form = new FormData();
  form.append("file", datei, datei.name);

  const res = await fetch(`${BACKEND}/api/v1/properties/${id}/photos`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  return new Response(res.body, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
  });
}
