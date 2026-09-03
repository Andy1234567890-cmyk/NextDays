"use server";

// Kalender: Server-Actions gegen den FastAPI-calendar-Slice
// (/api/v1/calendar). Liefert die Verfügbarkeit pro Objekt + Zeitraum und
// erlaubt Sperren. Business-Logik (Double-Booking-Schutz) liegt im Backend.
import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";

export type AvailabilityStatus = "open" | "booked" | "blocked";
// Spiegelt apps/api/.../calendar/schemas.py:AvailabilitySource — jeder neue
// Backend-Wert MUSS hier, in CHANNEL_META und in calendar.channel.* aller
// Locales landen (scripts/i18n/kanal-enums-pruefen.mjs erzwingt das).
export type AvailabilitySource =
  | "direct"
  // Eigene Website des Betriebs (0380) — provisionsfreier Direktumsatz,
  // getrennt von „direct" (Telefon/E-Mail/vor Ort).
  | "website"
  | "portal"
  | "booking"
  | "airbnb"
  | "vrbo"
  // Sammelkanal für OTAs ohne eigenen Wert (Expedia, Agoda, Namensvarianten).
  | "ota_other"
  | "manual"
  // Sperre aus einem abonnierten Fremdkalender (iCal-Import) — kein
  // Vertriebskanal, nur eine Herkunft der Sperre.
  | "ical"
  // Sperre, weil der Vermarktungsvertrag zu diesem Objekt endet (0355) — auch
  // kein Vertriebskanal. Eigener Wert, damit „Sperre aufheben" im Kalender sie
  // NICHT anfassen kann: sonst wäre ein Objekt ohne Vertrag wieder verkäuflich.
  | "contract_end";

export type DayAvailability = {
  date: string; // YYYY-MM-DD
  status: AvailabilityStatus;
  source: AvailabilitySource;
  price: number | null; // Tagespreis (Override > dynamic > weekday > base); null ohne Rate-Plan
  // Herkunft des Preises: override | dynamic | weekday | base | none.
  price_source?: string;
  // Faktor-Aufschlüsselung bei dynamischem Preis ({faktor: multiplikator}) für
  // den „Warum dieser Preis?"-Tooltip. Nur bei price_source=dynamic gesetzt.
  price_factors?: Record<string, number> | null;
  min_stay: number | null; // Mindestaufenthalt aus dem Rate-Plan
  // CTA/CTD-Restriktionen je Tag (Default false ohne availability-Zeile).
  closed_to_arrival?: boolean;
  closed_to_departure?: boolean;
};

type Result<T> =
  | { ok: true; data: T }
  // `status` traegt den HTTP-Code weiter: die Sperrantrags-Seite unterscheidet
  // damit „darfst du nicht" (403 → notFound) von „ging schief" (Fehlerkasten).
  // Ohne ihn saehe ein Nutzer ohne APPROVE_BLOCK einen roten Kasten statt
  // einer Seite, die es fuer ihn schlicht nicht gibt.
  /** Kennung der Fehlerantwort. Bei einem 500 sendet der Server nur
   *  „internal_error"; unter dieser ID liegen Exception-Typ und Codezeile
   *  (`GET /diagnostics/ursache/<id>`). Ohne sie waere der Fehler in der
   *  Oberflaeche nicht auffindbar. */
  | { ok: false; error: string; status?: number; requestId?: string };

async function call<T>(
  path: string,
  opts: { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown } = {},
): Promise<Result<T>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  try {
    const data = await api<T>(path, { ...opts, token });
    return { ok: true, data };
  } catch (exc) {
    const error =
      exc instanceof ApiError ? exc.message : "Aktion fehlgeschlagen.";
    return {
      ok: false,
      error,
      status: exc instanceof ApiError ? exc.status : undefined,
      requestId: exc instanceof ApiError ? exc.requestId : undefined,
    };
  }
}

/** Verfügbarkeit eines Objekts im Zeitraum [start, end). Daten als YYYY-MM-DD. */
export async function getAvailability(
  propertyId: string,
  start: string,
  end: string,
): Promise<Result<DayAvailability[]>> {
  const qs = new URLSearchParams({ property_id: propertyId, start, end });
  return call(`/calendar/availability?${qs.toString()}`);
}

// Ein Objekt im Batch-Board: Tagesdaten + Stop-Sells in einem Rutsch.
export type BoardProperty = {
  property_id: string;
  // Objekt-Währung (aus dem Rate-Plan) für die Tagespreis-Anzeige.
  currency: string | null;
  days: DayAvailability[];
  stop_sell: StopSellDay[];
};

/** Batch-Kalender: Verfügbarkeit + Preise + Min-Stay + Stop-Sell für ALLE
 *  Objekte im Zeitraum [start, end) in EINEM Call. Ersetzt die früheren
 *  2 Einzel-Calls je Objekt (N+1) — der Board-Endpunkt lädt serverseitig mit
 *  wenigen gebündelten Queries. Leere propertyIds → leeres Ergebnis. */
export async function getBoard(
  propertyIds: string[],
  start: string,
  end: string,
): Promise<Result<{ items: BoardProperty[] }>> {
  if (propertyIds.length === 0) return { ok: true, data: { items: [] } };
  const qs = new URLSearchParams({ start, end });
  for (const id of propertyIds) qs.append("property_ids", id);
  return call(`/calendar/board?${qs.toString()}`);
}

/** Zeitraum sperren (manuell). end ist exklusiv. */
export async function blockRange(
  propertyId: string,
  start: string,
  end: string,
): Promise<Result<{ blocked_days: number }>> {
  return call("/calendar/block", {
    method: "POST",
    body: { property_id: propertyId, range: { start, end } },
  });
}

/** Manuelle Sperre im Zeitraum aufheben (gibt frei gewordene Tage an Channex
 *  zurück, gebuchte Tage bleiben unberührt). end ist exklusiv. */
export async function unblockRange(
  propertyId: string,
  start: string,
  end: string,
): Promise<Result<{ unblocked_days: number }>> {
  return call("/calendar/unblock", {
    method: "POST",
    body: { property_id: propertyId, range: { start, end } },
  });
}

export type StopSellSource = "manual" | "channex";

export type StopSellScope = "all" | "channels";

export type StopSellDay = {
  id: string;
  property_id: string;
  date: string; // YYYY-MM-DD
  reason: string | null;
  source: StopSellSource;
  // Kanal-Dimension (Migration 0145): all = alle Kanäle (Default), channels =
  // nur die in channels[] genannten (platform/reception/ota:<code>/ota:*).
  scope?: StopSellScope;
  channels?: string[];
  // Reisebüro/Veranstalter, an den sich der Stopp richtet (null = alle Kanäle).
  agency_id?: string | null;
  // Name des Reisebüros (Backend-Join) — fürs Balken-Label im Kalender.
  agency_name?: string | null;
  // Hotel (0152): Stopp gilt NUR für diesen Rate-Plan; null = Objekt-Ebene
  // (Ferienwohnung/Altdaten), gilt für alle Pläne.
  rate_plan_id?: string | null;
};

/** Stop-Sell-Tage eines Objekts im Zeitraum [start, end). */
export async function listStopSell(
  propertyId: string,
  start: string,
  end: string,
): Promise<Result<{ items: StopSellDay[]; total: number }>> {
  const qs = new URLSearchParams({ property_id: propertyId, start, end });
  return call(`/calendar/stop-sell?${qs.toString()}`);
}

/** Stop-Sell für einen Zeitraum setzen (manuell). end exklusiv.
 *  weekdays (ISO: 0=Montag … 6=Sonntag) beschränkt optional auf Wochentage
 *  im Zeitraum (z. B. nur Wochenenden); wird auch an Channex durchgereicht. */
export async function setStopSell(
  propertyId: string,
  start: string,
  end: string,
  reason?: string,
  weekdays?: number[],
  agencyId?: string,
  // skipped_booked: gebuchte Tage im Zeitraum werden nie gestoppt (der Tag ist
  // bereits verkauft) und hier gemeldet, damit die UI die Überschneidung zeigt.
): Promise<Result<{ stopped_days: number; skipped_booked: number }>> {
  return call("/calendar/stop-sell", {
    method: "POST",
    body: {
      property_id: propertyId,
      range: { start, end },
      reason: reason ?? null,
      weekdays: weekdays ?? null,
      agency_id: agencyId ?? null,
    },
  });
}

/** Stop-Sell aufheben. end exklusiv. Standard: nur manuelle Stops (Portal-Stops
 *  bleiben). includePortal=true hebt AUCH Portal-/Channex-Stops auf und öffnet die
 *  Tage an den OTAs — für versehentlich gesetzte Stops. */
export async function clearStopSell(
  propertyId: string,
  start: string,
  end: string,
  weekdays?: number[],
  includePortal?: boolean,
  includeRatePlans?: boolean,
): Promise<Result<{ status: string; cleared_days?: number }>> {
  return call("/calendar/stop-sell/clear", {
    method: "POST",
    body: {
      property_id: propertyId,
      range: { start, end },
      weekdays: weekdays ?? null,
      include_portal: includePortal ?? false,
      include_rate_plans: includeRatePlans ?? false,
    },
  });
}

/** ALLE Stop-Sells (auch Portal) zurücksetzen. propertyId weglassen = alle
 *  Objekte des Tenants. Öffnet die Tage auch an den OTAs. */
export async function resetStopSell(
  propertyId?: string,
): Promise<Result<{ properties: number; days: number }>> {
  return call("/calendar/stop-sell/reset", {
    method: "POST",
    body: { property_id: propertyId ?? null },
  });
}

export type BulkEditInput = {
  property_ids: string[];
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD (exklusiv)
  price?: number;
  price_adjust_pct?: number; // prozentual (z. B. +10 / -15); schließt price aus
  min_stay?: number;
  max_stay?: number; // Maximalaufenthalt (0 = keine Obergrenze)
  block?: boolean;
  stop_sell?: boolean;
  closed_to_arrival?: boolean;
  closed_to_departure?: boolean;
};

export type BulkEditResult = {
  properties: number;
  days: number;
  applied: string[];
};

/** Bulk-Edit: Preis/Min-Stay/Sperre/Stop-Sell über mehrere Objekte ×
 *  Zeitraum in einem Rutsch (Hostaway-Stil). Nur gesetzte Felder wirken. */
export async function bulkEdit(
  input: BulkEditInput,
): Promise<Result<BulkEditResult>> {
  const { property_ids, start, end, ...rest } = input;
  return call("/calendar/bulk-edit", {
    method: "POST",
    body: { property_ids, range: { start, end }, ...rest },
  });
}

export type SeasonPriceDay = { date: string; price: number };

/** Saison-/Tagespreise eines Objekts im Zeitraum [start, end). */
export async function listSeasonPrices(
  propertyId: string,
  start: string,
  end: string,
): Promise<Result<{ items: SeasonPriceDay[]; total: number }>> {
  const qs = new URLSearchParams({ property_id: propertyId, start, end });
  return call(`/calendar/season-price?${qs.toString()}`);
}

/** Tagespreis für einen Zeitraum setzen (Saisonpreis). end exklusiv.
 *  Schreibt price_overrides und pusht den Preis an Channex. */
export async function setSeasonPrice(
  propertyId: string,
  start: string,
  end: string,
  price: number,
): Promise<Result<{ days: number }>> {
  return call("/calendar/season-price", {
    method: "POST",
    body: { property_id: propertyId, range: { start, end }, price },
  });
}

// -- Benannte Saisons (Jahres-Kalender, Drag&Drop) --------------------------
export type SeasonMode = "percent" | "fixed";

export type SeasonAssignment = {
  id: string;
  season_id: string;
  start_date: string; // YYYY-MM-DD (inklusiv)
  end_date: string; // YYYY-MM-DD (inklusiv)
};

export type Season = {
  id: string;
  property_id: string;
  name: string;
  color: string; // #RRGGBB
  mode: SeasonMode;
  amount: number; // percent: ±% auf Basispreis; fixed: Nachtpreis
  assignments: SeasonAssignment[];
};

/** Alle benannten Saisons eines Objekts inkl. Zeitraum-Zuweisungen. */
export async function listSeasons(
  propertyId: string,
): Promise<Result<{ items: Season[]; total: number }>> {
  return call(`/calendar/seasons?property_id=${encodeURIComponent(propertyId)}`);
}

/** Neue benannte Saison anlegen (Name, Farbe, Modus, Betrag). */
export async function createSeason(input: {
  property_id: string;
  name: string;
  color: string;
  mode: SeasonMode;
  amount: number;
}): Promise<Result<Season>> {
  return call("/calendar/seasons", { method: "POST", body: input });
}

/** Saison-Stammdaten ändern (rematerialisiert alle Zeiträume). */
export async function updateSeason(
  seasonId: string,
  patch: Partial<Pick<Season, "name" | "color" | "mode" | "amount">>,
): Promise<Result<Season>> {
  return call(`/calendar/seasons/${seasonId}`, { method: "PATCH", body: patch });
}

/** Saison löschen (zugewiesene Tage fallen auf den Basispreis zurück). */
export async function deleteSeason(
  seasonId: string,
): Promise<Result<{ deleted: boolean }>> {
  return call(`/calendar/seasons/${seasonId}`, { method: "DELETE" });
}

/** Einen Zeitraum einer Saison zuweisen. end exklusiv. */
export async function assignSeason(input: {
  property_id: string;
  season_id: string;
  start: string;
  end: string;
}): Promise<Result<{ days: number }>> {
  const { property_id, season_id, start, end } = input;
  return call("/calendar/seasons/assign", {
    method: "POST",
    body: { property_id, season_id, range: { start, end } },
  });
}

/** Einen Tagesbereich aus allen Saisons lösen (überlappende Zuweisungen werden
 * gekürzt/gesplittet, die Tage fallen auf den Basispreis zurück). end exklusiv. */
export async function clearSeasonRange(input: {
  property_id: string;
  start: string;
  end: string;
}): Promise<Result<{ days: number }>> {
  const { property_id, start, end } = input;
  return call("/calendar/seasons/clear", {
    method: "POST",
    body: { property_id, range: { start, end } },
  });
}

/** Ein Ziel, das der Server NICHT übernehmen konnte (z. B. kein Rate-Plan-
 *  Basispreis, gegen den ein Prozentsatz rechnen könnte). Wird in der UI samt
 *  Grund benannt statt still weggelassen. */
export type SeasonApplySkip = { property_id: string; grund: string };

/** Eine Prozent-Saison samt Zeiträumen auf weitere eigene Objekte KOPIEREN.
 *  Kopie, keine Anbindung: spätere Änderungen an der Quelle ziehen nicht nach.
 *  Fixbetrag-Saisons lehnt der Server ab (422) — sie sind objektspezifisch. */
export async function applySeasonToProperties(
  seasonId: string,
  propertyIds: string[],
  mitZeitraeumen: boolean,
): Promise<Result<{ uebertragen: number; uebersprungen: SeasonApplySkip[] }>> {
  return call(`/calendar/seasons/${seasonId}/apply`, {
    method: "POST",
    body: { property_ids: propertyIds, mit_zeitraeumen: mitZeitraeumen },
  });
}

/** Eine Zeitraum-Zuweisung entfernen (Tage fallen auf Basispreis zurück). */
export async function unassignSeason(
  assignmentId: string,
): Promise<Result<{ removed: boolean }>> {
  return call(`/calendar/seasons/assign/${assignmentId}`, { method: "DELETE" });
}

// -- Mehrere Restriktions-Zeilen in EINEM Call (Zertifizierung Test 3-8) -----
export type RestrictionRow = {
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD (exklusiv)
  // Hotel: Zeile gilt nur für diesen Preisplan (Twin/BAR ≠ Double/B&B am selben
  // Tag). Weglassen = Objekt-Ebene (Ferienwohnung) → alle Pläne.
  rate_plan_id?: string;
  price?: number;
  min_stay?: number;
  max_stay?: number;
  closed_to_arrival?: boolean;
  closed_to_departure?: boolean;
  stop_sell?: boolean;
  // Grund für den lokalen stop_sell-Spiegel (geht nicht an die Portale).
  reason?: string;
};

/** Mehrere heterogene Restriktions-Zeilen (verschiedene Preise/min_stay/max_stay/
 *  CTA/CTD/stop_sell je Zeitraum) eines Objekts in EINEM Channex-Call setzen. */
export async function bulkRestrictions(
  propertyId: string,
  rows: RestrictionRow[],
): Promise<Result<{ rows: number }>> {
  return call("/calendar/bulk-restrictions", {
    method: "POST",
    body: {
      property_id: propertyId,
      rows: rows.map(({ start, end, ...rest }) => ({
        range: { start, end },
        ...rest,
      })),
    },
  });
}

export type MultiRestrictionRow = RestrictionRow & {
  // Zimmer, zu dem die Zeile gehört — Hotel: Zeilen über MEHRERE Zimmer werden
  // als EIN Portale-Call gesendet (die Zimmer teilen sich eine Channex-Property).
  property_id: string;
};

/** Zimmer-übergreifende Restriktions-Zeilen (Hotel) in EINEM Portale-Call. */
export async function bulkRestrictionsMulti(
  rows: MultiRestrictionRow[],
): Promise<Result<{ rows: number }>> {
  return call("/calendar/bulk-restrictions-multi", {
    method: "POST",
    body: {
      rows: rows.map(({ start, end, ...rest }) => ({
        range: { start, end },
        ...rest,
      })),
    },
  });
}

// --- Sperr-Anträge der Eigentümer (Agentur entscheidet, 0332) ---------------
// Der Eigentümer STELLT den Antrag im Portal (lib/portal.ts); ENTSCHIEDEN wird
// er hier, von der Agentur. Ohne diese vier Aufrufe hatte der Workflow gar
// keinen Aufrufer: das Backend war vollständig (calendar/router.py:462–506),
// aber kein Frontend rief es je — jeder Antrag blieb für immer `pending`, und
// die Benachrichtigung `block_decision` konnte nie feuern.

export type Sperrantrag = {
  id: string;
  property_id: string;
  property_title: string | null;
  /** Die beantragte Einheit (0353). null = der ganze Einheiten-TYP. Die
   *  Agentur MUSS das sehen: „Studio 3 vom 1.–5." ist eine andere
   *  Entscheidung als „alle fünf Studios vom 1.–5.". */
  unit_id: string | null;
  unit_name: string | null;
  requested_by: string | null;
  /** Name des Antragstellers. Bewusst OHNE E-Mail/Telefon — die
   *  Entscheidungsliste braucht sie nicht (Wurzel 9). */
  requested_by_name: string | null;
  /** INKLUSIV, so wie der Eigentümer den Antrag gestellt hat („vom 1. bis
   *  zum 5."). Die Umrechnung auf den exklusiven Kalender-Range macht der
   *  Server, nicht die Oberfläche. */
  start_date: string;
  end_date: string;
  status: string; // pending | approved | rejected
  reason: string | null;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
  created_at: string | null;
  /** Der EIGENTÜMER hat beim Stellen erklärt, den Vertrag beenden zu wollen. */
  ist_kuendigung: boolean;
  /** Die AGENTUR hat den Antrag beim Genehmigen als Kündigung gewertet — für
   *  Bestandsanträge ohne das Feld. Getrennt von `ist_kuendigung`, damit
   *  hinterher nicht dasteht „der Eigentümer hat gekündigt", wo ausgelegt
   *  wurde. */
  als_kuendigung_gewertet: boolean;
  /** Das Vertragsende, das diese Genehmigung gesetzt hat. */
  vertragsende_gesetzt_auf: string | null;
  /** Was der Eigentuemer zu dieser Sperre BESTELLT hat (0510). Leer = es
   *  entsteht keine Aufgabe. Bis 0510 entstand die volle Regelkette wie bei
   *  einer Gastbuchung, ohne dass jemand sie beauftragt hatte - die Genehmigung
   *  entscheidet also nicht nur ueber die Sperre, sondern ueber Arbeit. */
  bestellte_leistungen: SperrantragLeistung[];
  /** Aufhebungswunsch des Eigentuemers (0513): „keine" | „beantragt" |
   *  „aufgehoben" | „abgelehnt". Solange „beantragt" steht, ist die Sperrung
   *  WEITER aktiv — der Wunsch allein gibt nichts frei. */
  aufhebung: string;
  /** Warum der Eigentuemer die Sperrung nicht mehr braucht. */
  aufhebung_grund: string | null;
  /** Wann er sie beantragt hat — die Sortiergroesse der Warteschlange. */
  aufhebung_beantragt_am: string | null;
  /** Begruendung der Agentur, wenn sie die Aufhebung abgelehnt hat. */
  aufhebung_entscheidungsnotiz: string | null;
};

/** Eine bestellte Leistung samt Namen ihrer Regel (0510) und dem Zustand
 *  ihrer Genehmigung (0538): „angefragt" | „genehmigt" | „abgelehnt". Nur
 *  Genehmigtes wird zur Aufgabe. */
export type SperrantragLeistung = {
  rule_id: string;
  name: string;
  status: string;
  entscheidungsnotiz: string | null;
};

/** Die Entscheidung der Agentur ueber EINE bestellte Leistung (0538). */
export type LeistungEntscheidung = {
  rule_id: string;
  genehmigt: boolean;
  notiz: string | null;
};

/** Anträge des Mandanten. Ohne `status` alle, `pending` ist die Warteschlange. */
/** Die drei Bestaende der Eigentuemer-Vorgaenge fuer die Startseite. */
export type EigentuemerVorgaenge = {
  /** Antraege, die auf die Entscheidung der Agentur warten. */
  offen: number;
  /** Aufhebungswuensche zu schon genehmigten Sperren — der umgekehrte
   *  Handgriff: hier gibt die Agentur Naechte WIEDER FREI. */
  aufhebung_offen: number;
  /** Angekuendigte Vertragsenden aus genehmigten Kuendigungs-Antraegen (0377). */
  kuendigungen: number;
  /** Der aelteste offene Antrag; null, wenn nichts offen ist. */
  aeltester_offen_am: string | null;
};

/** Zaehlt, ohne die ganze Liste samt Titeln und Leistungen zu laden. */
export async function getEigentuemerVorgaenge(): Promise<Result<EigentuemerVorgaenge>> {
  return call("/calendar/block-requests/vorgaenge");
}

export async function listBlockRequests(
  status?: string,
): Promise<Result<{ items: Sperrantrag[]; total: number }>> {
  const p = status ? `?status=${encodeURIComponent(status)}` : "";
  return call(`/calendar/block-requests${p}`);
}

/** Eine Buchung/Eigennutzung, die dem beantragten Zeitraum im Weg steht. */
export type SperrantragKollision = {
  reservation_id: string;
  /** buchung = storniert werden (Gast, Geld, OTA-Meldung); eigennutzung =
   *  gehört demselben Eigentümer, wird eher über den Widerruf ihres eigenen
   *  Antrags aufgelöst. Zwei verschiedene Auflösungswege. */
  art: string;
  bezeichnung: string;
  unit_id: string | null;
  unit_name: string | null;
  check_in: string;
  check_out: string; // exklusiv (Abreisetag ist wieder frei)
  status: string;
  channel: string;
  ota_name: string | null;
  total_amount: number | null;
  /** Währung DIESER Buchung. null → symbollos rendern (formatCurrency), nie
   *  ein €-Ersatz (Wurzel 4). */
  currency: string | null;
  is_owner_stay: boolean;
  owner_id: string | null;
};

/** Eine gesperrte Nacht OHNE Buchung dahinter (Handwerker/Agentur/iCal) —
 *  wird im Kalender aufgehoben, nicht storniert. */
export type SperrantragSperrtag = {
  datum: string;
  unit_id: string | null;
  unit_name: string | null;
  source: string;
};

/** Was der Genehmigung im Weg steht. `blockiert` sperrt den Genehmigen-Knopf.
 *
 *  Die `*_gesamt`-Zahlen sind VOLLSTÄNDIG, die Listen können gekürzt sein
 *  (`gekuerzt`) — ein Jahresantrag über ein Hotel hätte sonst einen Payload,
 *  den niemand liest. */
export type SperrantragKollisionen = {
  property_id: string;
  /** Wurde als VERTRAGSKÜNDIGUNG geprüft? Dann ist eine bestehende
   *  `contract_end`-Sperre der Zielzustand und kein Hindernis. */
  als_kuendigung: boolean;
  unit_id: string | null;
  unit_name: string | null;
  start_date: string;
  end_date: string; // INKLUSIV, wie der Antrag gestellt wurde
  naechte: number;
  einheiten_gesamt: number;
  blockiert: boolean;
  grund: string | null; // belegt | stop_sell
  freie_einheit_id: string | null;
  freie_einheit_name: string | null;
  min_freie_einheiten: number;
  buchungen: SperrantragKollision[];
  buchungen_gesamt: number;
  sperrtage: SperrantragSperrtag[];
  sperrtage_gesamt: number;
  stop_sell_tage: string[];
  stop_sell_gesamt: number;
  gekuerzt: boolean;
  /** Längster durchgehend freier Abschnitt im beantragten Zeitraum — ein
   *  Vorschlag, keine automatische Kürzung. */
  frei_von: string | null;
  frei_bis: string | null;
};

/** Prüfen, was der Genehmigung im Weg steht — VOR dem Klick.
 *
 *  Nur lesend. Ohne diesen Aufruf endete ein belegter Zeitraum in einem
 *  nackten 409, der nicht sagte, WELCHE Buchung im Weg steht — bei einem
 *  Jahresantrag genau die Information, die fehlt. */
export async function blockRequestKollisionen(
  id: string,
  // KEIN Default-Wert (`= false`) in der Signatur: dieses Modul ist
  // `"use server"`, die Funktion wird also über die Netzwerkgrenze aufgerufen.
  // Argumente werden dabei serialisiert, und ein weggelassenes Argument mit
  // Default kam am Server nicht als `false` an — der Aufruf schlug fehl, BEVOR
  // er das Backend erreichte: der Dialog hing ewig auf „wird geprüft" und im
  // API-Log stand kein einziger Request (live 12.08.2026). Der Aufrufer
  // übergibt den Wert immer.
  alsKuendigung: boolean,
): Promise<Result<SperrantragKollisionen>> {
  // `als_kuendigung` ändert die FRAGE, nicht nur den Text: eine Kündigung
  // belegt keine Nächte, also ist ein bestehendes Vertragsende dort der
  // Zielzustand statt ein Hindernis.
  const p = alsKuendigung ? "?als_kuendigung=true" : "";
  return call(`/calendar/block-requests/${id}/kollisionen${p}`);
}

/** Genehmigen — sperrt die Nächte im Kalender und meldet es an die Portale.
 *  409, wenn der Zeitraum gebuchte Tage enthält oder schon entschieden wurde. */
export async function approveBlockRequest(
  id: string,
  note: string | null,
  /** Die Agentur wertet den Antrag als Vertragskündigung — dann wird nicht
   *  gesperrt, sondern `properties.contract_end_date` gesetzt. Für
   *  Bestandsanträge, deren Eigentümer die Absicht nur im Freitext erklärt
   *  hat, ohne ihn erneut zu fragen.
   *
   *  `null` = normale Sperrung. Bewusst PFLICHT und nicht optional (`?`):
   *  Server-Action-Argumente gehen über die Netzwerkgrenze, und ein
   *  weggelassenes Argument ist dort nicht verlässlich `undefined` — siehe
   *  `blockRequestKollisionen`. Der Aufrufer übergibt immer beides. */
  kuendigung: { vertragsende: string | null } | null,
  /** Entscheidung JE bestellter Leistung (0538). Hat der Antrag Bestellungen,
   *  verlangt der Server fuer jede eine — sonst 422. Eine fehlende als
   *  „genehmigt" zu werten waere die blinde Mitgenehmigung, die 0538
   *  abstellt. Ebenfalls PFLICHT-Argument (siehe `kuendigung`). */
  leistungen: LeistungEntscheidung[],
): Promise<Result<Sperrantrag>> {
  return call(`/calendar/block-requests/${id}/approve`, {
    method: "POST",
    body: {
      note,
      als_kuendigung: kuendigung !== null,
      // Leer → der Server nimmt den Antragsbeginn („ab da nicht mehr
      // vermieten" = „ab da kein Vertrag"). Nichts wird hier geraten.
      vertragsende: kuendigung?.vertragsende ?? null,
      leistungen,
    },
  });
}

/** Ablehnen — kein Kalender-Effekt; die Notiz geht an den Eigentümer. */
export async function rejectBlockRequest(
  id: string,
  note: string | null,
): Promise<Result<Sperrantrag>> {
  return call(`/calendar/block-requests/${id}/reject`, {
    method: "POST",
    body: { note },
  });
}

/** Eine erteilte Genehmigung widerrufen — gibt genau die Nächte DIESES
 *  Antrags wieder frei (0337). Nur aus 'approved'. */
export async function revokeBlockRequest(
  id: string,
  note: string | null,
): Promise<Result<Sperrantrag>> {
  return call(`/calendar/block-requests/${id}/revoke`, {
    method: "POST",
    body: { note },
  });
}

/** Den Aufhebungswunsch des Eigentuemers ablehnen (0513) — die Sperrung BLEIBT.
 *
 *  Das Gegenstueck ist `revokeBlockRequest`: dort wird aufgehoben, und ein
 *  offener Wunsch gilt damit als erfuellt. Hier passiert im Kalender nichts;
 *  abgelehnt wird nur der Wunsch. Die Notiz geht an den Eigentuemer — ohne sie
 *  wirkt die Ablehnung wie Willkuer. */
export async function rejectBlockLift(
  id: string,
  note: string | null,
): Promise<Result<Sperrantrag>> {
  return call(`/calendar/block-requests/${id}/aufhebung-ablehnen`, {
    method: "POST",
    body: { note },
  });
}
