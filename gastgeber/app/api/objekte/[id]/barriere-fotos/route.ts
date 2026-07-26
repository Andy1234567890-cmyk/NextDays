// BFF-Route: Beweisfotos der Barrierefreiheits-Merkmale auflisten.
// Der Bearer darf nie ins Browser-JS (BFF) → server-zu-server durchreichen.
import { readToken } from "@nextdays/auth/server";

import { HOST_COOKIES } from "@/lib/api-server";

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const token = await readToken(HOST_COOKIES.access);
  if (!token) return new Response("Unauthorized", { status: 401 });

  const feature = new URL(req.url).searchParams.get("feature_key");
  const q = feature ? `?feature_key=${encodeURIComponent(feature)}` : "";
  const res = await fetch(
    `${BACKEND}/api/v1/properties/${id}/accessibility-photos${q}`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
  );
  return new Response(res.body, {
    status: res.status,
    headers: {
      "content-type": res.headers.get("content-type") ?? "application/json",
    },
  });
}
