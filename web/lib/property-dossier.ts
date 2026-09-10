"use server";

// Objektkartei (8-stufig, Lastenheft §6): Server-Actions gegen den FastAPI-
// property_dossier-Slice (/api/v1/property-dossier). Enum-Werte sind sprach-
// neutrale Keys (Labels via next-intl). Stufe 1 (Eigentümer) ist read-only aus
// dem owners-Slice; Objekt-Basisfelder laufen über updateProperty (lib/properties).
import { ApiError, api } from "@/lib/api";
import type { ZaehlRhythmus, Zustand } from "@/lib/inventar-konstanten";
import { currentToken } from "@/lib/session-token";

type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

async function call<T>(
  path: string,
  opts: {
    // PATCH fuer Teilaenderungen (Inventar): ein weggelassenes Feld
    // bleibt, wie es ist — ein PUT setzte die uebrigen auf null.
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
  } = {},
): Promise<Result<T>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  try {
    const data = await api<T>(path, { ...opts, token });
    return { ok: true, data };
  } catch (exc) {
    const error = exc instanceof ApiError ? exc.message : "Aktion fehlgeschlagen.";
    const status = exc instanceof ApiError ? exc.status : undefined;
    return { ok: false, error, status };
  }
}

// --- Typen (exakt am Pydantic-Contract; Enum-Felder = neutrale Keys) --------
export type LinkedOwner = {
  owner_id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  iban: string | null;
  bic: string | null;
  bank_name: string | null;
  account_holder: string | null;
  // Dänische Bankverbindung (0581) neben IBAN/BIC.
  bank_reg_nr: string | null;
  bank_konto_nr: string | null;
  tax_id: string | null;
  vat_id: string | null;
  cpr_number: string | null;
  ownership_share: number | null;
};

export type ProcessData = {
  first_meeting_at: string | null;
  contract_sent_at: string | null;
  contract_signed_at: string | null;
  onboarding_invoice_sent_at: string | null;
  onboarding_invoice_paid_at: string | null;
};

export type AccessData = {
  key_status: string | null;
  key_placement: string | null;
};

export type ServiceAgreementInput = {
  service_type: string;
  frequency: string | null;
  price: number | null;
  currency: string | null;
  notes: string | null;
};
export type ServiceAgreement = ServiceAgreementInput & { id: string };

export type TradespersonInput = {
  trade: string;
  name: string | null;
  phone: string | null;
  notes: string | null;
};
export type Tradesperson = TradespersonInput & { id: string };

export type EmergencyAuthority = {
  authority_mode: string | null;
  authority_limit: number | null;
  currency: string | null;
};

export type MarketingData = {
  photographer_booked_at: string | null;
  media_received_at: string | null;
  site_walkthrough_at: string | null;
  defects_list_sent_at: string | null;
};

export type HousebookData = {
  welcome_text_status: string | null;
  physical_folder_placed: boolean;
  /** Geheimtipps des Eigentümers (0582), Freitext bis 5000 Zeichen. */
  secret_tips: string | null;
};

export type PlatformLaunchInput = {
  platform: string;
  launch_at: string | null;
  status: string | null;
};
export type PlatformLaunch = PlatformLaunchInput & { id: string };

export type DossierFull = {
  owner: LinkedOwner | null;
  process: ProcessData;
  access: AccessData;
  service_agreements: ServiceAgreement[];
  tradespeople: Tradesperson[];
  emergency_authority: EmergencyAuthority;
  marketing: MarketingData;
  housebook: HousebookData;
  platform_launches: PlatformLaunch[];
};

const BASE = "/property-dossier";

export async function getDossier(pid: string): Promise<Result<DossierFull>> {
  return call(`${BASE}/${pid}/full`);
}

// Stufe 2
export async function saveProcess(pid: string, input: ProcessData): Promise<Result<ProcessData>> {
  return call(`${BASE}/${pid}/process`, { method: "PUT", body: input });
}

// Stufe 3
export async function saveAccess(pid: string, input: AccessData): Promise<Result<AccessData>> {
  return call(`${BASE}/${pid}/access`, { method: "PUT", body: input });
}

// Stufe 4
export async function addServiceAgreement(pid: string, input: ServiceAgreementInput): Promise<Result<ServiceAgreement>> {
  return call(`${BASE}/${pid}/service-agreements`, { method: "POST", body: input });
}
export async function updateServiceAgreement(pid: string, id: string, input: ServiceAgreementInput): Promise<Result<ServiceAgreement>> {
  return call(`${BASE}/${pid}/service-agreements/${id}`, { method: "PUT", body: input });
}
export async function deleteServiceAgreement(pid: string, id: string): Promise<Result<null>> {
  return call(`${BASE}/${pid}/service-agreements/${id}`, { method: "DELETE" });
}

// Stufe 5
export async function addTradesperson(pid: string, input: TradespersonInput): Promise<Result<Tradesperson>> {
  return call(`${BASE}/${pid}/tradespeople`, { method: "POST", body: input });
}
export async function updateTradesperson(pid: string, id: string, input: TradespersonInput): Promise<Result<Tradesperson>> {
  return call(`${BASE}/${pid}/tradespeople/${id}`, { method: "PUT", body: input });
}
export async function deleteTradesperson(pid: string, id: string): Promise<Result<null>> {
  return call(`${BASE}/${pid}/tradespeople/${id}`, { method: "DELETE" });
}
export async function saveEmergencyAuthority(pid: string, input: EmergencyAuthority): Promise<Result<EmergencyAuthority>> {
  return call(`${BASE}/${pid}/emergency-authority`, { method: "PUT", body: input });
}

// Stufe 6
export async function saveMarketing(pid: string, input: MarketingData): Promise<Result<MarketingData>> {
  return call(`${BASE}/${pid}/marketing`, { method: "PUT", body: input });
}

// Stufe 7
export async function saveHousebook(pid: string, input: HousebookData): Promise<Result<HousebookData>> {
  return call(`${BASE}/${pid}/housebook`, { method: "PUT", body: input });
}

// Stufe 8
export async function addPlatformLaunch(pid: string, input: PlatformLaunchInput): Promise<Result<PlatformLaunch>> {
  return call(`${BASE}/${pid}/platform-launches`, { method: "POST", body: input });
}
export async function updatePlatformLaunch(pid: string, id: string, input: PlatformLaunchInput): Promise<Result<PlatformLaunch>> {
  return call(`${BASE}/${pid}/platform-launches/${id}`, { method: "PUT", body: input });
}
export async function deletePlatformLaunch(pid: string, id: string): Promise<Result<null>> {
  return call(`${BASE}/${pid}/platform-launches/${id}`, { method: "DELETE" });
}

// --- Digitale Mappe: PDFs mit Auswertung (0619) -----------------------------

/** Ein abgelegtes PDF, wie es die Mappe zeigt. Ohne Ablagepfad — den holt die
 *  Oberfläche nie, sie fragt bei Bedarf eine kurzlebige signierte Adresse. */
export type MappeDokument = {
  id: string;
  mappe: "gast" | "haus";
  datei_name: string;
  datei_groesse_bytes: number;
  /** null = nicht ermittelt, NICHT „eine Seite". */
  seiten: number | null;
  auswertung: "offen" | "gelesen" | "uebernommen" | "ohne_treffer" | "fehler";
  auswertung_hinweis: string | null;
  ausgewertet_am: string | null;
  created_at: string;
};

/** Ein erkannter Wert — VORGESCHLAGEN, nicht gespeichert. */
export type MappeVorschlag = {
  key: string;
  titel: string;
  wert: string;
  /** hoch | mittel | niedrig; null = das Modell hat sich nicht geäußert. */
  sicher: string | null;
  /** Wo im Dokument es steht — damit ein Mensch nachschlagen kann. */
  fundstelle: string | null;
  /** Türcode/WLAN-Passwort: falsch übernommen merkt es der Gast, nicht der
   *  Betrieb. In der Liste vorab NICHT angehakt. */
  heikel: boolean;
};

export type MappeDokumentVorschau = {
  dokument: MappeDokument;
  /** Sprache des Dokuments (de|en|da); null = nicht erkannt. */
  sprache: string | null;
  seiten: number | null;
  items: MappeVorschlag[];
};

export type MappeUebernahmeErgebnis = {
  gesetzt: string[];
  uebersprungen: string[];
  ueberschrieben: boolean;
};

export async function listMappeDokumente(
  pid: string,
  mappe: "gast" | "haus",
): Promise<Result<MappeDokument[]>> {
  return call(`${BASE}/${pid}/mappe/${mappe}/dokumente`);
}

/** Kurzlebige signierte Adresse (10 Minuten) zum Ansehen des PDFs. */
export async function mappeDokumentUrl(
  pid: string,
  dokumentId: string,
): Promise<Result<{ url: string }>> {
  return call(`${BASE}/${pid}/mappe/dokument/${dokumentId}/url`);
}

/**
 * Schritt 1: PDF ablegen und lesen lassen. Schreibt NICHTS in die Mappe.
 *
 * Eigener Pfad `.../dokumente/lesen` statt POST auf den Listenpfad: der
 * Rate-Limit-Bucket wird serverseitig allein über den PFAD gewählt. Lägen
 * Lesen und Auflisten auf demselben Pfad, zöge das Blättern den strengen
 * KI-Eimer mit.
 */
export async function mappeDokumentLesen(
  pid: string,
  mappe: "gast" | "haus",
  file: File,
): Promise<Result<MappeDokumentVorschau>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };

  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  const form = new FormData();
  form.append("file", file);
  try {
    const res = await fetch(
      `${base}/api/v1${BASE}/${pid}/mappe/${mappe}/dokumente/lesen`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
        cache: "no-store",
      },
    );
    if (!res.ok) {
      let detail = `Fehler ${res.status}`;
      try {
        const data = await res.json();
        if (typeof data?.detail === "string") detail = data.detail;
      } catch {
        // kein JSON-Body
      }
      return { ok: false, error: detail };
    }
    return { ok: true, data: (await res.json()) as MappeDokumentVorschau };
  } catch {
    return { ok: false, error: "Backend nicht erreichbar." };
  }
}

/** Schritt 2: die BESTÄTIGTEN Werte in die Mappenfelder schreiben. */
export async function mappeUebernehmen(
  pid: string,
  input: {
    dokument_id: string;
    sprache: string;
    items: MappeVorschlag[];
    ueberschreiben?: boolean;
  },
): Promise<Result<MappeUebernahmeErgebnis>> {
  return call(`${BASE}/${pid}/mappe/uebernehmen`, { method: "POST", body: input });
}

export async function deleteMappeDokument(
  pid: string,
  dokumentId: string,
): Promise<Result<null>> {
  return call(`${BASE}/${pid}/mappe/dokument/${dokumentId}`, { method: "DELETE" });
}

// --- Inventarliste je Objekt (0620) -----------------------------------------

export type InventarRaum = { id: string; name: string; sortierung: number };

/** Ein Gegenstand. SOLL und IST getrennt — bei einer Inventur ist genau die
 *  Differenz die Aussage. `soll_menge: null` = kein Soll hinterlegt. */
export type InventarGegenstand = {
  id: string;
  name: string;
  room_id: string | null;
  ist_menge: number;
  soll_menge: number | null;
  beschreibung: string | null;
  quelle: "manuell" | "dokument";
  /** null = nie geprüft, NICHT „heute geprüft". */
  geprueft_am: string | null;

  // --- was eine INVENTUR ausmacht (0623) ---
  /** Ein Sofa und Spülmittel sind nicht dasselbe. */
  art: "bestand" | "verbrauch";
  /** Guestys „par level": Unterschreitung löst eine Nachfüll-Aufgabe aus.
   *  null = nicht gepflegt, NICHT 0 („melde nie"). */
  meldebestand: number | null;
  /** Wie oft gezählt wird. `jede_abreise` landet auf der Reinigungsliste. */
  zaehl_rhythmus: "jede_abreise" | "quartal" | "jaehrlich" | "nie";
  zuletzt_gezaehlt_am: string | null;
  /** Ersatzplanung, unabhängig vom Schaden: ein Sofa kann heil und trotzdem
   *  durchgesessen sein. */
  zustand: "neu" | "gut" | "abgenutzt" | "ersatz_faellig";
  zustand_notiz: string | null;
  /** Ob ein Bild des INTAKTEN Zustands hinterlegt ist. */
  hat_referenz_foto: boolean;
  angeschafft_am: string | null;
  anschaffungswert: number | null;
  anschaffung_currency: string | null;
};


export type InventarSchaden = {
  id: string;
  item_id: string | null;
  /** Name zum Zeitpunkt der Meldung — bleibt, auch wenn der Gegenstand geht. */
  item_name: string;
  art: "beschaedigt" | "fehlt" | "entsorgt";
  beschreibung: string | null;
  menge: number;
  traeger: "offen" | "eigentuemer" | "gast" | "betrieb";
  status: "gemeldet" | "bestaetigt" | "abgerechnet" | "verworfen";
  /** null, solange niemand den Preis kennt. Keine 0 als Platzhalter. */
  betrag: number | null;
  currency: string | null;
  gemeldet_am: string;
  bestaetigt_am: string | null;
  /** Repariert/ersetzt. Eigene Achse neben `status` (0625): bezahlt und
   *  behoben sind zwei verschiedene Aussagen. `null` = noch offen. */
  behoben_am: string | null;
  owner_expense_id: string | null;
  task_id: string | null;
  foto_ids: string[];
};

export async function listInventarRaeume(pid: string): Promise<Result<InventarRaum[]>> {
  return call(`${BASE}/${pid}/inventar/raeume`);
}

export async function createInventarRaum(
  pid: string,
  input: { name: string; sortierung?: number },
): Promise<Result<InventarRaum>> {
  return call(`${BASE}/${pid}/inventar/raeume`, { method: "POST", body: input });
}

export async function deleteInventarRaum(
  pid: string,
  raumId: string,
): Promise<Result<null>> {
  return call(`${BASE}/${pid}/inventar/raeume/${raumId}`, { method: "DELETE" });
}

export async function listInventar(
  pid: string,
): Promise<Result<InventarGegenstand[]>> {
  return call(`${BASE}/${pid}/inventar`);
}

/** Zeilen ergänzen — von Hand oder aus einem bestätigten PDF. Die Liste ist
 *  nie „fertig": ein Betrieb kauft nach und ergänzt beim Rundgang. */
export async function createInventar(
  pid: string,
  input: {
    eintraege: {
      name: string;
      room_id?: string | null;
      ist_menge?: number | null;
      soll_menge?: number | null;
      beschreibung?: string | null;
      art?: "bestand" | "verbrauch";
      meldebestand?: number | null;
      zaehl_rhythmus?: ZaehlRhythmus;
      zustand?: Zustand;
    }[];
    dokument_id?: string | null;
  },
): Promise<Result<{ angelegt: number }>> {
  return call(`${BASE}/${pid}/inventar`, { method: "POST", body: input });
}

/** Nur die mitgegebenen Felder ändern — ein weggelassenes bleibt, wie es ist. */
export async function updateInventar(
  pid: string,
  itemId: string,
  input: Record<string, unknown>,
): Promise<Result<InventarGegenstand>> {
  return call(`${BASE}/${pid}/inventar/${itemId}`, { method: "PATCH", body: input });
}

export async function deleteInventar(
  pid: string,
  itemId: string,
): Promise<Result<null>> {
  return call(`${BASE}/${pid}/inventar/${itemId}`, { method: "DELETE" });
}

export async function listSchaeden(
  pid: string,
  nurOffen = false,
): Promise<Result<InventarSchaden[]>> {
  const p = nurOffen ? "?nur_offen=true" : "";
  return call(`${BASE}/${pid}/inventar/schaeden${p}`);
}

/** Kurzlebige signierte Adresse (10 Minuten) für ein Schadensbild. */
export async function schadenFotoUrl(
  pid: string,
  fotoId: string,
): Promise<Result<{ url: string }>> {
  return call(`${BASE}/${pid}/inventar/foto/${fotoId}`);
}

/**
 * Betrag und Träger festlegen — erst danach entstehen Aufgabe und Posten.
 *
 * Bewusst NICHT beim Melden: die meldende Person kennt den Preis nicht, und
 * ein Posten über 0,00 wäre eine Falschaussage in der Abrechnung.
 */
export async function bestaetigeSchaden(
  pid: string,
  schadenId: string,
  input: { betrag: number; traeger: string; aufgabe_anlegen?: boolean },
): Promise<Result<InventarSchaden>> {
  return call(`${BASE}/${pid}/inventar/schaeden/${schadenId}/bestaetigen`, {
    method: "POST",
    body: input,
  });
}

export async function verwerfeSchaden(
  pid: string,
  schadenId: string,
): Promise<Result<null>> {
  return call(`${BASE}/${pid}/inventar/schaeden/${schadenId}/verwerfen`, {
    method: "POST",
  });
}

/** Repariert oder ersetzt — oder zurückgenommen. Unabhängig vom
 *  Abrechnungsstand: ein Sessel kann bezahlt und weiterhin kaputt sein. */
export async function setzeSchadenBehoben(
  pid: string,
  schadenId: string,
  behoben: boolean,
): Promise<Result<null>> {
  return call(`${BASE}/${pid}/inventar/schaeden/${schadenId}/behoben`, {
    method: "POST",
    body: { behoben },
  });
}

/** Einen Schaden melden. FOTO IST PFLICHT — ohne Bild weist der Server ab. */
export async function meldeSchaden(
  pid: string,
  input: {
    item_id?: string | null;
    item_name: string;
    art: string;
    traeger: string;
    beschreibung?: string | null;
    menge?: number;
    reservation_id?: string | null;
  },
  fotos: File[],
): Promise<Result<InventarSchaden>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  const form = new FormData();
  for (const [k, v] of Object.entries(input)) {
    if (v !== null && v !== undefined) form.append(k, String(v));
  }
  for (const f of fotos) form.append("foto", f);
  try {
    const res = await fetch(`${base}/api/v1${BASE}/${pid}/inventar/schaeden`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
      cache: "no-store",
    });
    if (!res.ok) {
      let detail = `Fehler ${res.status}`;
      try {
        const data = await res.json();
        if (typeof data?.detail === "string") detail = data.detail;
      } catch {
        // kein JSON-Body
      }
      return { ok: false, error: detail };
    }
    return { ok: true, data: (await res.json()) as InventarSchaden };
  } catch {
    return { ok: false, error: "Backend nicht erreichbar." };
  }
}

/** Ein Vorschlag aus dem Inventar-PDF — noch nichts gespeichert. */
export type InventarVorschlag = {
  name: string;
  /** null = im Dokument stand keine Menge. Keine erfundene 1 (Wurzel 4). */
  soll_menge: number | null;
  /** Die Überschrift, unter der er stand; null = keine. */
  raum: string | null;
  beschreibung: string | null;
};

/**
 * Eine Inventarliste als PDF lesen. Speichert NICHTS — die Vorschläge kommen
 * mit `createInventar` zurück.
 *
 * Eigener Weg neben der digitalen Mappe: dort sucht das Modell Mappenfelder
 * (WLAN, Türcode), hier eine Tabelle aus Gegenstand, Menge und Raum.
 */
export async function leseInventarPdf(
  pid: string,
  file: File,
): Promise<Result<{ datei_name: string; items: InventarVorschlag[] }>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  const form = new FormData();
  form.append("file", file);
  try {
    const res = await fetch(`${base}/api/v1${BASE}/${pid}/inventar/import`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
      cache: "no-store",
    });
    if (!res.ok) {
      let detail = `Fehler ${res.status}`;
      try {
        const data = await res.json();
        if (typeof data?.detail === "string") detail = data.detail;
      } catch {
        // kein JSON-Body
      }
      return { ok: false, error: detail };
    }
    return {
      ok: true,
      data: (await res.json()) as { datei_name: string; items: InventarVorschlag[] },
    };
  } catch {
    return { ok: false, error: "Backend nicht erreichbar." };
  }
}

/**
 * Das Bild des INTAKTEN Zustands hinterlegen (0623).
 *
 * Ohne Vorher-Bild gibt es im Streitfall keinen Vergleich: ein Foto vom
 * kaputten Sessel beweist nicht, dass er vorher heil war.
 */
export async function setzeReferenzfoto(
  pid: string,
  itemId: string,
  file: File,
): Promise<Result<{ gesetzt: boolean }>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  const form = new FormData();
  form.append("file", file);
  try {
    const res = await fetch(
      `${base}/api/v1${BASE}/${pid}/inventar/${itemId}/referenzfoto`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
        cache: "no-store",
      },
    );
    if (!res.ok) {
      let detail = `Fehler ${res.status}`;
      try {
        const data = await res.json();
        if (typeof data?.detail === "string") detail = data.detail;
      } catch {
        // kein JSON-Body
      }
      return { ok: false, error: detail };
    }
    return { ok: true, data: (await res.json()) as { gesetzt: boolean } };
  } catch {
    return { ok: false, error: "Backend nicht erreichbar." };
  }
}

/** Kurzlebige signierte Adresse (10 Minuten) für das Referenzbild. */
export async function referenzfotoUrl(
  pid: string,
  itemId: string,
): Promise<Result<{ url: string }>> {
  return call(`${BASE}/${pid}/inventar/${itemId}/referenzfoto`);
}
