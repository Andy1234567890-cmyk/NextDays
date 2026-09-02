// OAuth-Rücksprung der Kanalanbindung (0521): `{PARTNER_BASE_URL}/api/auth/
// {youtube|meta|tiktok}/callback?code=…&state=…`.
//
// Der Browser kommt hier mit dem Partner-Cookie an. Wir reichen NUR code +
// state serverseitig an die FastAPI weiter (`POST /affiliates/channels/
// {provider}/connect`); der Code-Tausch und die Token passieren dort — im
// Browser landet nie ein Plattform-Token. Der state ist serverseitig signiert
// und an den eingeloggten Partner gebunden; passt er nicht, antwortet die API
// 400 und der Partner sieht den Grund im Profil.
import { type NextRequest, NextResponse } from "next/server";

import { readToken } from "@nextdays/auth/server";

import { PARTNER_COOKIES } from "@/lib/api-server";

export const dynamic = "force-dynamic";

const PROVIDER = new Set(["youtube", "meta", "tiktok"]);

function zurueck(req: NextRequest, params: Record<string, string>): NextResponse {
  const ziel = req.nextUrl.clone();
  ziel.pathname = "/profil";
  ziel.search = "";
  for (const [k, v] of Object.entries(params)) ziel.searchParams.set(k, v);
  ziel.hash = "kanaele";
  return NextResponse.redirect(ziel, 302);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
): Promise<NextResponse> {
  const { provider } = await params;
  if (!PROVIDER.has(provider)) return zurueck(req, { kanal: "fehler", grund: "anbieter_unbekannt" });

  const sp = req.nextUrl.searchParams;
  // Die Plattform meldet eine Ablehnung des Partners als error=access_denied.
  const fehler = sp.get("error") ?? sp.get("error_code");
  if (fehler) return zurueck(req, { kanal: "abgelehnt", grund: fehler.slice(0, 80) });
  const code = sp.get("code");
  const state = sp.get("state");
  if (!code || !state) return zurueck(req, { kanal: "fehler", grund: "parameter_fehlen" });

  const token = await readToken(PARTNER_COOKIES.access);
  if (!token) {
    const ziel = req.nextUrl.clone();
    ziel.pathname = "/anmelden";
    ziel.search = "";
    ziel.searchParams.set("weiter", "/profil");
    return NextResponse.redirect(ziel, 302);
  }

  const basis = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  try {
    const res = await fetch(`${basis}/api/v1/affiliates/channels/${provider}/connect`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ code, state }),
      cache: "no-store",
    });
    if (res.ok) return zurueck(req, { kanal: "verbunden", anbieter: provider });
    let detail = `http_${res.status}`;
    try {
      const body = (await res.json()) as { detail?: unknown };
      if (typeof body.detail === "string") detail = body.detail;
    } catch {
      // Antwort ohne JSON — der Status reicht als Grund.
    }
    console.warn("[kanal-callback] Verbindung abgelehnt", provider, res.status, detail);
    return zurueck(req, { kanal: "fehler", grund: detail.slice(0, 200) });
  } catch (exc) {
    console.warn("[kanal-callback] API nicht erreichbar", provider, exc);
    return zurueck(req, { kanal: "fehler", grund: "service_unavailable" });
  }
}
