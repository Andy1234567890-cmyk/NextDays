"use server";

// Personal & Dienstplan: Server-Actions gegen den FastAPI-Slice
// (/api/v1/personal). Business-Logik bleibt im Backend; hier nur die Aufrufe.
// Typen und Helfer liegen in `personal-typen.ts` (ohne "use server").
import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";
import type {
  Abwesenheit,
  AbwesenheitArt,
  AbwesenheitListe,
  Akte,
  AkteUpdate,
  Arbeitsbereich,
  Arbeitszeitkonto,
  Auswertung,
  Dokument,
  Fremdfirma,
  Gespraech,
  GespraechInput,
  KarteiBereich,
  Konflikt,
  Krankenstand,
  Massnahme,
  MassnahmeInput,
  MitarbeiterListe,
  Monatsabschluss,
  Nachweis,
  NachweisInput,
  Pausenmodell,
  PersonUebersicht,
  PlanPerson,
  Qualifikation,
  RegelVorschlag,
  Regeln,
  RegelnSet,
  Result,
  Schicht,
  SchichtCreate,
  SchichtUpdate,
  Schichtvorlage,
  Schulung,
  SchulungInput,
  Urlaubskonto,
  Urlaubssperre,
  Verfuegbarkeit,
  VerfuegbarkeitArt,
  Vertrag,
  VertragInput,
  Vorfall,
  VorfallInput,
  Wochenplan,
  ZeitListe,
  Zeiterfassung,
} from "@/lib/personal-typen";

async function call<T>(
  path: string,
  opts: { method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"; body?: unknown } = {},
): Promise<Result<T>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  try {
    const data = await api<T>(path, { ...opts, token });
    return { ok: true, data };
  } catch (exc) {
    if (exc instanceof ApiError) {
      return { ok: false, error: exc.message, status: exc.status, details: exc.details };
    }
    return { ok: false, error: "Aktion fehlgeschlagen." };
  }
}

const q = (params: Record<string, string | number | boolean | null | undefined>) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") s.set(k, String(v));
  }
  const str = s.toString();
  return str ? `?${str}` : "";
};

// --- Mitarbeitende & Akte ------------------------------------------------

export async function listMitarbeiter(): Promise<Result<MitarbeiterListe>> {
  return call("/personal/mitarbeiter");
}

export async function getUebersicht(userId: string): Promise<Result<PersonUebersicht>> {
  return call(`/personal/mitarbeiter/${encodeURIComponent(userId)}/uebersicht`);
}

export async function getAkte(userId: string): Promise<Result<Akte>> {
  return call(`/personal/mitarbeiter/${encodeURIComponent(userId)}/akte`);
}

export async function saveAkte(userId: string, body: AkteUpdate): Promise<Result<Akte>> {
  return call(`/personal/mitarbeiter/${encodeURIComponent(userId)}/akte`, { method: "PUT", body });
}

export async function listQualifikationen(userId: string): Promise<Result<Qualifikation[]>> {
  return call(`/personal/mitarbeiter/${encodeURIComponent(userId)}/qualifikationen`);
}

export async function setQualifikationen(
  userId: string,
  eintraege: { arbeitsbereich_id: string; property_id?: string | null; stufe?: string }[],
): Promise<Result<Qualifikation[]>> {
  return call(`/personal/mitarbeiter/${encodeURIComponent(userId)}/qualifikationen`, {
    method: "PUT",
    body: eintraege,
  });
}

export async function listDokumente(userId: string): Promise<Result<Dokument[]>> {
  return call(`/personal/mitarbeiter/${encodeURIComponent(userId)}/dokumente`);
}

export async function dokumentAnfragen(
  userId: string,
  body: {
    art: string;
    titel: string;
    ablauf_am?: string | null;
    notiz?: string | null;
    dokument_nummer?: string | null;
    ausgestellt_am?: string | null;
    behoerde?: string | null;
  },
): Promise<Result<Dokument>> {
  return call(`/personal/mitarbeiter/${encodeURIComponent(userId)}/dokumente/anfragen`, {
    method: "POST",
    body,
  });
}

export async function dokumentAendern(
  dokumentId: string,
  body: {
    titel?: string;
    ablauf_am?: string | null;
    notiz?: string | null;
    geprueft?: boolean;
    dokument_nummer?: string | null;
    ausgestellt_am?: string | null;
    behoerde?: string | null;
  },
): Promise<Result<Dokument>> {
  return call(`/personal/dokumente/${encodeURIComponent(dokumentId)}`, { method: "PATCH", body });
}

export async function dokumentLoeschen(dokumentId: string): Promise<Result<void>> {
  return call(`/personal/dokumente/${encodeURIComponent(dokumentId)}`, { method: "DELETE" });
}

/** Upload-Ziel für das Formular (Multipart geht nicht über `api()`). */
export async function dokumentUploadZiel(
  userId: string,
  params: { art: string; titel?: string; ablauf_am?: string; dokument_id?: string },
): Promise<Result<{ url: string; token: string }>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  const { apiBasis } = await import("@/lib/api");
  return {
    ok: true,
    data: {
      url: `${apiBasis()}/personal/mitarbeiter/${encodeURIComponent(userId)}/dokumente${q(params)}`,
      token,
    },
  };
}

// --- Stammdaten ----------------------------------------------------------

export async function listFremdfirmen(): Promise<Result<Fremdfirma[]>> {
  return call("/personal/fremdfirmen");
}

export async function createFremdfirma(body: Partial<Fremdfirma>): Promise<Result<Fremdfirma>> {
  return call("/personal/fremdfirmen", { method: "POST", body });
}

export async function updateFremdfirma(
  id: string,
  body: Partial<Fremdfirma> & { archiviert?: boolean },
): Promise<Result<Fremdfirma>> {
  return call(`/personal/fremdfirmen/${encodeURIComponent(id)}`, { method: "PATCH", body });
}

export async function listArbeitsbereiche(mitArchiv = false): Promise<Result<Arbeitsbereich[]>> {
  return call(`/personal/arbeitsbereiche${q({ mit_archiv: mitArchiv || undefined })}`);
}

export async function createArbeitsbereich(
  body: Pick<Arbeitsbereich, "name" | "kurz" | "farbe"> & { sort?: number },
): Promise<Result<Arbeitsbereich>> {
  return call("/personal/arbeitsbereiche", { method: "POST", body });
}

export async function updateArbeitsbereich(
  id: string,
  body: Partial<Pick<Arbeitsbereich, "name" | "kurz" | "farbe" | "sort">> & { archiviert?: boolean },
): Promise<Result<Arbeitsbereich>> {
  return call(`/personal/arbeitsbereiche/${encodeURIComponent(id)}`, { method: "PATCH", body });
}

export async function getRegeln(): Promise<Result<Regeln | null>> {
  return call("/personal/regeln");
}

export async function getRegelVorschlag(): Promise<Result<RegelVorschlag>> {
  return call("/personal/regeln/vorschlag");
}

export async function regelnBestaetigen(body: RegelnSet): Promise<Result<Regeln>> {
  return call("/personal/regeln", { method: "PUT", body });
}

export async function listPausenmodelle(): Promise<Result<Pausenmodell[]>> {
  return call("/personal/pausenmodelle");
}

export async function setPausenmodelle(
  eintraege: { arbeitsbereich_id?: string | null; ab_minuten: number; pause_minuten: number }[],
): Promise<Result<Pausenmodell[]>> {
  return call("/personal/pausenmodelle", { method: "PUT", body: eintraege });
}

export async function listVorlagen(mitArchiv = false): Promise<Result<Schichtvorlage[]>> {
  return call(`/personal/vorlagen${q({ mit_archiv: mitArchiv || undefined })}`);
}

export async function createVorlage(
  body: Omit<Schichtvorlage, "id" | "archived_at">,
): Promise<Result<Schichtvorlage>> {
  return call("/personal/vorlagen", { method: "POST", body });
}

export async function updateVorlage(
  id: string,
  body: Partial<Omit<Schichtvorlage, "id" | "archived_at">> & { archiviert?: boolean },
): Promise<Result<Schichtvorlage>> {
  return call(`/personal/vorlagen/${encodeURIComponent(id)}`, { method: "PATCH", body });
}

export async function feiertageImportieren(
  jahr?: number,
): Promise<Result<{ land: string; jahre: number[]; eingefuegt: number; vorhanden: number }>> {
  return call(`/personal/feiertage/import${q({ jahr })}`, { method: "POST" });
}

// --- Dienstplan ----------------------------------------------------------

export async function getWochenplan(woche: string): Promise<Result<Wochenplan>> {
  return call(`/personal/dienstplan${q({ woche })}`);
}

export async function getMeinPlan(woche: string): Promise<Result<Wochenplan>> {
  return call(`/personal/dienstplan/mein${q({ woche })}`);
}

export async function konflikteVorschau(body: SchichtCreate): Promise<Result<Konflikt[]>> {
  return call("/personal/dienstplan/konflikte", { method: "POST", body });
}

export async function createSchicht(body: SchichtCreate): Promise<Result<Schicht>> {
  return call("/personal/schichten", { method: "POST", body });
}

export async function updateSchicht(id: string, body: SchichtUpdate): Promise<Result<Schicht>> {
  return call(`/personal/schichten/${encodeURIComponent(id)}`, { method: "PATCH", body });
}

export async function deleteSchicht(id: string): Promise<Result<void>> {
  return call(`/personal/schichten/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function schichtBestaetigen(id: string): Promise<Result<Schicht>> {
  return call(`/personal/schichten/${encodeURIComponent(id)}/bestaetigen`, { method: "POST" });
}

export async function schichtBewerben(id: string, zurueck = false): Promise<Result<Schicht>> {
  return call(`/personal/schichten/${encodeURIComponent(id)}/bewerben${q({ zurueck: zurueck || undefined })}`, {
    method: "POST",
  });
}

export async function schichtBewerbungen(id: string): Promise<Result<PlanPerson[]>> {
  return call(`/personal/schichten/${encodeURIComponent(id)}/bewerbungen`);
}

export async function bewerbungEntscheiden(
  id: string,
  userId: string,
  annehmen: boolean,
): Promise<Result<Schicht>> {
  return call(`/personal/schichten/${encodeURIComponent(id)}/bewerbungen/entscheiden`, {
    method: "POST",
    body: { user_id: userId, annehmen },
  });
}

export async function wocheKopieren(
  quelle: string,
  ziel: string,
  mitPersonen: boolean,
): Promise<Result<{ woche_start: string; angelegt: number; vorhanden: number }>> {
  return call("/personal/dienstplan/kopieren", {
    method: "POST",
    body: { quelle_woche_start: quelle, ziel_woche_start: ziel, mit_personen: mitPersonen },
  });
}

export async function wocheVeroeffentlichen(
  woche: string,
): Promise<Result<{ woche_start: string; anzahl: number; benachrichtigt: number }>> {
  return call(`/personal/dienstplan/veroeffentlichen${q({ woche })}`, { method: "POST" });
}

export async function planGelesen(woche: string): Promise<Result<void>> {
  return call(`/personal/dienstplan/gelesen${q({ woche })}`, { method: "POST" });
}

export async function bedarfAusAufgaben(
  woche: string,
): Promise<Result<{ woche_start: string; angelegt: number; vorhanden: number }>> {
  return call(`/personal/dienstplan/bedarf${q({ woche })}`, { method: "POST" });
}

// --- Abwesenheit & Verfügbarkeit -------------------------------------------

export async function listAbwesenheiten(
  von: string,
  bis: string,
  status?: string,
): Promise<Result<AbwesenheitListe>> {
  return call(`/personal/abwesenheiten${q({ von, bis, status })}`);
}

export async function abwesenheitBeantragen(body: {
  user_id?: string | null;
  art: AbwesenheitArt;
  von: string;
  bis: string;
  halbtag_start?: boolean;
  halbtag_ende?: boolean;
  grund?: string | null;
  attest_dokument_id?: string | null;
}): Promise<Result<Abwesenheit>> {
  return call("/personal/abwesenheiten", { method: "POST", body });
}

export async function abwesenheitEntscheiden(
  id: string,
  genehmigen: boolean,
  kommentar?: string,
): Promise<Result<Abwesenheit>> {
  return call(`/personal/abwesenheiten/${encodeURIComponent(id)}/entscheiden`, {
    method: "POST",
    body: { genehmigen, kommentar: kommentar || null },
  });
}

export async function abwesenheitStornieren(id: string): Promise<Result<Abwesenheit>> {
  return call(`/personal/abwesenheiten/${encodeURIComponent(id)}/stornieren`, { method: "POST" });
}

export async function listUrlaubskonten(jahr: number): Promise<Result<Urlaubskonto[]>> {
  return call(`/personal/urlaubskonten${q({ jahr })}`);
}

export async function getUrlaubskonto(userId: string, jahr: number): Promise<Result<Urlaubskonto>> {
  return call(`/personal/mitarbeiter/${encodeURIComponent(userId)}/urlaubskonto${q({ jahr })}`);
}

export async function setUrlaubskonto(
  userId: string,
  jahr: number,
  body: {
    anspruch: number;
    uebertrag?: number;
    verfall_am?: string | null;
    korrektur?: number;
    korrektur_grund?: string | null;
  },
): Promise<Result<Urlaubskonto>> {
  return call(`/personal/mitarbeiter/${encodeURIComponent(userId)}/urlaubskonto${q({ jahr })}`, {
    method: "PUT",
    body,
  });
}

export async function listUrlaubssperren(): Promise<Result<Urlaubssperre[]>> {
  return call("/personal/urlaubssperren");
}

export async function createUrlaubssperre(body: Omit<Urlaubssperre, "id">): Promise<Result<Urlaubssperre>> {
  return call("/personal/urlaubssperren", { method: "POST", body });
}

export async function deleteUrlaubssperre(id: string): Promise<Result<void>> {
  return call(`/personal/urlaubssperren/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function listVerfuegbarkeiten(userId: string): Promise<Result<Verfuegbarkeit[]>> {
  return call(`/personal/mitarbeiter/${encodeURIComponent(userId)}/verfuegbarkeiten`);
}

export async function createVerfuegbarkeit(body: {
  user_id?: string | null;
  art: VerfuegbarkeitArt;
  wiederkehrend_wochentag?: number | null;
  datum_von?: string | null;
  datum_bis?: string | null;
  zeit_von?: string | null;
  zeit_bis?: string | null;
  ganztags: boolean;
  notiz?: string | null;
}): Promise<Result<Verfuegbarkeit>> {
  return call("/personal/verfuegbarkeiten", { method: "POST", body });
}

export async function deleteVerfuegbarkeit(id: string): Promise<Result<void>> {
  return call(`/personal/verfuegbarkeiten/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function getKrankenstand(von: string, bis: string): Promise<Result<Krankenstand[]>> {
  return call(`/personal/krankenstand${q({ von, bis })}`);
}

// --- Zeiterfassung -------------------------------------------------------

export async function getOffeneZeit(): Promise<Result<Zeiterfassung | null>> {
  return call("/personal/zeiterfassung/offen");
}

export async function zeitStart(body: {
  schicht_id?: string | null;
  task_id?: string | null;
  property_id?: string | null;
  standort?: { lat: number; lng: number; genauigkeit_m?: number | null } | null;
  notiz?: string | null;
}): Promise<Result<Zeiterfassung>> {
  return call("/personal/zeiterfassung/start", { method: "POST", body });
}

export async function zeitPause(beenden: boolean): Promise<Result<Zeiterfassung>> {
  return call(`/personal/zeiterfassung/pause${q({ beenden: beenden || undefined })}`, { method: "POST" });
}

export async function zeitEnde(body: {
  standort?: { lat: number; lng: number; genauigkeit_m?: number | null } | null;
  notiz?: string | null;
}): Promise<Result<Zeiterfassung>> {
  return call("/personal/zeiterfassung/ende", { method: "POST", body });
}

export async function listZeiten(von: string, bis: string, userId?: string): Promise<Result<ZeitListe>> {
  return call(`/personal/zeiterfassung${q({ von, bis, user_id: userId })}`);
}

export async function zeitKorrigieren(
  id: string,
  body: {
    start_at?: string;
    end_at?: string;
    pausen?: { start: string; end: string | null }[];
    property_id?: string | null;
    grund: string;
  },
): Promise<Result<Zeiterfassung>> {
  return call(`/personal/zeiterfassung/${encodeURIComponent(id)}`, { method: "PATCH", body });
}

export async function zeitNachtragen(body: {
  user_id: string;
  start_at: string;
  end_at: string;
  pausen?: { start: string; end: string | null }[];
  schicht_id?: string | null;
  property_id?: string | null;
  grund: string;
}): Promise<Result<Zeiterfassung>> {
  return call("/personal/zeiterfassung/nachtrag", { method: "POST", body });
}

export async function zeitBestaetigen(id: string): Promise<Result<Zeiterfassung>> {
  return call(`/personal/zeiterfassung/${encodeURIComponent(id)}/bestaetigen`, { method: "POST" });
}

export async function zeitLoeschen(id: string, grund: string): Promise<Result<void>> {
  return call(`/personal/zeiterfassung/${encodeURIComponent(id)}${q({ grund })}`, { method: "DELETE" });
}

export async function getArbeitszeitkonto(userId: string): Promise<Result<Arbeitszeitkonto>> {
  return call(`/personal/mitarbeiter/${encodeURIComponent(userId)}/arbeitszeitkonto`);
}

export async function azkBuchen(body: {
  user_id: string;
  datum: string;
  minuten: number;
  grund: "abbau" | "auszahlung" | "korrektur";
  notiz?: string | null;
}): Promise<Result<Arbeitszeitkonto>> {
  return call("/personal/arbeitszeitkonto", { method: "POST", body });
}

export async function listMonatsabschluesse(jahr: number, monat: number): Promise<Result<Monatsabschluss[]>> {
  return call(`/personal/monatsabschluesse${q({ jahr, monat })}`);
}

export async function monatAbschliessen(
  userIds: string[],
  jahr: number,
  monat: number,
): Promise<Result<Monatsabschluss[]>> {
  return call("/personal/monatsabschluesse", { method: "POST", body: { user_ids: userIds, jahr, monat } });
}

// --- Auswertung & Lohn -----------------------------------------------------

export async function getAuswertung(von: string, bis: string): Promise<Result<Auswertung>> {
  return call(`/personal/auswertung${q({ von, bis })}`);
}

/** Lohnexport als Datei — liefert Inhalt + Namen; der Download passiert im Client. */
export async function lohnexport(
  jahr: number,
  monat: number,
  format: "datev_lodas" | "csv",
): Promise<Result<{ name: string; inhalt_base64: string; mime: string }>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  const { apiBasis } = await import("@/lib/api");
  const res = await fetch(`${apiBasis()}/personal/lohnexport`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ jahr, monat, format }),
    cache: "no-store",
  });
  if (!res.ok) {
    let error = `Fehler ${res.status}`;
    let details: Record<string, unknown> | undefined;
    try {
      const data = await res.json();
      if (typeof data?.detail === "string") error = data.detail;
      else if (data?.detail && typeof data.detail === "object") {
        details = data.detail as Record<string, unknown>;
        if (typeof details.message === "string") error = details.message;
      }
    } catch {
      // kein JSON — Standardmeldung behalten
    }
    return { ok: false, error, status: res.status, details };
  }
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const name = /filename="([^"]+)"/.exec(disposition)?.[1] ?? "lohnexport.txt";
  const puffer = Buffer.from(await res.arrayBuffer());
  return {
    ok: true,
    data: { name, inhalt_base64: puffer.toString("base64"), mime: res.headers.get("Content-Type") ?? "text/plain" },
  };
}

// --- Kartei (0543) ------------------------------------------------------------

const person = (userId: string, bereich: KarteiBereich) =>
  `/personal/mitarbeiter/${encodeURIComponent(userId)}/${bereich}`;
const zeile = (bereich: KarteiBereich, id: string) => `/personal/kartei/${bereich}/${encodeURIComponent(id)}`;

export async function listVertraege(userId: string): Promise<Result<Vertrag[]>> {
  return call(person(userId, "vertraege"));
}
export async function createVertrag(userId: string, body: VertragInput): Promise<Result<Vertrag>> {
  return call(person(userId, "vertraege"), { method: "POST", body });
}
export async function updateVertrag(id: string, body: VertragInput): Promise<Result<Vertrag>> {
  return call(zeile("vertraege", id), { method: "PATCH", body });
}
export async function createNachtrag(
  vertragId: string,
  body: { datum: string; beschreibung: string; grund?: string | null; aenderungen?: { feld: string; alt: string; neu: string }[] },
): Promise<Result<Vertrag>> {
  return call(`/personal/kartei/vertraege/${encodeURIComponent(vertragId)}/nachtraege`, { method: "POST", body });
}
export async function deleteNachtrag(id: string): Promise<Result<void>> {
  return call(`/personal/kartei/nachtraege/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function listMassnahmen(userId: string): Promise<Result<Massnahme[]>> {
  return call(person(userId, "massnahmen"));
}
export async function createMassnahme(userId: string, body: MassnahmeInput): Promise<Result<Massnahme>> {
  return call(person(userId, "massnahmen"), { method: "POST", body });
}
export async function updateMassnahme(id: string, body: MassnahmeInput): Promise<Result<Massnahme>> {
  return call(zeile("massnahmen", id), { method: "PATCH", body });
}

export async function listVorfaelle(userId: string): Promise<Result<Vorfall[]>> {
  return call(person(userId, "vorfaelle"));
}
export async function createVorfall(userId: string, body: VorfallInput): Promise<Result<Vorfall>> {
  return call(person(userId, "vorfaelle"), { method: "POST", body });
}
export async function updateVorfall(id: string, body: VorfallInput): Promise<Result<Vorfall>> {
  return call(zeile("vorfaelle", id), { method: "PATCH", body });
}

export async function listGespraeche(userId: string): Promise<Result<Gespraech[]>> {
  return call(person(userId, "gespraeche"));
}
export async function createGespraech(userId: string, body: GespraechInput): Promise<Result<Gespraech>> {
  return call(person(userId, "gespraeche"), { method: "POST", body });
}
export async function updateGespraech(id: string, body: GespraechInput): Promise<Result<Gespraech>> {
  return call(zeile("gespraeche", id), { method: "PATCH", body });
}

export async function listNachweise(userId: string): Promise<Result<Nachweis[]>> {
  return call(person(userId, "nachweise"));
}
export async function createNachweis(userId: string, body: NachweisInput): Promise<Result<Nachweis>> {
  return call(person(userId, "nachweise"), { method: "POST", body });
}
export async function updateNachweis(id: string, body: NachweisInput): Promise<Result<Nachweis>> {
  return call(zeile("nachweise", id), { method: "PATCH", body });
}

export async function listSchulungen(userId: string): Promise<Result<Schulung[]>> {
  return call(person(userId, "schulungen"));
}
export async function createSchulung(userId: string, body: SchulungInput): Promise<Result<Schulung>> {
  return call(person(userId, "schulungen"), { method: "POST", body });
}
export async function updateSchulung(id: string, body: SchulungInput): Promise<Result<Schulung>> {
  return call(zeile("schulungen", id), { method: "PATCH", body });
}

export async function deleteKarteiEintrag(bereich: KarteiBereich, id: string): Promise<Result<void>> {
  return call(zeile(bereich, id), { method: "DELETE" });
}
