// Die öffentliche Angebotsseite (Lastenheft §2.2, Migration 0586).
//
// WARUM IM RENDERER UND NICHT IM DASHBOARD: Der Gast hat kein Konto. Er
// bekommt einen Link mit Token in der Angebotsmail, und dieser Token ist der
// ganze Zugang. Eine Seite im Dashboard hätte ihn hinter die Anmeldung gestellt.
//
// WAS DIESE DATEI NICHT TUT: rechnen. Betrag, Positionen, Frist und die Frage,
// ob überhaupt noch angenommen werden kann, entscheidet der Server
// (`acceptable`/`blocked_reason`) — die Seite zeigt nur, was er sagt. Eine
// eigene Frist-Logik hier hätte irgendwann eine andere Antwort gegeben als der
// Endpunkt, der die Zahlung freigibt.
import { backendBasis } from "@/lib/backend-basis";

const FETCH_TIMEOUT_MS = 8000;

export type AngebotZeile = {
  label: string;
  amount: number;
  kind?: string | null;
};

/** Spiegelt `PublicOfferOut` (booking_offers/schemas.py). Bewusst OHNE IDs:
 *  der Gast braucht sie nicht, und jede ausgelieferte wäre ein Ansatzpunkt,
 *  fremde Angebote zu erraten. */
export type OeffentlichesAngebot = {
  property_title: string;
  property_city?: string | null;
  check_in: string;
  check_out: string;
  nights: number;
  adults: number;
  children: number;
  pets: number;
  guest_name: string;
  /** Sprache, die der Betrieb beim Anlegen gesetzt hat — die Seite liest sie,
   *  wenn der Gast keine eigene per `?lang=` wünscht. */
  language?: string | null;
  currency: string;
  total_amount: number;
  amount_due_now: number;
  lines: AngebotZeile[];
  expires_at: string;
  status: string;
  acceptable: boolean;
  blocked_reason?: string | null;
  company_name?: string | null;
};

/** Das Angebot zum Token laden. `null` = es gibt keins (404) oder der Link ist
 *  unbrauchbar — beides zeigt die Seite gleich, damit ein Probierer nicht
 *  erfährt, welcher Token existiert. */
export async function ladeAngebot(
  token: string,
): Promise<OeffentlichesAngebot | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(
      `${backendBasis()}/api/v1/public/offers/${encodeURIComponent(token)}`,
      {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: controller.signal,
      },
    );
    if (!res.ok) return null;
    return (await res.json()) as OeffentlichesAngebot;
  } catch {
    // Netzfehler oder Zeitüberschreitung: die Seite zeigt ihren Fehlerzustand.
    // Kein Ersatzangebot erfinden (Wurzel 4).
    return null;
  } finally {
    clearTimeout(timer);
  }
}
