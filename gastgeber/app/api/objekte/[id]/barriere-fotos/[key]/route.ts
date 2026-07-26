// BFF-Route: Beweisfoto hochladen (POST, multipart) bzw. löschen (DELETE).
// Der dynamische Segmentname [key] trägt beim POST den Merkmal-Slug und beim
// DELETE die Foto-ID — beides wird nur durchgereicht; der Server prüft Scope,
// Magic-Bytes, Größe und die Obergrenze je Merkmal.
import { readToken } from "@nextdays/auth/server";

import { HOST_COOKIES } from "@/lib/api-server";

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; key: string }> },
) {
  const { id, key } = await params;
  const token = await readToken(HOST_COOKIES.access);
  if (!token) return new Response("Unauthorized", { status: 401 });

  const eingang = await req.formData();
  const datei = eingang.get("file");
  if (!(datei instanceof File)) {
    return new Response("Keine Datei", { status: 400 });
  }
  const form = new FormData();
  form.append("file", datei, datei.name);

  const res = await fetch(
    `${BACKEND}/api/v1/properties/${id}/accessibility-photos/${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    },
  );
  return new Response(res.body, {
    status: res.status,
    headers: {
      "content-type": res.headers.get("content-type") ?? "application/json",
    },
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; key: string }> },
) {
  const { id, key } = await params;
  const token = await readToken(HOST_COOKIES.access);
  if (!token) return new Response("Unauthorized", { status: 401 });

  const res = await fetch(
    `${BACKEND}/api/v1/properties/${id}/accessibility-photos/${key}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
  );
  return new Response(null, { status: res.status });
}
