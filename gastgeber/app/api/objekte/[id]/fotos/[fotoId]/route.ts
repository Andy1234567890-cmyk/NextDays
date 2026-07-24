// BFF-Route-Handler zum Löschen eines Objekt-Fotos (durchgereicht mit Host-Bearer).
import { readToken } from "@nextdays/auth/server";

import { HOST_COOKIES } from "@/lib/api-server";

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; fotoId: string }> },
) {
  const { id, fotoId } = await params;
  const token = await readToken(HOST_COOKIES.access);
  if (!token) return new Response("Unauthorized", { status: 401 });

  const res = await fetch(
    `${BACKEND}/api/v1/properties/${id}/photos/${fotoId}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
  );
  return new Response(null, { status: res.status });
}
