"use server";

// Ein Objekt bei ALLEN Portalen aus dem Verkauf nehmen — und zurückholen.
//
// Warum das nicht der bestehende Statuswechsel ist: `properties.status` auf
// `inactive` zu setzen wirkt AUSSCHLIESSLICH bei uns. Der Channel-Manager liest
// die Spalte nirgends, also lief der Verkauf bei Airbnb und Booking.com weiter,
// während die Oberfläche „Inaktiv" zeigte (06.08.2026 live so erlebt: 18
// Objekte standen bei uns inaktiv und verkauften trotzdem).
//
// Und es ist NICHT Stop-Sell: das sperrt TAGE im Kalender. Hier wird das
// Inserat geschaltet — aktiv/inaktiv.
//
// Zwei Portale, zwei Hebel (live an „FeWo *Stjerneskud*" in beide Richtungen
// bewiesen): Airbnb über die Listing-Aktion `publish`/`unpublish` — objekt-genau,
// auch wenn 18 Objekte am selben Kanal hängen; Booking.com über den Kanal selbst,
// weil dort jedes Objekt einen eigenen Kanal hat. Der Server entscheidet das,
// nicht die Oberfläche.
import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";

/** Was an EINEM Portal passiert ist — oder warum nicht. */
export type VerkaufPortalErgebnis = {
  portal_code: string;
  portal: string;
  /**
   * Welcher Hebel benutzt wurde. `mapping_published` = Airbnb (Listing
   * veröffentlicht/zurückgezogen), `channel_active` = Kanal an/aus,
   * `listed_on_marketplace` = myBestDays (läuft nicht über Channex).
   */
  hebel: string | null;
  channel_id: string | null;
  mapping_id: string | null;
  /** Der gesicherte Vorzustand — Grundlage des Rückwegs. */
  war_aktiv: boolean | null;
  ist_aktiv: boolean | null;
  /** Nur beim Kanal-Hebel: wie viele Objekte der Kanal trägt. */
  objekte_am_kanal: number | null;
  abgeschaltet: boolean | null;
  wiederhergestellt: boolean | null;
  /** Kein Fehler, aber es gab nichts zu tun (z. B. „war bereits abgeschaltet"). */
  uebersprungen: string | null;
  fehler: string | null;
};

export type ObjektVerkaufErgebnis = {
  property_id: string;
  status: string | null;
  /**
   * Die ehrliche Gesamtaussage: nur `true`, wenn KEIN Portal fehlgeschlagen
   * ist. Bleibt ein Portal aktiv, bleibt auch der Objekt-Status unverändert —
   * „inaktiv" bei uns, während ein Portal verkauft, ist der Zustand, den dieser
   * Weg verhindert.
   */
  pausiert: boolean;
  portale: VerkaufPortalErgebnis[];
};

export type ObjektVerkaufStand = {
  property_id: string;
  titel: string | null;
  status: string | null;
  portale: Record<string, unknown>[];
};

async function ruf<T>(
  pfad: string,
  method: "GET" | "POST",
): Promise<T | { fehler: string }> {
  const token = await currentToken();
  if (!token) return { fehler: "Nicht angemeldet." };
  try {
    return await api<T>(pfad, { token, method });
  } catch (e) {
    return { fehler: e instanceof ApiError ? e.message : "Unbekannter Fehler" };
  }
}

/**
 * Objekt inaktiv schalten UND den Buchungskalender bei allen Portalen
 * abschalten. Der Vorzustand wird je Portal gesichert, damit das Zurückholen
 * wiederherstellt statt alles anzuschalten.
 */
export async function verkaufPausieren(
  propertyId: string,
): Promise<ObjektVerkaufErgebnis | { fehler: string }> {
  return ruf<ObjektVerkaufErgebnis>(
    `/channel-manager/properties/${propertyId}/verkauf/pausieren`,
    "POST",
  );
}

/**
 * Objekt zurückholen. Stellt nur wieder her, was über diesen Weg abgeschaltet
 * wurde; ein Portal, das schon vorher aus war, bleibt aus.
 */
export async function verkaufFortsetzen(
  propertyId: string,
): Promise<ObjektVerkaufErgebnis | { fehler: string }> {
  return ruf<ObjektVerkaufErgebnis>(
    `/channel-manager/properties/${propertyId}/verkauf/fortsetzen`,
    "POST",
  );
}

/**
 * Live-Ist-Stand bei den Portalen — rein lesend. Der Weg, nach dem Schalten zu
 * prüfen, was bei Channex wirklich steht.
 */
export async function verkaufStandLaden(
  propertyId: string,
): Promise<ObjektVerkaufStand | { fehler: string }> {
  return ruf<ObjektVerkaufStand>(
    `/channel-manager/properties/${propertyId}/verkauf/stand`,
    "GET",
  );
}
