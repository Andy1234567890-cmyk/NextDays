"use server";

// Veröffentlichen je Kanal — welche Portale, was ändert sich dort.
//
// Warum ein eigener Dialog statt eines Statuswechsels: „Aktiv" wirkte bisher
// NUR bei uns. Bei Airbnb standen alle Objekte weiter auf „Unlisted", weil
// `properties.status` im Channel-Manager nirgends gelesen wird. Der Betrieb
// entscheidet jetzt bewusst je Kanal, wo verkauft wird.
import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";

/** Warum ein Kanal nicht wählbar ist. Übersetzt wird über `objects.veroeffentlichen.gruende.*`. */
export type KanalGrund = "nichtVerbunden" | "verbindungInaktiv";

export type Kanal = {
  /** Channex-Portal-Code (`AirBNB`, `BookingCom`) oder `myBestDays`. */
  code: string;
  /** Anzeigename — Eigenname, nicht übersetzt. */
  name: string;
  waehlbar: boolean;
  /**
   * true = immer dabei, nicht abwählbar (myBestDays). Unsere eigene Strecke —
   * ein Objekt, das dort nicht liegt, verkaufen wir nur über fremde Portale
   * gegen deren Provision.
   */
  pflicht: boolean;
  grund: KanalGrund | null;
  /** Nur beim eigenen Marktplatz gesetzt. */
  bereits_gelistet?: boolean;
  letzter_fehler: string | null;
};

export type KanalUebersicht = {
  property_id: string;
  titel: string | null;
  status: string;
  moderation_status: string | null;
  kanaele: Kanal[];
};

/** Eine Abweichung zwischen unserem Stand und dem des Portals. */
export type VorschauFeld = {
  feld: string;
  airbnb_feld: string;
  airbnb: unknown;
  lokal: unknown;
  /** `abweichung` = beide gesetzt, verschieden. `fehlt` = bei uns leer. */
  status: string;
};

export type Vorschau = {
  portal_code: string;
  portal: string;
  /**
   * false = es gibt KEINEN Ist-Abgleich für dieses Portal. Dann sagt `grund`
   * warum — die Oberfläche zeigt den Hinweis statt einer leeren Liste, die wie
   * „alles stimmt überein" aussähe.
   */
  vergleichbar: boolean;
  grund: string | null;
  hinweis?: string | null;
  moderation_status?: string | null;
  bereits_gelistet?: boolean;
  felder: VorschauFeld[];
  fotos?: Record<string, unknown>;
  beschreibung?: Record<string, unknown>;
};

async function hole<T>(pfad: string): Promise<T | { fehler: string }> {
  const token = await currentToken();
  if (!token) return { fehler: "Nicht angemeldet." };
  try {
    return await api<T>(pfad, { token });
  } catch (e) {
    return {
      fehler: e instanceof ApiError ? e.message : "Unbekannter Fehler",
    };
  }
}

/** Schritt 1: Wo kann dieses Objekt veröffentlicht werden? */
export async function kanaeleLaden(
  propertyId: string,
): Promise<KanalUebersicht | { fehler: string }> {
  return hole<KanalUebersicht>(
    `/channel-manager/properties/${propertyId}/veroeffentlichen/kanaele`,
  );
}

/** Schritt 2: Was ändert sich bei DIESEM Portal? Nur lesend. */
export async function vorschauLaden(
  propertyId: string,
  portalCode: string,
): Promise<Vorschau | { fehler: string }> {
  return hole<Vorschau>(
    `/channel-manager/properties/${propertyId}/veroeffentlichen/vorschau/` +
      encodeURIComponent(portalCode),
  );
}
