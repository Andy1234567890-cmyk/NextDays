// BFF-Route für technische Diagnose-Ereignisse.
//
// Der Client meldet Fehler und fehlgeschlagene Aufrufe hierher; diese Route
// reicht sie server-zu-server an die FastAPI weiter (der Bearer darf nie ins
// Browser-JS). Fehlschläge werden verschluckt: Diagnose darf den Nutzer nie
// stören.
import { readToken } from "@nextdays/auth/server";

import { COOKIE_NAME } from "./cookie";

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/**
 * Läuft für dieses Konto gerade eine Diagnose-Freigabe?
 *
 * Der Reporter fragt das bei jedem Seitenaufbau, weil die Aufzeichnung sonst
 * nur im Moment des Freigabe-Klicks liefe und jedes Neuladen sie stillschweigend
 * beenden würde. Antwortet immer 200 mit einem Bool — nie ein Fehler, den der
 * Client behandeln müsste.
 */
export async function GET() {
  const token = await readToken(COOKIE_NAME);
  if (!token) return Response.json({ aktiv: false });

  try {
    const res = await fetch(`${BACKEND}/api/v1/diagnostics/debug`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return Response.json({ aktiv: false });
    const sessions = (await res.json()) as { aktiv?: boolean }[];
    return Response.json({
      aktiv: Array.isArray(sessions) && sessions.some((s) => s.aktiv),
    });
  } catch {
    // Fail-closed: im Zweifel nicht aufzeichnen.
    return Response.json({ aktiv: false });
  }
}

export async function POST(req: Request) {
  const token = await readToken(COOKIE_NAME);
  // Ohne Login keine Diagnose — sie ist immer einem Konto zugeordnet.
  if (!token) return new Response(null, { status: 204 });

  try {
    const body = await req.text();
    const res = await fetch(`${BACKEND}/api/v1/diagnostics/events`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body,
    });
    return new Response(null, { status: res.ok ? 204 : 204 });
  } catch {
    // Auch bei Backend-Ausfall: 204, damit der Client nicht erneut sendet.
    return new Response(null, { status: 204 });
  }
}
