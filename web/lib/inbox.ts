"use server";

// Posteingang: Server-Actions gegen den FastAPI-inbox-Slice (/api/v1/inbox).
// Threads werden aus importierten OTA-Buchungen abgeleitet (Portal, Gast,
// Reservierungsbezug). Business-Logik im Backend.
import { getLocale } from "next-intl/server";

import { ApiError, api } from "@/lib/api";
// Werte (die sieben Kategorien, die drei Quellen) stehen in
// `inbox-wissen-typen.ts`: eine "use server"-Datei darf nur async functions
// exportieren, ein const-Array darin bricht den Build in „Collecting page data".
import type { WissenKategorie, WissenQuelle } from "@/lib/inbox-wissen-typen";
import type { Zeitraum } from "@/lib/reservations";
import { currentToken } from "@/lib/session-token";
import type {
  AnfrageAktion,
  AnfrageDetail,
} from "@/lib/inbox-anfrage-typen";

export type InboxThread = {
  id: string;
  channex_booking_id: string | null;
  reservation_id: string | null;
  guest_id: string | null; // verknüpfter Gast (Resolver) → Link zur Gästekarte
  property_id: string | null;    // zugeordnetes Objekt (Filter/Anzeige)
  property_title: string | null;
  ota_name: string | null;       // Kanal (myBestDays, Booking.com, Airbnb, …)
  ota_reservation_code: string | null;
  guest_name: string | null;
  /** Profilbild beim Portal (0295); null = keins, dann Initialen. */
  guest_avatar_url: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  /** Sprache des Gastes beim Portal, Rohwert („it", „de-AT"). Entscheidet,
   *  welche Sprachfassung einer Vorlage eingesetzt wird (`lib/fassung`). */
  guest_language: string | null;
  status: string | null;
  arrival_date: string | null;
  departure_date: string | null;
  last_message: string | null;
  /** Absender der letzten Nachricht: "guest" = der Gast wartet auf Antwort,
   *  "property" = wir haben zuletzt geschrieben. */
  last_sender: string | null;
  /** Buchungszeitpunkt beim Portal (0291/0292). */
  booked_at: string | null;
  /**
   * Die Zeit, die die Liste anzeigt und nach der sie sortiert — vom Server
   * entschieden. IMMER dieses Feld verwenden, nie `updated_at`: letzteres ist
   * unsere Schreibzeit und stand bei 22 in einem Rutsch geholten Buchungen auf
   * derselben Sekunde („vor 24 m" für Buchungen aus Juli). null = kein
   * Fremdereignis bekannt; dann bleibt die Zeitangabe leer statt zu lügen.
   */
  letzte_aktivitaet: string | null;
  updated_at: string | null;
  is_read: boolean;
  is_starred: boolean;
  is_archived: boolean;
  inbox_status: "active" | "archived" | "trashed";
  assigned_user_id: string | null;
  assigned_user_name: string | null;
};

export type InboxMessage = {
  id: string | null;
  message: string;
  // "event" = Ereignis der Reservierung (Buchungseingang, Statuswechsel) im
  // selben Strang wie die Nachrichten — wie bei Lodgify/Hostaway.
  sender: "guest" | "property" | "note" | "event";
  sent_at: string | null;
  author_name?: string | null;
  /** Nur bei sender="event": Schlüssel der Kopfzeile (i18n). */
  event_title?: string | null;
  /** Nur bei sender="event": roher Statuswert ("modified" | "cancelled"). */
  event_detail?: string | null;
  /**
   * Nur bei sender="event": aufklappbare Angaben. `label` ist ein i18n-Kürzel,
   * `value` steht unverändert so da, wie das Portal es geliefert hat.
   */
  event_facts?: { label: string; value: string }[];
  /** Nur bei sender="event": Herkunftskanal (BookingCom, Airbnb …). */
  event_channel?: string | null;
  /**
   * Bildanhänge der Nachricht. Schickt der Gast NUR ein Foto, ist `message`
   * leer — dann trägt allein diese Liste den Inhalt. Der Server hat jede URL
   * auf https + bekannten Host geprüft (`_sichere_anhaenge`).
   */
  attachments?: string[];
};

export type TeamMember = { id: string; name: string; email: string | null };

export type ScheduledMessage = {
  id: string;
  thread_id: string;
  body: string;
  send_at: string;
  status: string;
};

export type ReservationDetail = {
  listing_name: string | null;
  listing_photo: string | null;
  address: string | null;
  rental_id: string | null;
  guest_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  guest_language: string | null;
  guest_location: string | null;
  // Aus einem Bestands-Import statt live eingegangen (0308) — erklärt, warum
  // die Gastfelder darüber leer sind.
  is_imported: boolean;
  adults: number | null;
  children: number | null;
  nights: number | null;
  total_amount: number | null;
  paid_amount: number | null;
  currency: string | null;
  status: string | null;
  ota_name: string | null;
  ota_reservation_code: string | null;
  check_in: string | null;
  check_out: string | null;
  checkin_time: string | null;
  checkout_time: string | null;
  note: string | null;
  is_starred: boolean;
};

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function call<T>(
  path: string,
  opts: { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: unknown } = {},
): Promise<Result<T>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  try {
    const data = await api<T>(`/inbox${path}`, { ...opts, token });
    return { ok: true, data };
  } catch (exc) {
    return {
      ok: false,
      error: exc instanceof ApiError ? exc.message : "Aktion fehlgeschlagen.",
    };
  }
}

export type InboxStatus = "active" | "archived" | "trashed";

/**
 * Die wählbaren Zeiträume — dieselbe Menge wie bei den Reservierungs-Kacheln
 * (Backend: `core.zeitraum.ZEITRAEUME`). Alias auf den dort definierten Typ,
 * damit es nicht zwei Unions gibt, die auseinanderlaufen können.
 */
export type NachrichtenZeitraum = Zeitraum;

export type NachrichtenKennzahl = {
  value: number;
  /** Schnitt je Tag über den Zeitraum — eigene Kachel daneben. */
  per_day: number;
  /** null = keine Vorperiode; dann steht „—" statt erfundener +100 %. */
  change_pct: number | null;
};

export type NachrichtenKennzahlen = {
  gesendet: NachrichtenKennzahl;
  empfangen: NachrichtenKennzahl;
  /** Nur, was der Automail-Dispatch selbst als solches geschrieben hat (0400). */
  automation: NachrichtenKennzahl;
  ungelesen: number;
  /** Die ersten offenen Konversationen; `ungelesen` bleibt die volle Zahl. */
  ungelesen_threads: InboxThread[];
  zeitraum: string;
  tage: number;
};

/** OTA-Gäste-Threads des aktuellen Tenants (aktiv | archiviert | Papierkorb). */
export async function listInboxThreads(
  opts: { unassigned?: boolean; status?: InboxStatus } = {},
): Promise<Result<{ items: InboxThread[]; total: number }>> {
  const params = new URLSearchParams();
  if (opts.unassigned) params.set("unassigned", "true");
  if (opts.status && opts.status !== "active") params.set("status", opts.status);
  const qs = params.toString() ? `?${params.toString()}` : "";
  return call<{ items: InboxThread[]; total: number }>(qs);
}

/**
 * Zahl der offenen Konversationen — das Abzeichen am Sidebar-Punkt.
 *
 * Bewusst ein eigener Endpunkt und nicht `listInboxThreads().filter(…)`: die
 * Sidebar steht auf JEDER Seite, und dafür 200 Threads samt Gastdaten,
 * Vorschautexten und Profilbildern zu laden wäre eine Datenlast, die niemand
 * anzeigt — dazu Gastdaten in einer Komponente, die sie nicht braucht.
 */
export async function getInboxUnreadCount(): Promise<Result<{ ungelesen: number }>> {
  return call<{ ungelesen: number }>("/unread-count");
}

/**
 * Nachrichten-Kennzahlen der Startseite (gesendet/empfangen/Automation).
 *
 * Ausdrücklich nur das Portal-Postfach — Marktplatz und WhatsApp sind eigene
 * Töpfe mit eigenen Richtungsfeldern, und drei Zählweisen in einer Zahl wären
 * irreführend. `zeitraum` ist eine geschlossene Menge; ein unbekannter Wert
 * wird vom Backend mit 422 abgewiesen statt still auf 30 Tage zu fallen.
 */
export async function getNachrichtenKennzahlen(
  zeitraum: NachrichtenZeitraum = "30d",
): Promise<Result<NachrichtenKennzahlen>> {
  return call<NachrichtenKennzahlen>(`/kennzahlen?zeitraum=${zeitraum}`);
}

/** Lebenszyklus setzen: active (wiederherstellen) | archived | trashed | deleted. */
export async function setInboxStatus(
  threadId: string,
  status: "active" | "archived" | "trashed" | "deleted",
): Promise<Result<void>> {
  return call<void>(`/${threadId}/status`, { method: "PUT", body: { status } });
}

/** Team-Benutzer des Tenants (mögliche Bearbeiter). */
export async function listTeam(): Promise<
  Result<{ items: TeamMember[]; total: number }>
> {
  return call<{ items: TeamMember[]; total: number }>("/team");
}

/** Konversation einem Benutzer zuweisen (null hebt auf). */
export async function assignThread(
  threadId: string,
  userId: string | null,
): Promise<Result<void>> {
  return call<void>(`/${threadId}/assign`, {
    method: "PUT",
    body: { user_id: userId },
  });
}

/**
 * Korrektur: Thread einem (anderen) Gast zuordnen. guestId=null legt einen Gast
 * aus den Thread-Kontaktdaten an (Resolver). Erfordert INBOX_MANAGE_CONFIG.
 */
export async function linkThreadGuest(
  threadId: string,
  guestId: string | null,
): Promise<Result<{ guest_id: string | null }>> {
  return call<{ guest_id: string | null }>(`/${threadId}/guest`, {
    method: "PUT",
    body: { guest_id: guestId },
  });
}

/** Interne Notiz (gelb) in den Verlauf legen. */
export async function addNote(
  threadId: string,
  body: string,
): Promise<Result<InboxMessage>> {
  return call<InboxMessage>(`/${threadId}/notes`, {
    method: "POST",
    body: { body },
  });
}

/** Anstehende geplante Nachrichten einer Konversation. */
export async function listScheduled(
  threadId: string,
): Promise<Result<{ items: ScheduledMessage[]; total: number }>> {
  return call<{ items: ScheduledMessage[]; total: number }>(`/${threadId}/scheduled`);
}

/** Manuelle Nachricht zeitversetzt planen. */
export async function scheduleMessage(
  threadId: string,
  body: string,
  sendAt: string,
): Promise<Result<ScheduledMessage>> {
  return call<ScheduledMessage>(`/${threadId}/scheduled`, {
    method: "POST",
    body: { body, send_at: sendAt },
  });
}

/** Geplante Nachricht abbrechen. */
export async function cancelScheduled(scheduledId: string): Promise<Result<void>> {
  return call<void>(`/scheduled/${scheduledId}`, { method: "DELETE" });
}

/** Massenaktion: Threads ab Datum als gelesen/archiviert markieren. */
export async function bulkUpdate(
  action: "read" | "archived",
  before: string,
): Promise<Result<{ updated: number }>> {
  return call<{ updated: number }>("/bulk-update", {
    method: "POST",
    body: { action, before },
  });
}

/**
 * Nachrichtenverlauf einer Konversation — live vom Portal, nicht aus unserer DB.
 *
 * `unavailable` benennt, warum der Portal-Chat gerade nichts liefert
 * ("chat_app_missing": Chat für dieses Objekt bei den Portalen nicht
 * freigeschaltet). Die Ereignisse der Buchung stehen trotzdem im Verlauf.
 */
export type InboxMessagesResult = {
  items: InboxMessage[];
  total: number;
  unavailable?: string | null;
  /**
   * Bis WANN der Gast gelesen hat (0297, Zeitpunkt beim Portal). Eine eigene
   * Nachricht gilt als gelesen, wenn `sent_at <= guest_read_at` — der Wert ist
   * ein Lesestand („war bis hierher") und gilt rückwirkend für alles Ältere.
   *
   * null/fehlend = dieser Kanal meldet keinen Lesestand (nur Airbnb tut es).
   * Dann KEIN Häkchen — nicht „ungelesen", denn das wüssten wir nicht.
   */
  guest_read_at?: string | null;
};

export async function getInboxMessages(
  threadId: string,
): Promise<Result<InboxMessagesResult>> {
  return call<InboxMessagesResult>(`/${threadId}/messages`);
}

/** Antwort an den Gast senden (zurück an die OTA). */
export async function sendInboxMessage(
  threadId: string,
  message: string,
): Promise<Result<InboxMessage>> {
  return call<InboxMessage>(`/${threadId}/messages`, {
    method: "POST",
    body: { message },
  });
}

/**
 * Antwort im Eigentümer-Chat.
 *
 * EIGENER Endpunkt, nicht `/messages`: Diese Threads haben keine Zeile in
 * `channex_booking`, und der Nachrichtenweg ist ein anderer (`owner_messages`).
 * Der Server verschlüsselt den Text selbst (09.09.2026) — er liegt nicht im
 * Klartext in der Datenbank, ist aber im Browser lesbar.
 */
export async function sendEigentuemerNachricht(
  threadId: string,
  text: string,
): Promise<Result<InboxMessage>> {
  return call<InboxMessage>(`/${threadId}/chat`, {
    method: "POST",
    body: { text },
  });
}

/** Reservierungs-Kontext rechts neben dem Chat. */
export async function getInboxReservation(
  threadId: string,
): Promise<Result<ReservationDetail>> {
  return call<ReservationDetail>(`/${threadId}/reservation`);
}

/** Die Anfrage-Karte über dem Chat. */
export async function getAnfrage(
  threadId: string,
): Promise<Result<AnfrageDetail>> {
  return call<AnfrageDetail>(`/${threadId}/anfrage`);
}

/**
 * Die Anfrage bei Airbnb entscheiden. Geht ans Portal, nicht nur in unsere
 * Tabelle — eine rein lokale Quittung ließe den Gast bis zum Auto-Decline
 * warten.
 */
export async function entscheideAnfrage(
  threadId: string,
  input: {
    aktion: AnfrageAktion;
    grund?: string;
    nachricht_an_gast?: string;
    nachricht_an_airbnb?: string;
    sofortbuchung_sperren?: boolean;
    /** GANZZAHL in Minor Units (10000 = 100,00) — nie Haupteinheiten. */
    gesamtpreis_minor?: number;
  },
): Promise<Result<Record<string, unknown>>> {
  return call<Record<string, unknown>>(`/${threadId}/anfrage/entscheiden`, {
    method: "POST",
    body: input,
  });
}

/** Konversations-Flags setzen (Favorit/Notiz/Lesen/Archiv/Erinnerung). */
export async function updateThreadFlags(
  threadId: string,
  input: {
    is_starred?: boolean;
    note?: string;
    is_read?: boolean;
    is_archived?: boolean;
    remind_at?: string;
  },
): Promise<Result<void>> {
  return call<void>(`/${threadId}/flags`, { method: "PUT", body: input });
}

/** KI-Antwortvorschlag aus Gästemappe, Kalender, Verlauf und Buchungskontext.
 *
 *  Anbieter ist seit 29.08.2026 Vertex AI (Gemini) in europe-west4, nicht mehr
 *  Groq: im Prompt stehen Türcode, WLAN-Passwort, Anschrift und Gastname —
 *  diese Daten verlassen die EU nicht.
 *
 *  `fehlende_angabe` ist gesetzt, wenn das Modell eine Wissenslücke gemeldet
 *  hat; `eskaliert`, wenn es negativen Tenor erkannt hat. */
export type AiReplyResponse = {
  reply: string;
  sources: string[];
  fehlende_angabe: string | null;
  eskaliert: boolean;
};

export async function getAiReply(
  threadId: string,
): Promise<Result<AiReplyResponse>> {
  return call<AiReplyResponse>(`/${threadId}/ai-reply`, {
    method: "POST",
    body: {},
  });
}

// --- Vorlagen ---------------------------------------------------------------
/** Eine Nachrichten-Vorlage.
 *
 *  `body_html` ist das AUTORENFORMAT (was der Vorlagen-Editor führt),
 *  `body` der daraus SERVERSEITIG abgeleitete Klartext — und der bleibt die
 *  Versandquelle: die Portale übertragen im Gast-Chat keinen Rich-Text.
 *  `body_html === ""` heißt „noch nie formatiert" (Bestandsvorlage); der
 *  Editor baut seinen Inhalt dann aus `body` auf. */
// --- Sprachen des Betriebs (0363) -------------------------------------------
/** Eine Sprache, in der der Betrieb seine Nachrichten pflegt. Genau eine ist
 *  `is_default` — sie greift, wenn die Sprache des Gastes keine Fassung hat.
 *  Eine LEERE Liste ist gültig: dann gibt es nur die Grundfassung. */
export type MessageLanguage = { code: string; is_default: boolean };

/** Auswählbare Sprache für „Sprache hinzufügen". Der Name kommt vom Server
 *  (eine Quelle: `core.languages`), nicht aus den Sprachdateien. */
export type LanguageOption = { code: string; name: string };

export async function listMessageLanguages(): Promise<
  Result<{ items: MessageLanguage[] }>
> {
  return call<{ items: MessageLanguage[] }>("/languages");
}

/**
 * Der Sprachkatalog des Servers — die Auswahl hinter „Sprache hinzufügen".
 *
 * Die Oberflächensprache geht als `?sprache=` mit, sonst stünden in einer
 * englischen oder italienischen Oberfläche die deutschen Sprachnamen
 * („Englisch, Italienisch" statt „English, Italian"). `getLocale()` ist das
 * Ergebnis der EINEN Auflösungskette des Projekts (`i18n/aufloesung.ts`) —
 * hier wird sie angewendet, nicht neu erfunden (Muster: `lib/announcements`).
 *
 * Betrifft NUR die Namen. Welche Sprachen der Betrieb pflegt und welche
 * Fassungen es gibt, hängt am Tenant und ändert sich mit der Oberfläche nicht.
 */
export async function listAvailableLanguages(): Promise<
  Result<{ items: LanguageOption[] }>
> {
  const locale = await getLocale();
  return call<{ items: LanguageOption[] }>(
    `/languages/available?sprache=${encodeURIComponent(locale)}`,
  );
}

export async function addMessageLanguage(
  code: string,
): Promise<Result<{ items: MessageLanguage[] }>> {
  return call<{ items: MessageLanguage[] }>("/languages", {
    method: "POST",
    body: { code },
  });
}

export async function setDefaultMessageLanguage(
  code: string,
): Promise<Result<{ items: MessageLanguage[] }>> {
  return call<{ items: MessageLanguage[] }>(`/languages/${code}/default`, {
    method: "PUT",
  });
}

export async function removeMessageLanguage(
  code: string,
): Promise<Result<{ items: MessageLanguage[] }>> {
  return call<{ items: MessageLanguage[] }>(`/languages/${code}`, {
    method: "DELETE",
  });
}

export type TranslatedFassung = {
  body: string;
  subject: string | null;
  lang: string;
};

export async function translateFassung(input: {
  body: string;
  subject?: string | null;
  target: string;
  format?: "html" | "text";
}): Promise<Result<TranslatedFassung>> {
  return call<TranslatedFassung>("/languages/translate", {
    method: "POST",
    body: {
      body: input.body,
      subject: input.subject ?? null,
      target: input.target,
      format: input.format ?? "html",
    },
  });
}

/** Sprachfassung einer Vorlage. `body` ist der abgeleitete Klartext (Ausgabe),
 *  geschickt wird nur `body_html` — dieselbe Regel wie bei der Grundfassung. */
export type TemplateText = {
  lang: string;
  subject: string;
  body: string;
  body_html: string;
};

export type MessageTemplate = {
  id: string;
  title: string;
  body: string;
  body_html: string;
  /** Betreff der Grundfassung. Gilt nur für E-Mail (der Gast-Chat der Portale
   *  überträgt keinen Betreff). */
  subject: string;
  texts: TemplateText[];
};

export async function listTemplates(): Promise<
  Result<{ items: MessageTemplate[]; total: number }>
> {
  return call<{ items: MessageTemplate[]; total: number }>("/templates");
}

/** Anlegen/Ändern schicken NUR `body_html`. Ein mitgeschicktes `body` ignoriert
 *  der Server ohnehin — er leitet den Klartext selbst ab, damit es genau EINE
 *  Umwandlung gibt (`felder.html_zu_text`) und nicht zwei, die auseinander
 *  laufen. */
/** Was der Editor je Sprache schickt (kein `body` — s. Kommentar oben). */
export type TemplateTextInput = {
  lang: string;
  subject: string;
  body_html: string;
};

/** `texts` weglassen heißt „Sprachfassungen unangetastet lassen"; eine leere
 *  Liste heißt ausdrücklich „alle entfernen". */
export type TemplateInput = {
  title: string;
  body_html: string;
  subject?: string;
  texts?: TemplateTextInput[];
};

export async function createTemplate(
  input: TemplateInput,
): Promise<Result<MessageTemplate>> {
  return call<MessageTemplate>("/templates", { method: "POST", body: input });
}

export async function updateTemplate(
  id: string,
  input: TemplateInput,
): Promise<Result<MessageTemplate>> {
  return call<MessageTemplate>(`/templates/${id}`, { method: "PUT", body: input });
}

export async function deleteTemplate(id: string): Promise<Result<void>> {
  return call<void>(`/templates/${id}`, { method: "DELETE" });
}

// --- KI-Einstellungen -------------------------------------------------------
export type AiSettings = {
  tone: string;
  language: string;
  signature: string | null;
  extra_prompt: string | null;
  /** Ob die Oberfläche einen Vorschlag anbietet — NICHT, ob die KI selbst
   *  antwortet. Das ist `autoantwort_aktiv`. */
  auto_suggest: boolean;
  /** Der große Schalter (0493). Aus ist die Vorgabe: Autoantwort wird bewusst
   *  eingeschaltet, nie geerbt. */
  autoantwort_aktiv: boolean;
  /** Wartezeit vor dem automatischen Versand. Ihr Sinn ist nicht Rechenzeit,
   *  sondern der Mensch: in diesem Fenster kann ein Mitarbeiter zuvorkommen. */
  autoantwort_verzoegerung_minuten: number;
  /** Wie lang die KI antwortet (0497). Wirkt auf das Token-Budget UND auf eine
   *  Zeile im System-Prompt — nur das Budget zu senken bricht den Satz ab. */
  antwortlaenge: "kurz" | "standard" | "ausfuehrlich";
};

// --- KI-Regeln (0493) -------------------------------------------------------
/** Was die KI zu einem Thema tun soll und wie das Ergebnis zugestellt wird.
 *
 *  „Die KI darf X beantworten" heißt konkret: für X gibt es eine aktive Regel
 *  mit `zustellart: "automatisch"`. Ton, Sprache und Signatur sind bewusst
 *  KEINE Regeln, sondern Einstellungen — als Regel formuliert würden sie auf
 *  jede Nachricht passen und die Zustell-Logik aushebeln. */
export type KiRegel = {
  id: string;
  name: string;
  aktiv: boolean;
  gilt_fuer: "alle" | "auswahl";
  zustellart: "entwurf" | "automatisch";
  anweisung: string;
  /** Antwortet NICHT, sondern meldet. */
  ist_eskalation: boolean;
  /** Markiert den Thread sichtbar im Posteingang. Getrennt von
   *  `benachrichtigen` (E-Mail/Push), weil „nur markieren" der häufigere Fall
   *  ist — wer jede Beschwerde als Mail will, ist ein anderer Betrieb. */
  eskalation_posteingang: boolean;
  benachrichtigen: boolean;
  property_ids: string[];
  verwendet_zaehler: number;
  zuletzt_verwendet_at: string | null;
};

export type KiRegelUpsert = Omit<
  KiRegel,
  "id" | "verwendet_zaehler" | "zuletzt_verwendet_at"
>;

export async function listKiRegeln(): Promise<
  Result<{ items: KiRegel[]; total: number }>
> {
  return call<{ items: KiRegel[]; total: number }>("/ki-regeln");
}

export async function createKiRegel(
  input: KiRegelUpsert,
): Promise<Result<KiRegel>> {
  return call<KiRegel>("/ki-regeln", { method: "POST", body: input });
}

export async function updateKiRegel(
  id: string,
  input: KiRegelUpsert,
): Promise<Result<KiRegel>> {
  return call<KiRegel>(`/ki-regeln/${id}`, { method: "PUT", body: input });
}

export async function deleteKiRegel(id: string): Promise<Result<void>> {
  return call<void>(`/ki-regeln/${id}`, { method: "DELETE" });
}

/** Was die KI getan hat — die Spur zu einer falschen Antwort.
 *
 *  Ohne sie bliebe bei einem Fehler nur das Raten zwischen „Fakt fehlte",
 *  „Regel griff nicht" und „Modell hat sich etwas zurechtgelegt". */
export type KiProtokollEintrag = {
  id: string;
  thread_id: string;
  quelle: "inbox" | "whatsapp";
  regel_id: string | null;
  regel_name: string | null;
  frage_auszug: string | null;
  antwort: string | null;
  zustellart: "entwurf" | "automatisch";
  gesendet_at: string | null;
  quellen: string[];
  weggelassen: string[];
  eskaliert: boolean;
  grund: string | null;
  created_at: string | null;
};

export async function listKiProtokoll(
  threadId?: string,
  limit = 50,
): Promise<Result<{ items: KiProtokollEintrag[]; total: number }>> {
  const q = new URLSearchParams({ limit: String(limit) });
  if (threadId) q.set("thread_id", threadId);
  return call<{ items: KiProtokollEintrag[]; total: number }>(
    `/ki-protokoll?${q.toString()}`,
  );
}

export async function getAiSettings(): Promise<Result<AiSettings>> {
  return call<AiSettings>("/ai-settings");
}

export async function saveAiSettings(
  input: AiSettings,
): Promise<Result<AiSettings>> {
  return call<AiSettings>("/ai-settings", { method: "PUT", body: input });
}

// --- Automatisierungen ------------------------------------------------------
/** Auslöser einer Automatisierung.
 *
 *  Der Auslöser bestimmt Anker UND Richtung (0307): „vor Anreise" ist der Anker
 *  Anreise mit negativem Versatz. Beides wird serverseitig daraus abgeleitet —
 *  die Maske fragt nur noch nach dem Betrag.
 *
 *  `message_received` (Abwesenheitsantwort) hängt an keinem Datum der
 *  Reservierung, sondern am Eingang einer Nachricht — dort sind anchor/
 *  offset_days/send_time bedeutungslos und stattdessen die window_*-Felder
 *  maßgeblich. */
export type AutomationTrigger =
  | "booking_new"
  | "before_checkin"
  /** Am Anreisetag selbst, zur festen Uhrzeit — kein Abstand (0515). */
  | "on_checkin"
  | "after_checkin"
  | "before_checkout"
  /** Am Abreisetag selbst (0515). */
  | "on_checkout"
  | "after_checkout"
  | "message_received";

/** Einheit des Versatzes zum Anker (0303). */
export type AutomationOffsetUnit = "minutes" | "hours" | "days";

export type Automation = {
  id: string;
  name: string;
  trigger: AutomationTrigger;
  // anchor: Bezugsdatum (arrival|departure|booking) — vom Server aus `trigger`
  // ABGELEITET, beim Schreiben ignoriert. offset_value = vorzeichenbehafteter
  // Versatz in offset_unit; property_ids/channels leer = alle.
  anchor: string;
  /** Tages-Sicht des Versatzes (Bestand). Bei Stunden/Minuten 0. */
  offset_days: number;
  // Optional, weil ein Server VOR 0303 sie nicht mitschickt. Ohne dieses `?`
  // hielt TypeScript sie für garantiert — und die Liste kippte zur Laufzeit mit
  // `autoUnit_undefined`, statt beim Übersetzen aufzufallen. Leser nehmen
  // ersatzweise die Tages-Sicht.
  offset_unit?: AutomationOffsetUnit;
  offset_value?: number;
  /** "HH:MM" oder null = keine feste Uhrzeit (bei Tagen: Mitternacht). */
  send_time: string | null;
  property_ids: string[];
  channels: string[];
  template_id: string | null;
  message: string | null;
  is_active: boolean;
  /** Sendezeit in der Zeitzone des Objekts auflösen statt in UTC. Ohne
   *  hinterlegte Zeitzone plant der Server für dieses Objekt NICHT. */
  use_property_timezone: boolean;
  /** Nur message_received: nur die erste Gastnachricht des Threads. */
  only_first_message: boolean;
  /** Nur message_received: Wochentage, an denen ausgelöst werden darf
   *  (0 = Montag … 6 = Sonntag). Leer = alle Tage. */
  window_days: number[];
  /** Nur message_received: Zeitfenster "HH:MM". Ende vor Anfang = über
   *  Mitternacht (22:00–06:00). Beide oder keines. */
  window_from: string | null;
  window_to: string | null;
  /** Betreff der Grundfassung (nur E-Mail). */
  subject?: string;
  /** Sprachfassungen des Freitexts (0363). Nur Klartext — der Gast-Chat der
   *  Portale überträgt kein HTML. */
  texts?: AutomationText[];
};

export type AutomationText = { lang: string; subject: string; message: string };

export type AutomationInput = Omit<Automation, "id">;

export async function listAutomations(): Promise<
  Result<{ items: Automation[]; total: number }>
> {
  return call<{ items: Automation[]; total: number }>("/automations");
}

export async function createAutomation(
  input: AutomationInput,
): Promise<Result<Automation>> {
  return call<Automation>("/automations", { method: "POST", body: input });
}

export async function updateAutomation(
  id: string,
  input: AutomationInput,
): Promise<Result<Automation>> {
  return call<Automation>(`/automations/${id}`, { method: "PUT", body: input });
}

export async function deleteAutomation(id: string): Promise<Result<void>> {
  return call<void>(`/automations/${id}`, { method: "DELETE" });
}

/**
 * EINE Regel frisch vom Server — VOR jedem Schreiben.
 *
 * `updateAutomation` nimmt den vollen Datensatz. Wer dafür eine Kopie
 * benutzt, die beim Öffnen des Panels geladen wurde, schreibt jede
 * zwischenzeitliche Änderung eines Kollegen zurück auf den alten Stand: ein
 * Haken am Kanal setzt dann nebenbei den Text zurück, den jemand anders
 * gerade gespeichert hat. Ein Realtime-Abo gäbe es hier nicht als Ausweg —
 * `message_automation` ist seit 0337 für `authenticated` gesperrt, ein Abo
 * wäre eine stumme Attrappe (Wurzel 6).
 *
 * Bewusst über die Liste und nicht über einen eigenen GET: der Server führt
 * keinen `/automations/{id}`-Lesepfad, und einen dafür zu erfinden hieße, eine
 * zweite Ladelogik samt Scope zu pflegen.
 */
export async function getAutomation(id: string): Promise<Result<Automation>> {
  const res = await listAutomations();
  if (!res.ok) return res;
  const treffer = res.data.items.find((a) => a.id === id);
  return treffer
    ? { ok: true, data: treffer }
    : { ok: false, error: "Automatisierung nicht gefunden." };
}

// --- Zustand der Automatisierungen (Versandprotokoll) -------------------------
/** Was eine Regel bisher getan hat — verdichtet aus `automation_scheduled_message`. */
export type AutomationStand = {
  automation_id: string;
  pending: number;
  /** Atomarer Claim kurz vor dem Versand; zählt in der Anzeige zu „geplant". */
  sending: number;
  sent: number;
  failed: number;
  skipped: number;
  cancelled: number;
  gesamt: number;
  /** Grund des jüngsten Fehlschlags; null = keiner (nie ein Ersatztext). */
  letzter_fehler: string | null;
  letzter_fehler_am: string | null;
  /** Frühester geplanter Versand über alle offenen Zeilen. */
  naechster_versand: string | null;
};

export type AutomationStandListe = {
  items: AutomationStand[];
  total: number;
  /** Die Obergrenze hat gegriffen — die Zahlen sind dann unvollständig und
   *  werden in der Oberfläche als solche benannt (Wurzel 4). */
  gekappt: boolean;
};

/** Eine Zeile des Versandprotokolls (ohne Nachrichtentext). */
export type AutomationNachricht = {
  id: string;
  status: string;
  /** Geplanter Zeitpunkt. */
  send_at: string | null;
  /** Wann WIR die Zeile zuletzt angefasst haben (Versand, Fehlschlag). Das ist
   *  unsere Uhr und ausdrücklich kein Fremdereignis (Wurzel 5b). */
  updated_at: string | null;
  last_error: string | null;
  /** Die Buchung dahinter (14.09.2026) — damit der Betrieb sieht, WEN es betrifft. */
  thread_id: string | null;
  gast: string | null;
  ota_name: string | null;
  arrival_date: string | null;
  departure_date: string | null;
  property_id: string | null;
  objekt: string | null;
  /** Platzhalter ohne Wert laut Fehlertext; `heute_leer` = davon am Objekt noch leer. */
  fehlende_felder: string[];
  heute_leer: string[];
};

/** Fehlgeschlagene/übersprungene Zeile erneut einplanen — Versand im nächsten
 *  Minutentakt mit den heutigen Werten. 'sent' lehnt der Server ab (409). */
export async function retryAutomationNachricht(
  id: string,
): Promise<Result<AutomationNachricht>> {
  return call<AutomationNachricht>(`/automations/nachrichten/${id}/erneut`, {
    method: "POST",
  });
}

/** Alle fehlgeschlagenen Zeilen EINER Regel erneut einplanen. */
export async function retryAllFailedAutomation(
  automationId: string,
): Promise<Result<{ erneut: number }>> {
  return call<{ erneut: number }>(`/automations/${automationId}/erneut-alle`, {
    method: "POST",
  });
}

export async function getAutomationStand(): Promise<Result<AutomationStandListe>> {
  return call<AutomationStandListe>("/automations/stand");
}

export async function listAutomationNachrichten(
  id: string,
  limit = 10,
): Promise<Result<{ items: AutomationNachricht[]; total: number }>> {
  return call<{ items: AutomationNachricht[]; total: number }>(
    `/automations/${id}/nachrichten?limit=${limit}`,
  );
}

// --- Platzhalter (Felder) -----------------------------------------------------
/** Ein Platzhalter, der in Vorlagen und Automationen benutzt werden kann.
 *  `key` ist sprachneutral und stabil (`{{guest_name}}`); die Beschriftung
 *  kommt aus den Sprachdateien (`inbox.field_<key>`), damit eine Vorlage einen
 *  Sprachwechsel der Oberfläche unbeschadet übersteht. */
export type FieldEntry = {
  key: string;
  group: "guest" | "reservation" | "property" | "company";
};

export async function listFields(): Promise<Result<{ items: FieldEntry[] }>> {
  return call<{ items: FieldEntry[] }>("/fields");
}

/** Text mit den Daten DIESER Konversation auflösen — Vorschau beim Einfügen
 *  einer Vorlage, damit niemand `{{guest_name}}` an einen Gast schickt.
 *  Fehlt der Wert eines benutzten Feldes, antwortet der Server mit 422 und
 *  nennt das Feld; dann steht die Reservierung unvollständig da. */
export async function renderForThread(
  threadId: string,
  text: string,
): Promise<Result<{ text: string }>> {
  return call<{ text: string }>(`/${threadId}/render`, {
    method: "POST",
    body: { text },
  });
}

// --- Anhänge ------------------------------------------------------------------
export type Attachment = {
  id: string;
  filename: string;
  mime: string;
  size: number;
  /** Befristet signierte Download-URL (privater Bucket). */
  url: string | null;
  created_at: string | null;
  /** Gesetzt, sobald an den Kanal übergeben. NULL = liegt nur bei uns. */
  sent_at: string | null;
  /** Warum der Kanal die Datei abgelehnt hat (Airbnb nimmt kein PDF). */
  channel_error: string | null;
};

export async function listAttachments(
  threadId: string,
): Promise<Result<{ items: Attachment[]; total: number }>> {
  return call<{ items: Attachment[]; total: number }>(`/${threadId}/attachments`);
}

export async function deleteAttachment(id: string): Promise<Result<void>> {
  return call<void>(`/attachments/${id}`, { method: "DELETE" });
}

// --- KI-Wissensdatenbank -------------------------------------------------------
export type KnowledgeFact = {
  id: string;
  /** null = gilt betriebsweit, sonst nur für dieses Objekt. */
  property_id: string | null;
  property_title: string | null;
  /** null bei Altbestand aus 0260 — dann zeigt die Liste den Textanfang. */
  titel: string | null;
  fact: string;
  kategorie: WissenKategorie;
  source: WissenQuelle;
  source_ref: string | null;
  quelle_id: string | null;
  /** Dateiname der Herkunft, nur bei Fakten aus einem Dokument. */
  quelle_datei: string | null;
  created_at: string | null;
  updated_at: string | null;
};

/** Eine Zeile der Objektliste (Ebene 1). `fakten` ist die Botschaft dieser
 *  Ansicht: sie zeigt auf einen Blick, welche Objekte gepflegt sind. */
export type WissenObjekt = {
  property_id: string;
  titel: string;
  ort: string | null;
  foto_url: string | null;
  fakten: number;
  geaendert_at: string | null;
};

export type WissenObjektListe = {
  items: WissenObjekt[];
  total: number;
  seite: number;
  pro_seite: number;
  betriebsweit_fakten: number;
  betriebsweit_geaendert_at: string | null;
};

export type WissenFilter = {
  propertyId?: string;
  /** true = NUR dieses Objekt. Ohne das Flag kommen die betriebsweiten mit —
   *  so ruft der KI-Pfad auf, denn beim Beantworten gelten sie zusammen. */
  nurDiesesObjekt?: boolean;
  betriebsweit?: boolean;
  suche?: string;
  kategorien?: WissenKategorie[];
  quellen?: WissenQuelle[];
  sortierung?: "titel" | "kategorie" | "quelle" | "geaendert";
  absteigend?: boolean;
  seite?: number;
  proSeite?: number;
};

export async function listWissenObjekte(input: {
  suche?: string;
  sortierung?: "objekt" | "ort" | "geaendert";
  absteigend?: boolean;
  seite?: number;
  proSeite?: number;
}): Promise<Result<WissenObjektListe>> {
  const q = new URLSearchParams();
  if (input.suche) q.set("suche", input.suche);
  if (input.sortierung) q.set("sortierung", input.sortierung);
  if (input.absteigend) q.set("absteigend", "true");
  if (input.seite) q.set("seite", String(input.seite));
  if (input.proSeite) q.set("pro_seite", String(input.proSeite));
  const s = q.toString();
  return call<WissenObjektListe>(`/knowledge/objekte${s ? `?${s}` : ""}`);
}

export async function listKnowledge(
  filter: WissenFilter | string = {},
): Promise<Result<{ items: KnowledgeFact[]; total: number; seite: number; pro_seite: number }>> {
  // Ein blosser String bleibt erlaubt: der KI-Pfad ruft weiter mit der
  // Objekt-ID auf und will dort ausdrücklich die betriebsweiten Fakten mit.
  const f: WissenFilter = typeof filter === "string" ? { propertyId: filter } : filter;
  const q = new URLSearchParams();
  if (f.propertyId) q.set("property_id", f.propertyId);
  if (f.nurDiesesObjekt) q.set("nur_dieses_objekt", "true");
  if (f.betriebsweit) q.set("betriebsweit", "true");
  if (f.suche) q.set("suche", f.suche);
  for (const k of f.kategorien ?? []) q.append("kategorie", k);
  for (const s of f.quellen ?? []) q.append("quelle", s);
  if (f.sortierung) q.set("sortierung", f.sortierung);
  if (f.absteigend === false) q.set("absteigend", "false");
  if (f.seite) q.set("seite", String(f.seite));
  if (f.proSeite) q.set("pro_seite", String(f.proSeite));
  const s = q.toString();
  return call<{ items: KnowledgeFact[]; total: number; seite: number; pro_seite: number }>(
    `/knowledge${s ? `?${s}` : ""}`,
  );
}

export type KnowledgeFactInput = {
  property_id: string | null;
  titel: string | null;
  fact: string;
  kategorie: WissenKategorie;
};

export async function createKnowledge(
  input: KnowledgeFactInput,
): Promise<Result<KnowledgeFact>> {
  return call<KnowledgeFact>("/knowledge", { method: "POST", body: input });
}

export async function updateKnowledge(
  id: string,
  input: KnowledgeFactInput,
): Promise<Result<KnowledgeFact>> {
  return call<KnowledgeFact>(`/knowledge/${id}`, { method: "PUT", body: input });
}

export async function deleteKnowledge(id: string): Promise<Result<void>> {
  return call<void>(`/knowledge/${id}`, { method: "DELETE" });
}

/** Sammellöschen aus der Mehrfachauswahl. POST statt DELETE-mit-Rumpf: solche
 *  Anfragen behandeln Proxys und fetch-Wrapper unterschiedlich. */
export async function deleteKnowledgeBulk(
  ids: string[],
): Promise<Result<{ updated: number }>> {
  return call<{ updated: number }>("/knowledge/bulk-delete", {
    method: "POST",
    body: { ids },
  });
}

/** Datei an eine Konversation hängen (multipart) und an den Kanal übergeben.
 *  Der Upload gelingt auch, wenn der Kanal die Datei ablehnt — dann trägt der
 *  Anhang `channel_error` und `sent_at` bleibt leer. */
export async function uploadAttachment(
  threadId: string,
  file: File,
  message?: string,
): Promise<Result<Attachment>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };

  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  const form = new FormData();
  form.append("file", file);
  const params = new URLSearchParams({ filename: file.name });
  if (message) params.set("message", message);
  try {
    const res = await fetch(
      `${base}/api/v1/inbox/${threadId}/attachments?${params.toString()}`,
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
    return { ok: true, data: (await res.json()) as Attachment };
  } catch {
    return { ok: false, error: "Backend nicht erreichbar." };
  }
}

// --- PDF-Import in die Wissensdatenbank ---------------------------------------
/** Ein Faktenvorschlag aus einem Dokument — NOCH NICHT gespeichert.
 *
 *  Der Import ist zweistufig: erst lesen, dann ein Mensch wählt aus. Ein
 *  Dokument, das ungeprüft einfliesst, macht die KI zur Sprecherin eines
 *  Textes, den niemand gelesen hat — samt veralteter Preise und alter
 *  Türcodes. */
export type WissenImportVorschlag = {
  titel: string | null;
  fact: string;
  kategorie: WissenKategorie;
  /** "betrag" | "jahr" | null — wo ein Preis oder eine Jahreszahl steht, wird
   *  gewarnt: ein alter Preis ist eine falsche Zusage und sieht aus wie eine
   *  richtige. */
  warnung: string | null;
};

export type WissenImportVorschau = {
  quelle_id: string;
  datei_name: string;
  items: WissenImportVorschlag[];
};

/** Schritt 1: PDF ablegen und Vorschläge holen. Legt KEINE Fakten an. */
export async function wissenDokumentLesen(
  file: File,
  propertyId: string | null,
): Promise<Result<WissenImportVorschau>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };

  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  const form = new FormData();
  form.append("file", file);
  if (propertyId) form.append("property_id", propertyId);
  try {
    const res = await fetch(`${base}/api/v1/inbox/knowledge/import`, {
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
    return { ok: true, data: (await res.json()) as WissenImportVorschau };
  } catch {
    return { ok: false, error: "Backend nicht erreichbar." };
  }
}

/** Schritt 2: die angehakten Vorschläge als Fakten anlegen. */
export async function wissenImportUebernehmen(input: {
  quelle_id: string;
  property_id: string | null;
  items: WissenImportVorschlag[];
}): Promise<Result<{ updated: number }>> {
  return call<{ updated: number }>("/knowledge/import/apply", {
    method: "POST",
    body: input,
  });
}

// --- Test-KI und Kontext-Panel ------------------------------------------------
/** Ein Abschnitt des Kontext-Panels — der TEXT, der in den Prompt geht, nicht
 *  eine Beschreibung davon. Eine Beschreibung wäre eine zweite Wahrheit neben
 *  dem Prompt und liefe auseinander. */
export type KiKontextAbschnitt = {
  titel: string;
  inhalt: string;
  quelle: string;
  zeichen: number;
};

export type KiKontextAntwort = {
  abschnitte: KiKontextAbschnitt[];
  quellen: string[];
  /** Was NICHT mitkam und warum — gekürzt, kein Platz mehr, oder gesperrt.
   *  Ein gesperrter Abschnitt steht hier ausdrücklich: sonst sucht jemand den
   *  Fehler in der Gästemappe, wo gar keiner ist. */
  weggelassen: string[];
  zugang_gesperrt: boolean;
  zeichen: number;
  max_zeichen: number;
};

export type KiTestAntwort = {
  antwort: string;
  kontext: KiKontextAntwort;
  /** Was im ERNSTFALL passiert wäre. Das ist der Sinn des Tests, nicht der
   *  Antworttext: griff eine Regel, schlug eine Sperre zu? */
  zustellart: "entwurf" | "automatisch";
  grund: string;
  regel_name: string | null;
  /** Gesetzt, wenn die Antwort eine Wissenslücke meldet. */
  fehlende_angabe: string | null;
};

export async function getKiKontext(input: {
  propertyId?: string;
  frage?: string;
}): Promise<Result<KiKontextAntwort>> {
  const q = new URLSearchParams();
  if (input.propertyId) q.set("property_id", input.propertyId);
  if (input.frage) q.set("frage", input.frage);
  const s = q.toString();
  return call<KiKontextAntwort>(`/ki-kontext${s ? `?${s}` : ""}`);
}

/** Eine Testfrage stellen. Es geht NICHTS an einen Gast. */
export async function kiTesten(input: {
  property_id: string | null;
  frage: string;
  verlauf: string[];
}): Promise<Result<KiTestAntwort>> {
  return call<KiTestAntwort>("/ki-test", { method: "POST", body: input });
}

// --- Eskalation (0498) --------------------------------------------------------
/** Ein eskalierter Verlauf. `ausloeser` trennt die zwei Wege: "stimmung" hat
 *  das Modell erkannt, "regel" hat der Betrieb formuliert. Für die Anzeige
 *  derselbe Kasten, für die Diagnose ein Unterschied. */
export type KiEskalation = {
  id: string;
  thread_id: string;
  quelle: "inbox" | "whatsapp";
  ausloeser: "stimmung" | "regel";
  regel_id: string | null;
  grund: string;
  nachricht_auszug: string | null;
  created_at: string | null;
};

export async function listKiEskalationen(): Promise<
  Result<{ items: KiEskalation[]; total: number }>
> {
  return call<{ items: KiEskalation[]; total: number }>("/ki-eskalationen");
}

/** Die Eskalation zurücknehmen. Nur ein Mensch kann das — eine Markierung, die
 *  sich selbst abräumt, ist keine Aufgabe. */
export async function eskalationErledigen(
  threadId: string,
): Promise<Result<void>> {
  return call<void>(`/ki-eskalationen/${threadId}/erledigt`, { method: "POST" });
}
