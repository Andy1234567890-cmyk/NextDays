// BFF-Route-Handler für das Profilfoto des Gastgebers. Dateien werden vom Browser
// als multipart hochgeladen — der geteilte JSON-DAL (lib/api-server) kann kein
// multipart, und der Bearer darf nie ins Browser-JS (BFF). Daher hier:
// Host-Cookie-Bearer lesen, die multipart-Anfrage server-zu-server an FastAPI
// durchreichen. Backend prüft Magic-Bytes/Größe/Scope
// (host_profiles.router POST /host-profile/avatar).
import { readToken } from "@nextdays/auth/server";

import { HOST_COOKIES } from "@/lib/api-server";

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** Profilfoto hochladen (multipart „file"). Gibt das aktualisierte Profil zurück. */
export async function POST(req: Request) {
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

  const res = await fetch(`${BACKEND}/api/v1/host-profile/avatar`, {
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
