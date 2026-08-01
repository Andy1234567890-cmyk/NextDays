// Zugriff auf die Voranmeldung (/api/v1/newsletter).
//
// Wie beim Support-Chat geht der Aufruf DIREKT an die FastAPI, nicht über eine
// Next-Proxy-Route (siehe lib/config.ts): nur so sieht das IP-Rate-Limit der
// API die IP des Besuchers — und genau diese IP ist zugleich der
// Einwilligungs-Nachweis, den die DSGVO verlangt. Über eine Proxy-Route käme
// jede Anmeldung von der Server-IP der Marketing-App.
//
// Betrieb: die Marketing-Domain muss in CORS_ORIGINS der API stehen.
import { API_BASE } from "@/lib/config";

export type NewsletterAntwort = { ok: boolean; detail: string };

async function json(res: Response): Promise<NewsletterAntwort> {
  // Der Detailtext der API ist für Besucher geschrieben (422/429/502) und wird
  // unverändert angezeigt — „irgendetwas ist schiefgelaufen" hilft niemandem.
  if (!res.ok) {
    let detail = "";
    try {
      detail = ((await res.json()) as { detail?: string }).detail ?? "";
    } catch {
      // Kein JSON im Body (z. B. 502 vom Proxy) → Fallback auf den Status.
    }
    throw new Error(detail || `HTTP ${res.status}`);
  }
  return (await res.json()) as NewsletterAntwort;
}

/** Adresse eintragen; die Bestätigungsmail löst die API aus. */
export async function voranmelden(daten: {
  email: string;
  locale: string;
  source: string;
  consentText: string;
}): Promise<NewsletterAntwort> {
  const res = await fetch(`${API_BASE}/newsletter/subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: daten.email,
      locale: daten.locale,
      source: daten.source,
      // Der angezeigte Einwilligungstext wandert mit — er ist der Nachweis,
      // dem zugestimmt wurde (DSGVO Art. 7 Abs. 1).
      consent_text: daten.consentText,
    }),
  });
  return json(res);
}

/** Bestätigungslink einlösen (Double-Opt-in abschließen). */
export async function bestaetigen(token: string): Promise<NewsletterAntwort> {
  const res = await fetch(
    `${API_BASE}/newsletter/confirm?token=${encodeURIComponent(token)}`,
    { method: "POST" },
  );
  return json(res);
}

/** Abmeldelink einlösen. */
export async function abmelden(token: string): Promise<NewsletterAntwort> {
  const res = await fetch(
    `${API_BASE}/newsletter/unsubscribe?token=${encodeURIComponent(token)}`,
    { method: "POST" },
  );
  return json(res);
}
