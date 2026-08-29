// „Wer bin ich für den Server?" — die Antwort, die es bisher nicht gab.
//
// ANLASS (29.08.2026): Im Onboarding eines frischen Betriebs erschienen die 18
// Objekte eines fremden Betriebs. Vier Erklärungen wurden gebaut und wieder
// verworfen, weil die eine entscheidende Zahl nirgends abzulesen war: WELCHER
// Betrieb steht im Token, das dieser Browser schickt? Die Sitzungs-Cookies sind
// `httpOnly` — JavaScript kommt nicht heran —, sie heißen bei jedem Konto
// gleich (`nd_access`), und keine Oberfläche nannte je den laufenden Betrieb.
// Ein Fehler, dessen Ursache man nicht ABLESEN kann, wird geraten. Diese Route
// beendet das Raten.
//
// Sie liefert DREI Ebenen nebeneinander, und der Vergleich ist der Befund:
//   1. was das Cookie BEHAUPTET (ungeprüft dekodiert),
//   2. was das BACKEND daraus macht (signaturgeprüft, `/auth/me`),
//   3. was der Server auf dieses Token AUSLIEFERT (`/properties`, nur Zahl).
// Weichen 1 und 2 ab, ist das Token nicht das, wofür der Browser es hält.
// Passt 3 nicht zum erwarteten Betrieb, ist die Sitzung fremd.
//
// SICHERHEIT: nur für den EIGENEN Bearer, nichts Fremdes. Ausgeliefert werden
// ausschließlich Angaben, die im Token dieses Browsers ohnehin stehen; das
// Token selbst wird NIE zurückgegeben (es ist bewusst `httpOnly`), nur seine
// Prüfsumme, damit sich zwei Aufrufe vergleichen lassen, ohne das Geheimnis
// preiszugeben. Ohne Cookie kommt 401 — fail-closed (Wurzel 5).
import { createHash } from "node:crypto";

import { sitzungsLage } from "@nextdays/auth/sitzung-lesen";
import { cookies } from "next/headers";

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const ACCESS = "nd_access";
const REFRESH = "nd_refresh";

/** Kurze, nicht umkehrbare Kennung eines Tokens. Zwei Aufrufe mit derselben
 *  Kennung hatten dasselbe Token — das beantwortet „hat die Middleware
 *  zwischendurch erneuert?", ohne das Token herauszugeben. */
function tokenKennung(token: string): string {
  return createHash("sha256").update(token).digest("hex").slice(0, 12);
}

export async function GET() {
  const jar = await cookies();
  const token = jar.get(ACCESS)?.value ?? null;
  const lage = await sitzungsLage({ access: ACCESS, refresh: REFRESH });

  // Kein Access-Cookie: das ist selbst ein Befund und kein Fehler. Genau in
  // diesem Zustand erneuert die Middleware aus dem Refresh-Cookie — der
  // Aufrufer muss das sehen können.
  if (!token) {
    return Response.json(
      {
        zustand: lage.refreshVorhanden
          ? "kein_access_aber_refresh"
          : "abgemeldet",
        hinweis: lage.refreshVorhanden
          ? "Access-Cookie fehlt, Refresh-Cookie liegt vor: die Middleware erneuert bei der nächsten Navigation die Sitzung, die zu DIESEM Refresh-Token gehört — nicht zwingend die, die du erwartest."
          : "Beide Sitzungs-Cookies fehlen.",
        cookie: lage,
      },
      { status: 401 },
    );
  }

  // Ebene 2: das Backend prüft die SIGNATUR und sagt, wen es sieht.
  //
  // `/auth/me` und nicht `/auth/session`: letzteres existiert nicht (404, live
  // gemessen am 29.08.2026). Der Pfad war geraten statt nachgesehen — und ein
  // Diagnose-Werkzeug, das selbst danebengreift, verlängert die Fehlersuche,
  // statt sie zu beenden. Die Route liefert `tenant_id`, `user_id`, `role`.
  let backend: unknown;
  let backendStatus = 0;
  try {
    const res = await fetch(`${BACKEND}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    backendStatus = res.status;
    backend = res.ok ? await res.json() : await res.text();
  } catch (e) {
    backend = `nicht erreichbar: ${e instanceof Error ? e.message : "unbekannt"}`;
  }

  // Ebene 3: was liefert der Server auf dieses Token an Objekten? Nur die
  // ZAHL und die Tenant-IDs — keine Titel, keine Adressen. Die Zahl ist der
  // Fingerabdruck des Betriebs (AirSmil = 18, ein frischer Betrieb = 0).
  let objekte: unknown;
  try {
    const res = await fetch(`${BACKEND}/api/v1/properties`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (res.ok) {
      const d = (await res.json()) as {
        total?: number;
        items?: { tenant_id?: string }[];
      };
      const tenants = [
        ...new Set((d.items ?? []).map((i) => i.tenant_id).filter(Boolean)),
      ];
      objekte = {
        total: d.total ?? null,
        tenantsInDerAntwort: tenants,
        // DER Befund: liefert der Server Objekte eines ANDEREN Betriebs als
        // dem im Token? Das wäre ein echtes Backend-Leck. Am 29.08.2026 war es
        // gemessen NICHT so — die Zahl passte immer zum Token.
        fremdeObjekte: tenants.some((t) => t !== lage.access.tenantId),
      };
    } else {
      objekte = { fehler: res.status };
    }
  } catch {
    objekte = { fehler: "nicht erreichbar" };
  }

  return Response.json({
    zustand: "angemeldet",
    // Ebene 1 — was das Cookie behauptet.
    cookie: {
      ...lage,
      accessKennung: tokenKennung(token),
    },
    // Ebene 2 — was das Backend nach Signaturprüfung sieht.
    backend: { status: backendStatus, antwort: backend },
    // Ebene 3 — was auf dieses Token ausgeliefert wird.
    objekte,
    hinweis:
      "Stimmt `cookie.access.tenantId` nicht mit dem Betrieb überein, in dem du dich wähnst, schickt dieser Browser die Sitzung eines anderen Kontos. Dann hilft: abmelden (löscht beide Cookies) und neu anmelden.",
  });
}
