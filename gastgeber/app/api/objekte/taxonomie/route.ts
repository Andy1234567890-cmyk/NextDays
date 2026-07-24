// BFF-Route-Handler für die Objekt-Taxonomie (Kategorien + Immobilientypen). Der
// Objekttyp-Editor ist eine Client-Komponente und braucht die Liste im Browser;
// der Host-Cookie-Bearer darf nie ins Browser-JS → hier server-zu-server an
// FastAPI (properties.router GET /properties/taxonomy) durchreichen.
import { readToken } from "@nextdays/auth/server";

import { HOST_COOKIES } from "@/lib/api-server";

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function GET() {
  const token = await readToken(HOST_COOKIES.access);
  if (!token) return new Response("Unauthorized", { status: 401 });

  const res = await fetch(`${BACKEND}/api/v1/properties/taxonomy`, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 3600 },
  });
  return new Response(res.body, {
    status: res.status,
    headers: {
      "content-type": res.headers.get("content-type") ?? "application/json",
    },
  });
}
