// Empfängt die Lodgify-Session (Cookies) von der myNextDays-Browser-Extension
// und legt sie kurzzeitig für den gekoppelten NextDays-User ab, damit der Umzug-
// Tab damit die Objekte importieren kann. KEIN Passwort — nur Session-Cookies.
//
// Node-Runtime (kein Edge): schreibt in den serverseitigen In-Memory-Store.
// Diese spezifische Route hat Vorrang vor der Catch-all /api/v1/[...path].
import { NextResponse } from "next/server";

import { REQUIRED_LODGIFY_COOKIES } from "@/lib/lodgify-import";
import { consumePairing, putSession } from "@/lib/lodgify-session-store";

export const runtime = "nodejs";

// CORS: die Extension läuft auf app.lodgify.com und ruft uns cross-origin.
function cors(res: NextResponse): NextResponse {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return res;
}

export function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }));
}

export async function POST(req: Request) {
  let pairingCode: string;
  let cookies: unknown;
  try {
    const body = await req.json();
    pairingCode = String(body?.pairingCode ?? "");
    cookies = body?.cookies;
  } catch {
    return cors(
      NextResponse.json(
        { success: false, error: "Ungültiger Request-Body." },
        { status: 400 },
      ),
    );
  }

  // Kopplungscode → NextDays-User. Ungültig/abgelaufen → ablehnen (fail-closed).
  const tenantKey = consumePairing(pairingCode);
  if (!tenantKey) {
    return cors(
      NextResponse.json(
        { success: false, error: "Kopplungscode ungültig oder abgelaufen." },
        { status: 401 },
      ),
    );
  }

  if (!Array.isArray(cookies)) {
    return cors(
      NextResponse.json(
        { success: false, error: "Keine Cookies übermittelt." },
        { status: 422 },
      ),
    );
  }
  // Nur die für Lodgify relevanten Cookies behalten (keine Fremd-Cookies lagern).
  const relevant = cookies.filter(
    (c: { name?: string }) =>
      typeof c?.name === "string" &&
      (REQUIRED_LODGIFY_COOKIES.includes(
        c.name as (typeof REQUIRED_LODGIFY_COOKIES)[number],
      ) ||
        c.name.startsWith("LD_") ||
        c.name === "__cf_bm"),
  );
  const have = new Set(relevant.map((c: { name: string }) => c.name));
  const missing = REQUIRED_LODGIFY_COOKIES.filter((n) => !have.has(n));
  if (missing.length > 0) {
    return cors(
      NextResponse.json(
        {
          success: false,
          error:
            "Lodgify-Sitzung unvollständig — bist du in Lodgify eingeloggt? " +
            `Fehlt: ${missing.join(", ")}`,
        },
        { status: 422 },
      ),
    );
  }

  putSession(tenantKey, relevant);
  return cors(NextResponse.json({ success: true }));
}
