"use server";

// Dynamic-Pricing-Einstellungen je Objekt — Server-Actions gegen den FastAPI-
// pricing-Slice (/api/v1/pricing/settings/{property_id}). Die Regel-Engine
// berechnet täglich dynamic_prices; bei aktivem DP gewinnen sie vor einem
// manuellen price_override, sonst greift dieser wieder (Resolver-Gate).
import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";

export type LastMinuteRule = { days_before: number; discount_pct: number };

// Manuelle Rate Rule (KI + Fachwissen): Trefferkriterien → Auf-/Abschlag.
export type RateRuleMatch = {
  weekday?: number | number[];
  month?: number | number[];
  min_days_before?: number;
  max_days_before?: number;
};
export type RateRule = { match: RateRuleMatch; adjust_pct: number };

// Basispreis-Modus (Hostaway-Modell).
/** Ein Regel-Vorschlag des KI-Beraters. `belege` sind die Zahlen, aus denen er
 *  entstand — sie stehen in der Oberfläche daneben, damit man ihn prüfen kann
 *  statt ihn glauben zu müssen. `begruendung` kommt von Gemini und kann fehlen
 *  (KI nicht eingerichtet oder Tagesdeckel); der Vorschlag bleibt gültig. */
export type KiVorschlag = {
  feld: string;
  titel: string;
  wert_alt: unknown;
  wert_neu: unknown;
  belege: Record<string, number | string>;
  begruendung: string | null;
  /** Wirkung auf die Preise der nächsten 365 Tage — die eigentliche
   *  Entscheidungsgrundlage. Eine Regel allein („ab 80 % → +10 %") sagt nicht,
   *  wie viele Kronen das sind. `null`, wenn nicht berechenbar. */
  wirkung: {
    tage: number;
    tage_geaendert: number;
    schnitt_vorher: number;
    schnitt_nachher: number;
    max_plus: number;
    max_minus: number;
  } | null;
};

/** Aufschlag für lange Vorausbuchung. Es gilt die WEITESTE erreichte Stufe. */
export type FarFutureRule = {
  days_before: number;
  uplift_pct: number;
};

/** Eine Stufe der Auslastungs-Leiter. Es gilt die HÖCHSTE erreichte Stufe. */
export type OccupancyStep = {
  ab_pct: number;
  adjust_pct: number;
};

// data_driven = Grundpreis des Ratenplans, market = Median der Umgebung je Tag
// (Hostaway „Market-driven base price"), manual = Handwert.
export type BaseMode = "data_driven" | "market" | "manual";
export type BaseRateMode = "conservative" | "recommended" | "aggressive";

export type DpSettings = {
  property_id: string;
  enabled: boolean;
  min_price: number | null;
  max_price: number | null;
  weekend_uplift_pct: number;
  last_minute: LastMinuteRule[];
  orphan_gap_discount_pct: number;
  occupancy_sensitivity: number;
  min_stay_min: number;
  min_stay_max: number;
  // Phase 2: Markt-/Wettbewerbs-Signal (opt-in zusätzlich zu enabled).
  market_enabled: boolean;
  market_sensitivity: number;
  market_max_adjust_pct: number;
  market_key: string | null;
  comp_refs: string[];
  // Hostaway-Modell: Basispreis-Modus + Aggressivität.
  base_mode: BaseMode;
  base_rate_mode: BaseRateMode;
  manual_base_price: number | null;
  // Phase 4 / RateBoard-Bausteine. (autopilot_enabled entfernt: enabled
  // heißt „gilt überall, auch auf den Portalen".)
  weather_enabled: boolean;
  weather_max_adjust_pct: number;
  rate_rules: RateRule[];
  // Auslastungs-Stufenleiter: nicht leer => ersetzt occupancy_sensitivity.
  occupancy_steps: OccupancyStep[];
  // Berechnete Preise warten auf den Freigabe-Knopf, statt sofort zu gehen.
  freigabe_noetig: boolean;
  // Aufschlag für lange Vorausbuchung. Leer = kein Aufschlag.
  far_future: FarFutureRule[];
  // 0562 — Freigabe nur für Tage mit Vorlauf <= X; null = alle Tage.
  freigabe_ab_tagen: number | null;
  // 0562 — Vorjahresanker (hebt an, nie ab), gedeckelt.
  anker_enabled: boolean;
  anker_max_pct: number;
  // 0565 — Saisonpreis des Saisonkalenders als Untergrenze, nie Obergrenze.
  saison_mindestpreis: boolean;
  // Nur lesend: hat das Objekt einen Saisonkalender? Sonst ist die Regel gesperrt.
  saison_verfuegbar: boolean;
  // Nur lesend: Spanne der Saisonpreise im Push-Horizont und betroffene Tage.
  saison_preis_von: number | null;
  saison_preis_bis: number | null;
  saison_tage: number;
  // Der Saison-Mindestpreis heute — der Kalender gilt Tag für Tag.
  saison_preis_heute: number | null;
  // 0562 — DP wirkt nur auf diesen Ratenplan; null = alle.
  rate_plan_id: string | null;
  // 0562 — Feiertage/Schulferien aus dem Feed; 0 = aus. Quellmärkte ISO-2.
  feiertag_uplift_pct: number;
  ferien_uplift_pct: number;
  quellmaerkte: string[];
  // Deckel des Auslastungs-/Pickup-Faktors (bisher nur per DB änderbar).
  occupancy_discount_cap_pct: number;
  occupancy_premium_cap_pct: number;
};

export type DpSettingsInput = Partial<
  Omit<
    DpSettings,
    | "property_id"
    | "saison_verfuegbar"
    | "saison_preis_von"
    | "saison_preis_bis"
    | "saison_tage"
    | "saison_preis_heute"
  >
>;

/** Eine Zeile der Dynamic-Pricing-Objekt-Übersicht (Hostaway-Tabelle). */
export type DpOverviewItem = {
  property_id: string;
  title: string;
  photo: string | null;
  status: "draft" | "active" | "inactive";
  currency: string | null;
  enabled: boolean;
  base_mode: BaseMode;
  base_rate_mode: BaseRateMode;
  base_rate: number | null;
  min_price: number | null;
  max_price: number | null;
  // 0565 — Regel „Mindestpreis aus dem Saisonkalender" an: min_price gilt nur
  // ohne Saison, die Saisontage liegen in dieser Spanne.
  saison_mindestpreis: boolean;
  saison_preis_von: number | null;
  saison_preis_bis: number | null;
  saison_preis_heute: number | null;
  freigabe_noetig: boolean;
  offene_tage: number;
  // Verteilkanäle, auf denen das Objekt live ist: "platform" + OTA-Portal-Codes.
  channels: string[];
};

type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

async function call<T>(
  path: string,
  opts: { method?: "GET" | "PUT" | "POST" | "DELETE"; body?: unknown } = {},
): Promise<Result<T>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  try {
    const data = await api<T>(path, { ...opts, token });
    return { ok: true, data };
  } catch (exc) {
    return {
      ok: false,
      error: exc instanceof ApiError ? exc.message : "Aktion fehlgeschlagen.",
      status: exc instanceof ApiError ? exc.status : undefined,
    };
  }
}

/** Alle Objekte des Kontos mit ihrem Dynamic-Pricing-Status (Hostaway-Tabelle).
 *  `module_active` sagt, ob das kostenpflichtige Modul „Dynamische Preise"
 *  gebucht ist — die Fläche selbst gibt darüber Auskunft, damit die UI dafür
 *  nicht den Abo-Endpunkt (MANAGE_BILLING) braucht. */
export async function getDpOverview(): Promise<
  Result<{ items: DpOverviewItem[]; module_active: boolean }>
> {
  return call(`/pricing/overview`);
}

/** Dynamic-Pricing-Einstellungen eines Objekts (Defaults, falls noch leer). */
export async function getDpSettings(
  propertyId: string,
): Promise<Result<DpSettings>> {
  return call(`/pricing/settings/${encodeURIComponent(propertyId)}`);
}

/** KI-Klartext-Begründung für den dynamischen Preis eines Tages (on-demand). */
export async function explainDpPrice(
  propertyId: string,
  day: string,
): Promise<Result<{ property_id: string; date: string; price: number; explanation: string }>> {
  return call(
    `/pricing/explain/${encodeURIComponent(propertyId)}?day=${encodeURIComponent(day)}`,
  );
}

/** Regel-Vorschläge des KI-Beraters — EINSTELLUNGEN, keine Preise.
 *  Eine leere Liste ist gültig; `hinweis` sagt dann, warum. */
/** Was EINE Regel-Prüfung ergeben hat — auch wenn sie nichts vorschlägt. */
export type KiPruefung = {
  name: string;
  titel: string;
  ergebnis: "vorschlag" | "passt" | "zu_wenig_daten" | "ruht" | "aus";
  grund: string;
  belege: Record<string, number | string>;
};

export async function getKiVorschlaege(
  propertyId: string,
): Promise<
  Result<{
    property_id: string;
    vorschlaege: KiVorschlag[];
    hinweis: string | null;
    pruefungen: KiPruefung[];
  }>
> {
  return call(
    `/pricing/settings/${encodeURIComponent(propertyId)}/ki-vorschlaege`,
  );
}

/** Einen Vorschlag übernehmen. Der Server nimmt den WERT aus seiner eigenen,
 *  frisch gerechneten Empfehlung — der Client schickt nur, welches Feld. */
export async function kiVorschlagAnnehmen(
  propertyId: string,
  feld: string,
): Promise<Result<DpSettings>> {
  return call(
    `/pricing/settings/${encodeURIComponent(propertyId)}/ki-vorschlaege/annehmen`,
    { method: "POST", body: { feld } },
  );
}

/** Einen Vorschlag ablehnen — er ruht, bis sich die Zahl deutlich ändert. */
export async function kiVorschlagAblehnen(
  propertyId: string,
  feld: string,
): Promise<Result<null>> {
  return call(
    `/pricing/settings/${encodeURIComponent(propertyId)}/ki-vorschlaege/ablehnen`,
    { method: "POST", body: { feld } },
  );
}

/** Dynamic-Pricing-Einstellungen setzen (Upsert; bei enabled sofortiger Recompute). */
export async function saveDpSettings(
  propertyId: string,
  input: DpSettingsInput,
): Promise<Result<DpSettings>> {
  return call(`/pricing/settings/${encodeURIComponent(propertyId)}`, {
    method: "PUT",
    body: input,
  });
}

/** Preis-Modus eines Tages. „dynamisch" ist der Standard (kein Eintrag). */
export type Tagesmodus = "dynamisch" | "anpassung" | "manuell";

export type TagesmodusEintrag = {
  date: string;
  modus: Tagesmodus;
  adjust_pct: number | null;
};

export type FreigabeStand = {
  property_id: string;
  freigabe_noetig: boolean;
  /** Ungestempelte Tage im Sende-Fenster. Mit Freigabepflicht: warten auf
   *  den Klick. Ohne: die Automatik ist dran (`sendet`). */
  offen: number;
  /** Sofort-Modus mit offenen Tagen: der Server hat den Lauf eingereiht. */
  sendet: boolean;
};

/** Modus für einen Datumsbereich setzen (Start und Ende einschliesslich). */
export async function setTagesmodus(
  propertyId: string,
  input: {
    von: string;
    bis: string;
    modus: Tagesmodus;
    adjust_pct?: number | null;
    preis?: number | null;
  },
): Promise<Result<{ property_id: string; tage: number; modus: string }>> {
  return call(`/pricing/tagesmodus/${encodeURIComponent(propertyId)}`, {
    method: "PUT",
    body: input,
  });
}

export async function getTagesmodi(
  propertyId: string,
  von: string,
  bis: string,
): Promise<Result<TagesmodusEintrag[]>> {
  const q = new URLSearchParams({ von, bis }).toString();
  return call(`/pricing/tagesmodus/${encodeURIComponent(propertyId)}?${q}`);
}

export async function getFreigabeStand(
  propertyId: string,
): Promise<Result<FreigabeStand>> {
  return call(`/pricing/freigabe/${encodeURIComponent(propertyId)}`);
}

export async function freigabeErteilen(
  propertyId: string,
): Promise<Result<FreigabeStand>> {
  return call(`/pricing/freigabe/${encodeURIComponent(propertyId)}`, {
    method: "POST",
  });
}

/** Durchschnittlicher Tagespreis je Aggressivitäts-Stufe (null = kein Basispreis). */
export type StufenVorschau = {
  property_id: string;
  conservative: number | null;
  recommended: number | null;
  aggressive: number | null;
};

export async function getStufenVorschau(
  propertyId: string,
): Promise<Result<StufenVorschau>> {
  return call(`/pricing/stufen-vorschau/${encodeURIComponent(propertyId)}`);
}

/** Ein Tag der Marktkurve: Median der Umgebung, ohne Fremdnamen. */
export type MarktPunkt = {
  tag: string;
  markt_median: number;
  p25: number | null;
  p75: number | null;
  anzahl: number;
  /** Eigener berechneter Preis am selben Tag — fuer den Abstand. */
  eigener_preis: number | null;
};

/** Ein beobachteter Angebotspreis der Region — ein Punkt auf der Karte.
 *  Kein Name, keine ID, kein Link; der Ort ist auf ~100 m gerundet. */
export type MarktAngebot = {
  /** Aufenthaltstag, fuer den dieser Preis gilt. */
  tag: string;
  lat: number;
  lng: number;
  preis: number;
};

/** Preisniveau der Umgebung: Kennzahlen + Kurve fuer die Karte. */
export type MarktStand = {
  property_id: string;
  vergleichsobjekte: number;
  mindestens_noetig: number;
  radius_km: number;
  markt_median: number | null;
  waehrung: string | null;
  /** Wann WIR zuletzt abgerufen haben — nicht, wann der Markt sich aenderte. */
  stand_vom: string | null;
  quelle: string | null;
  /** Standort des eigenen Objekts fuer die Karte. */
  lat: number | null;
  lng: number | null;
  verlauf: MarktPunkt[];
  /** Alle Angebotspreise je Stichtag (je Tag gedeckelt, Server). */
  angebote: MarktAngebot[];
  hinweis: string | null;
};

export async function getMarktStand(
  propertyId: string,
): Promise<Result<MarktStand>> {
  return call(`/pricing/markt-stand/${encodeURIComponent(propertyId)}`);
}


// --- 0562: Preisgrenzen, Portalstand, Vorschau, Forecast, Verlauf ---------------

/** Mindest-/Höchstpreis für einen Zeitraum (SiteMinder „Floor and ceiling override"). */
export type Preisgrenze = {
  id: string;
  property_id: string;
  bezeichnung: string;
  von: string;
  bis: string;
  /** 0 = Montag … 6 = Sonntag; null = alle Tage. */
  wochentage: number[] | null;
  jaehrlich: boolean;
  min_price: number | null;
  max_price: number | null;
};

export type PreisgrenzeInput = Omit<Preisgrenze, "id" | "property_id">;

export async function listPreisgrenzen(
  propertyId: string,
): Promise<Result<Preisgrenze[]>> {
  return call(`/pricing/preisgrenzen/${encodeURIComponent(propertyId)}`);
}

export async function createPreisgrenze(
  propertyId: string,
  input: PreisgrenzeInput,
): Promise<Result<Preisgrenze>> {
  return call(`/pricing/preisgrenzen/${encodeURIComponent(propertyId)}`, {
    method: "POST",
    body: input,
  });
}

export async function deletePreisgrenze(
  propertyId: string,
  grenzeId: string,
): Promise<Result<null>> {
  return call(
    `/pricing/preisgrenzen/${encodeURIComponent(propertyId)}/${encodeURIComponent(grenzeId)}`,
    { method: "DELETE" },
  );
}

/** Soll/Ist eines Tages: berechnet vs. laut Schatten bei den Portalen. */
export type PortalstandTag = {
  date: string;
  berechnet: number | null;
  portal: number | null;
  abweichung_pct: number | null;
  /** Greift eine Aktion, ist `berechnet` bereits gesenkt — um so viel Prozent. */
  aktion_pct?: number | null;
};

export type Portalstand = {
  property_id: string;
  waehrung: string | null;
  rate_plan_id: string | null;
  tage: PortalstandTag[];
  abweichend: number;
  /** Wann UNSER Schatten zuletzt fortgeschrieben wurde. */
  schatten_stand: string | null;
  hinweis: string | null;
};

export async function getPortalstand(
  propertyId: string,
  von: string,
  bis: string,
): Promise<Result<Portalstand>> {
  const q = new URLSearchParams({ von, bis }).toString();
  return call(`/pricing/portalstand/${encodeURIComponent(propertyId)}?${q}`);
}

export async function portalstandAngleichen(
  propertyId: string,
): Promise<Result<{ status: string }>> {
  return call(`/pricing/portalstand/${encodeURIComponent(propertyId)}/angleichen`, {
    method: "POST",
  });
}

/** Ein Tag der Kurve, wie sie MIT Automatik wäre — nichts wird gespeichert. */
export type VorschauTag = {
  date: string;
  price: number;
  factors: Record<string, number>;
};

export async function getVorschau(
  propertyId: string,
  von: string,
  bis: string,
): Promise<Result<VorschauTag[]>> {
  const q = new URLSearchParams({ von, bis }).toString();
  return call(`/pricing/vorschau/${encodeURIComponent(propertyId)}?${q}`);
}

export type ForecastTag = {
  date: string;
  belegt: boolean;
  /** Gelernte Erwartung 0..1; null = keine gelernte Zelle. */
  erwartet: number | null;
  /** Freie Angebote der Umgebung; null = kein Stichtag in der Nähe. */
  markt_angebote: number | null;
};

export type Forecast = {
  property_id: string;
  horizont_tage: number;
  tage: ForecastTag[];
  belegt_pct: number;
  erwartet_pct: number | null;
  pace: "vor" | "im_plan" | "hinter" | null;
  hinweis: string | null;
};

export async function getForecast(propertyId: string): Promise<Result<Forecast>> {
  return call(`/pricing/forecast/${encodeURIComponent(propertyId)}`);
}

export type VerlaufEintrag = {
  id: string;
  von: string;
  bis: string;
  ereignis:
    | "tagesmodus"
    | "freigabe"
    | "gesendet"
    | "einstellungen"
    | "preisgrenze"
    | "automatik_an"
    | "automatik_aus";
  details: Record<string, unknown>;
  /** null = Automatik (Cron/Worker). */
  user_id: string | null;
  user_name: string | null;
  created_at: string;
};

export async function getVerlauf(
  propertyId: string,
  tag?: string,
): Promise<Result<VerlaufEintrag[]>> {
  const q = tag ? `?${new URLSearchParams({ tag }).toString()}` : "";
  return call(`/pricing/verlauf/${encodeURIComponent(propertyId)}${q}`);
}

/** Ein Stichtag des Preisberichts (Seite „Preise & Markt"). */
export type PreisberichtPunkt = {
  tag: string;
  markt_median: number;
  p25: number | null;
  p75: number | null;
  anzahl: number;
  eigener_preis: number | null;
  grundpreis: number | null;
  abstand_pct: number | null;
};

export type Preisbericht = {
  property_id: string;
  waehrung: string | null;
  stand_vom: string | null;
  radius_km: number;
  hinweis: string | null;
  verlauf: PreisberichtPunkt[];
  abstand_schnitt_pct: number | null;
  stichtage_unter_markt: number;
  stichtage_am_markt: number;
  stichtage_ueber_markt: number;
  grundpreis: number | null;
  horizont_tage: number;
  tage_mit_preis: number;
  preis_schnitt: number | null;
  preis_min: number | null;
  preis_max: number | null;
  uplift_pct: number | null;
  ki_angenommen: number;
  ki_abgelehnt: number;
  ki_angenommen_90: number;
  ki_abgelehnt_90: number;
};

/** Die Auswertung des Dynamic Pricing für ein Objekt. */
export async function getPreisbericht(propertyId: string): Promise<Result<Preisbericht>> {
  return call(`/pricing/preisbericht/${encodeURIComponent(propertyId)}`);
}

