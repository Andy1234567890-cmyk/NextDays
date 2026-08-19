// Zugriff auf den Löschantrag (/api/v1/account-deletion).
//
// DIREKT an die FastAPI, nicht über eine Next-Proxy-Route (wie bei Newsletter
// und Support-Chat, siehe lib/config.ts): nur so sieht das IP-Rate-Limit der API
// die IP des Besuchers. Über eine Proxy-Route käme jeder Antrag von der
// Server-IP der Marketing-App — das Dach von 20/60/IP wäre damit wirkungslos,
// und genau dieses Dach hält jemanden davon ab, das Formular als Mailversender
// gegen fremde Postfächer zu benutzen.
//
// Betrieb: die Marketing-Domain muss in CORS_ORIGINS der API stehen.
import { API_BASE } from "@/lib/config";

export type LoeschantragAntwort = { detail: string };
export type BestaetigungAntwort = { detail: string; bestaetigt: boolean };

async function json<T>(res: Response): Promise<T> {
  // Der Detailtext der API ist für Besucher geschrieben (422/429/502) und wird
  // unverändert angezeigt — „irgendetwas ist schiefgelaufen" hilft niemandem.
  if (!res.ok) {
    let detail = "";
    try {
      detail = ((await res.json()) as { detail?: string }).detail ?? "";
    } catch {
      // Kein JSON im Body → Fallback auf den Status.
    }
    throw new Error(detail || `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

/** Löschantrag stellen. Löst NUR eine Bestätigungsmail aus, nichts weiter. */
export async function loeschantragStellen(daten: {
  email: string;
  locale: string;
  grund?: string;
}): Promise<LoeschantragAntwort> {
  const res = await fetch(`${API_BASE}/account-deletion/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: daten.email,
      locale: daten.locale,
      grund: daten.grund?.trim() || null,
    }),
  });
  return json<LoeschantragAntwort>(res);
}

/** Bestätigungslink aus der Mail einlösen. */
export async function loeschantragBestaetigen(
  token: string,
): Promise<BestaetigungAntwort> {
  const res = await fetch(
    `${API_BASE}/account-deletion/confirm?token=${encodeURIComponent(token)}`,
    { method: "POST" },
  );
  return json<BestaetigungAntwort>(res);
}
