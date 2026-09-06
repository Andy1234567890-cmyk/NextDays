// Typen des Schloss-Slices (0573).
//
// EIGENE DATEI, weil `schloesser-api.ts` die Direktive `"use server"` trägt und
// dort ausschließlich async functions stehen dürfen. Ein `export type` in einer
// „use server"-Datei legt die Seite beim Deploy-Build mit „A 'use server' file
// can only export async functions" um — und weder `tsc --noEmit` noch ESLint
// sehen das (Projektregel, real passiert).

/** Antwort von /schloesser/pruefen. */
export type SchlossPruefung = {
  ok: boolean;
  /** Nur bei ok: false gesetzt. */
  grund?: string;
  workspaceId?: string | null;
  name?: string | null;
  /** true = Testbereich. Codes von dort öffnen KEINE echten Schlösser. */
  istSandbox?: boolean | null;
};

export type SchlossVerbindung = {
  id: string;
  /** Herstellerkennung, wie Seam sie nennt (`igloohome`, `nuki`, …). */
  provider: string;
  display_name: string | null;
  /** pending | connected | error | disconnected */
  status: string;
  error_code: string | null;
  connected_at: string | null;
};

export type SchlossZuordnung = {
  id: string;
  device_id: string;
  /** Gesetzt = private Tür dieser Einheit. */
  unit_id: string | null;
  /** Gesetzt = Gemeinschaftstür dieses Gebäudes. */
  building_id: string | null;
};

export type SchlossGeraet = {
  id: string;
  seam_device_id: string;
  display_name: string | null;
  /** Ob ein Code an DIESEM Gerät zurückgezogen werden kann.
   *
   *  DREI Zustände, und der dritte ist wichtig: `null` heißt „unbekannt". Die
   *  Oberfläche darf ihn nicht zu `false` verdichten und schon gar nicht zu
   *  `true` — ein Widerruf, den wir nicht belegen können, darf nicht
   *  versprochen werden. */
  can_revoke: boolean | null;
  /** Offline-Codes (igloohome algoPIN, dormakaba Oracode, Lockly) entstehen
   *  algorithmisch und sind nach der Ausgabe nicht mehr änderbar. */
  is_offline_capable: boolean | null;
  /** free | hour | day — wie fein der Hersteller Zeitfenster annimmt. */
  time_granularity: string | null;
  /** Netzzustand. Bei igloohome OHNE Bridge ist `false` der NORMALFALL und
   *  kein Fehler — die Anzeige muss das unterscheiden. */
  online: boolean | null;
  battery_level: number | null;
  capacity_total: number | null;
  capacity_used: number | null;
  last_seen_at: string | null;
  connection_id: string;
  zuordnungen: SchlossZuordnung[];
};

export type SchlossEinstellungen = {
  puffer_vor_min: number;
  puffer_nach_min: number;
  vorlauf_stunden: number;
  aktiv: boolean;
};

export type SchlossZugang = {
  /** false = für diese Buchung gibt es keinen Zugang (Normalfall ohne Schloss). */
  vorhanden?: boolean;
  id?: string;
  code?: string | null;
  /** geplant | angelegt | aktiv | fehlgeschlagen | abgelaufen | widerrufen |
   *  nicht_widerrufbar */
  status?: string;
  /** Klartext zum Zustand. Bei `nicht_widerrufbar` steht hier, bis wann der
   *  Code trotz Storno weiterläuft. */
  status_grund?: string | null;
  grund?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
};

/** Anzeigetext und Farbe je Zustand — EINE Quelle für alle Anzeigestellen.
 *
 *  Bewusst hier und nicht in der Komponente: Zustände tauchen an der
 *  Buchungsansicht, in der Geräteliste und in der Zugangsübersicht auf. Drei
 *  Kopien hießen, dass beim nächsten neuen Zustand zwei davon „unbekannt"
 *  anzeigen. */
export const ZUGANG_ZUSTAND: Record<
  string,
  { text: string; ton: "gut" | "warten" | "warnung" | "aus" }
> = {
  geplant: { text: "Geplant", ton: "warten" },
  angelegt: { text: "Übermittelt", ton: "warten" },
  aktiv: { text: "Aktiv", ton: "gut" },
  fehlgeschlagen: { text: "Fehlgeschlagen", ton: "warnung" },
  abgelaufen: { text: "Abgelaufen", ton: "aus" },
  widerrufen: { text: "Zurückgezogen", ton: "aus" },
  // Der fachlich wichtigste Zustand: der Storno ist passiert, der Code läuft
  // aber weiter. „Zurückgezogen" wäre hier eine Falschaussage.
  nicht_widerrufbar: { text: "Läuft weiter", ton: "warnung" },
};
