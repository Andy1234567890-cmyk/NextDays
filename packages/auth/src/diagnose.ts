// Serverseitige Diagnose fehlgeschlagener Backend-Aufrufe.
//
// WARUM HIER: Die Apps folgen dem BFF-Muster ohne Proxy-Routen — Server
// Components und Server Actions rufen die FastAPI direkt server-zu-server auf.
// Der Browser sieht diese Aufrufe NIE, der fetch-Interceptor im Browser also
// auch nicht. Ein 422 aus einer Server Action erreicht den Nutzer nur als
// „Fehler 422"; womit er entstand, wusste niemand.
//
// Diese Datei schließt genau diese Lücke: Sie meldet den vollständigen Aufruf
// (gesendeter Inhalt, Antwort des Servers, Request-ID) an denselben
// Diagnose-Endpunkt, den auch der Browser nutzt.
//
// EINWILLIGUNG: 'aufruf' ist eine einwilligungspflichtige Art. Der Server
// verwirft sie ohne aktive Freigabe des Kunden (Wurzel 3) — diese Datei
// braucht die Freigabe also nicht selbst zu prüfen, sie darf sich nur nicht
// darauf verlassen, dass sie erteilt wurde.
//
// BEST-EFFORT: Diagnose darf einen Aufruf nie verzögern oder zum Scheitern
// bringen. Alles hier läuft ohne await im Aufrufpfad und schluckt Fehler.

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// Felder, deren Inhalt NIE erfasst wird — auch nicht bei aktiver Freigabe.
// Diagnosewert null, Schadenspotenzial hoch: Ob ein Login scheitert, sagt der
// Statuscode; das Passwort im Klartext hilft niemandem.
const GEHEIM = [
  "password",
  "passwort",
  "token",
  "secret",
  "apikey",
  "api_key",
  "authorization",
  "cvc",
  "cvv",
  "card_number",
  "cardnumber",
  "iban",
  "pin",
];

// Obergrenze wie im Browser-Reporter (Wurzel 8).
const MAX_ZEICHEN = 16_000;

function ohneGeheimnisse(wert: unknown, tiefe = 0): unknown {
  if (tiefe > 6) return "…";
  if (Array.isArray(wert)) {
    return wert.slice(0, 50).map((v) => ohneGeheimnisse(v, tiefe + 1));
  }
  if (wert && typeof wert === "object") {
    const raus: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(wert as Record<string, unknown>)) {
      const schluessel = k.toLowerCase();
      raus[k] = GEHEIM.some((g) => schluessel.includes(g))
        ? "«entfernt»"
        : ohneGeheimnisse(v, tiefe + 1);
    }
    return raus;
  }
  return wert;
}

function alsInhalt(text: string | undefined): unknown {
  if (!text) return undefined;
  if (text.length > MAX_ZEICHEN) {
    return `«${text.length} Zeichen — nicht erfasst»`;
  }
  try {
    return ohneGeheimnisse(JSON.parse(text));
  } catch {
    return text.slice(0, 2000);
  }
}

/**
 * Einen fehlgeschlagenen Backend-Aufruf melden.
 *
 * Bewusst ohne Rückgabewert und ohne await im Aufrufpfad: Der Nutzer wartet
 * auf seine Antwort, nicht auf die Diagnose.
 */
export function meldeFehlerhaftenAufruf(opts: {
  app: string;
  token: string | null;
  method: string;
  path: string;
  status: number;
  dauerMs: number;
  gesendet?: string;
  antwort?: string;
  requestId?: string | null;
}): void {
  // Ohne Token lässt sich das Ereignis keinem Konto zuordnen — der Server
  // würde es ohnehin ablehnen.
  if (!opts.token) return;

  const events = [
    {
      app: opts.app,
      kind: "aufruf",
      message: `${opts.method.toUpperCase()} → ${opts.status}`.slice(0, 500),
      // Query-String abschneiden: dort stehen Suchbegriffe und IDs.
      path: opts.path.split("?", 1)[0].slice(0, 300),
      http_status: opts.status,
      duration_ms: opts.dauerMs,
      context: {
        request_id: opts.requestId ?? undefined,
        quelle: "server",
        gesendet: alsInhalt(opts.gesendet),
        antwort: alsInhalt(opts.antwort),
      },
    },
  ];

  void fetch(`${BACKEND}/api/v1/diagnostics/events`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ events }),
  }).catch(() => {
    // Diagnose darf nie stören. Kein Retry: ein Backend-Ausfall soll nicht
    // zusätzlich Last erzeugen.
  });
}
