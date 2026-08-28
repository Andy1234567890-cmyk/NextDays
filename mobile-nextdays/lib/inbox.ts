// Posteingang — gegen den FastAPI-inbox-Slice (/api/v1/inbox), gespiegelt aus
// web/lib/inbox.ts. Nur die Pfade, die die App braucht: Thread-Liste,
// Nachrichten, Antwort senden, Reservierungsdetails und die Entscheidung über
// eine Portal-ANFRAGE (Etappe 1 der Mobil-Angleichung).
//
// Die Anfrage ist der Grund, warum dieser Bereich überhaupt aufs Telefon
// gehört: sie hat eine FRIST, und Airbnb lehnt nach deren Ablauf selbst ab —
// Untätigkeit ist dort eine Absage. Genau das passiert, wenn die Entscheidung
// nur am Schreibtisch möglich ist.
import { call, type Result } from "@/lib/api";

export type InboxThread = {
  id: string;
  channex_booking_id: string | null;
  reservation_id: string | null;
  guest_id: string | null;
  property_id: string | null;
  property_title: string | null;
  ota_name: string | null;
  ota_reservation_code: string | null;
  guest_name: string | null;
  guest_email: string | null; // maskiert (null ohne Kontakt-Sicht)
  status: string | null;
  arrival_date: string | null;
  departure_date: string | null;
  last_message: string | null;
  /**
   * WANN in diesem Vorgang zuletzt etwas PASSIERT ist — beim Portal, nicht bei
   * uns. Der Server bildet ihn aus dem Buchungszeitpunkt, der letzten
   * Portal-Nachricht und (bei einer Airbnb-Anfrage) dem Zeitpunkt der
   * Gasthandlung; fehlt jede Quelle, ist er `null`.
   *
   * NICHT `updated_at` dafür nehmen: das ist UNSERE Schreibzeit. Als der Feed
   * 22 Airbnb-Buchungen in einem Rutsch holte, trugen alle dieselbe Sekunde und
   * die Liste war zufällig sortiert (Wurzel 5b).
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
  sender: "guest" | "property" | "note";
  sent_at: string | null;
  author_name?: string | null;
  /**
   * Bildanhänge. Schickt der Gast NUR ein Foto, ist `message` leer — dann
   * trägt allein diese Liste den Inhalt. Der Server hat jede URL auf https +
   * bekannten Host geprüft (`inbox.spiegel.sichere_anhaenge`).
   */
  attachments?: string[];
};

/**
 * Vorschautext einer Nachricht, die nur aus Bildern besteht. Der Server legt
 * dieses sprachneutrale Kürzel ab (er kennt die Sprache des Betrachters
 * nicht); die Worte macht die Oberfläche.
 *
 * Muss mit `NUR_ANHANG_TEXT` in
 * `apps/api/.../channel_manager/common.py` übereinstimmen.
 */
export const NUR_ANHANG_TEXT = "[attachment]";

/** Thread-Liste (default: aktive). */
export async function listInboxThreads(
  opts: { unassigned?: boolean; status?: "active" | "archived" | "trashed" } = {},
): Promise<Result<{ items: InboxThread[]; total: number }>> {
  const params = new URLSearchParams();
  if (opts.unassigned) params.set("unassigned", "true");
  if (opts.status && opts.status !== "active") params.set("status", opts.status);
  const qs = params.toString() ? `?${params.toString()}` : "";
  return call(`/inbox${qs}`);
}

/** Nachrichten eines Threads (chronologisch). */
export async function getInboxMessages(
  threadId: string,
): Promise<Result<{ items: InboxMessage[]; total: number }>> {
  return call(`/inbox/${encodeURIComponent(threadId)}/messages`);
}

/**
 * Konversation als gelesen markieren.
 *
 * Gehört zum ÖFFNEN, nicht zu einer eigenen Aktion: die App zeigte den Verlauf
 * an und ließ den Thread trotzdem ungelesen — der Zähler blieb stehen, bis
 * jemand am Rechner denselben Thread aufmachte. Der Server hängt daran zwei
 * Dinge: `is_read` und `read_at`, und nur beide zusammen tragen den Lesestand
 * (`inbox.service._ist_gelesen`).
 */
export async function markInboxThreadRead(
  threadId: string,
): Promise<Result<void>> {
  return call(`/inbox/${encodeURIComponent(threadId)}/flags`, {
    method: "PUT",
    body: { is_read: true },
  });
}

/** Antwort an den Gast senden (zurück an die OTA). */
export async function sendInboxMessage(
  threadId: string,
  message: string,
): Promise<Result<InboxMessage>> {
  return call(`/inbox/${encodeURIComponent(threadId)}/messages`, {
    method: "POST",
    body: { message },
  });
}

// --- Reservierung zum Thread ------------------------------------------------

/**
 * Buchungsdetails hinter einem Thread. Alle Personen- und Betragsfelder kommen
 * SERVERSEITIG maskiert (`inbox/service.py`, `access.mask`): fehlt dem
 * Betrachter die Sicht, steht hier `null` — kein Grund, in der App etwas zu
 * ersetzen (Wurzel 4).
 */
export type ReservationDetail = {
  listing_name: string | null;
  listing_photo: string | null;
  address: string | null;
  guest_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  guest_language: string | null;
  guest_location: string | null;
  /** Aus einem Bestands-Import statt live eingegangen — erklärt leere Felder. */
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

export async function getInboxReservation(
  threadId: string,
): Promise<Result<ReservationDetail>> {
  return call(`/inbox/${threadId}/reservation`);
}

// --- Portal-Anfragen (0398) -------------------------------------------------

/**
 * Thread-Präfixe des Servers. Ein Posteingang führt VIER Arten, die nicht alle
 * an einer Buchung hängen:
 *   `anfrage:` Portal-Anfrage (noch keine Buchung, `inbox/anfragen.py`)
 *   `mb:`      myBestDays-Marktplatz (`inbox/marktplatz.py`)
 *   `ue:`      übernommener Verlauf aus einem fremden PMS (`inbox/uebernahme.py`)
 *   `wa:`      WhatsApp-Konversation
 * Ohne Präfix: eine echte OTA-Buchung (UUID von `channex_booking`).
 */
/**
 * ISO-Zeichenkette → Millisekunden zum VERGLEICHEN (nie zum Anzeigen).
 *
 * Ohne Wert `0`, damit zeitlose Vorgänge ans ENDE einer absteigenden
 * Sortierung fallen statt sie als „1970" anzuführen.
 */
export function zeitWert(iso: string | null): number {
  if (!iso) return 0;
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

/**
 * „Neueste zuerst" für die Vorgangsliste.
 *
 * Der Schlüssel ist `letzte_aktivitaet` — wann beim PORTAL zuletzt etwas
 * passiert ist —, NIE `updated_at`: das ist unsere Schreibzeit. Holte der Feed
 * viele Buchungen in einem Rutsch, trugen alle dieselbe Sekunde und die Liste
 * war zufällig sortiert (Wurzel 5b).
 *
 * Verglichen wird der ZEITPUNKT, nicht die Zeichenkette: derselbe Augenblick
 * kommt in zwei Schreibweisen an (`…+00:00` aus PostgREST, `…Z` vom Portal),
 * und „Z" > „+" im Zeichenvergleich kehrte die Reihenfolge genau dann um, wenn
 * beide Formate gemischt auftreten.
 */
export function nachAktivitaet(a: InboxThread, b: InboxThread): number {
  return zeitWert(b.letzte_aktivitaet) - zeitWert(a.letzte_aktivitaet);
}

export const THREAD_PRAEFIXE = ["anfrage:", "mb:", "ue:", "wa:"] as const;

/** Thread-IDs von Anfragen tragen diesen Präfix (Server: `anfragen.PREFIX`). */
export function istAnfrageThread(threadId: string): boolean {
  return threadId.startsWith("anfrage:");
}

/**
 * Hängt dieser Thread an einer BUCHUNG (`channex_booking`)?
 *
 * WOFÜR: `scheduled`, `attachments` und `reservation` sind über die
 * Buchungs-UUID verknüpft. Für jeden Sonder-Thread antwortet der Server dort mit
 * 422/404 — und zwar bei JEDEM Öffnen. Genau das war der Fehler: das Sheet blieb
 * leer und sah aus wie „keine Anhänge vorhanden", während der Aufruf gar nicht
 * durchging. Lieber nicht fragen, als einen erwartbaren Fehler zu erzeugen und
 * ihn dann als Ergebnis auszugeben (Wurzel 5).
 */
export function istBuchungsThread(threadId: string): boolean {
  return !THREAD_PRAEFIXE.some((p) => threadId.startsWith(p));
}

/** Die vier von Airbnb erlaubten Ablehnungsgründe — ein eigener wäre ein 422. */
export const ABLEHNUNGSGRUENDE = [
  "dates_not_available",
  "not_a_good_fit",
  "waiting_for_better_reservation",
  "not_comfortable",
] as const;

export type AnfrageAktion =
  | "annehmen"
  | "ablehnen"
  | "vorab_genehmigen"
  | "sonderpreis"
  | "alteration_annehmen"
  | "alteration_ablehnen"
  | "alteration_zuruecknehmen";

/**
 * Eine offene Portal-Anfrage — Voranfrage, Buchungsanfrage oder
 * Änderungswunsch. KEINE Buchung: der Gast wartet auf eine Entscheidung.
 */
export type AnfrageDetail = {
  thread_id: string;
  event_id: string;
  /** inquiry | reservation_request | alteration_request */
  art: string;
  /**
   * Die für GENAU DIESE Anfrageart erlaubten Aktionen. Die Oberfläche zeigt nur
   * sie — eine Voranfrage kennt kein „annehmen", ein Änderungswunsch keinen
   * Sonderpreis. Nie aus der Art selbst ableiten, immer diese Liste nehmen.
   */
  aktionen: string[];
  beantwortbar: boolean;
  /** Kürzel, kein Satz: die Worte macht die Oberfläche. */
  grund_gesperrt: string | null;
  /** "portal" = das Portal sagt es; "abgeleitet" = wir schließen es. */
  status_quelle: string;
  /**
   * Airbnbs `non_response_at`. null = das Portal nennt keine Frist — dann KEIN
   * Countdown zeigen, statt 24 Stunden zu raten (Wurzel 4).
   */
  frist: string | null;
  objekt: string | null;
  gastname: string | null;
  anreise: string | null;
  abreise: string | null;
  naechte: string | null;
  gaeste: string | null;
  erwachsene: string | null;
  kinder: string | null;
  kleinkinder: string | null;
  tiere: string | null;
  /** Airbnbs `payout_amount` — NETTO-Auszahlung, NICHT der Gastpreis. */
  payout_betrag: string | null;
  waehrung: string | null;
};

export async function getAnfrage(
  threadId: string,
): Promise<Result<AnfrageDetail>> {
  return call(`/inbox/${threadId}/anfrage`);
}

/**
 * Die Anfrage beim Portal entscheiden. Geht ans Portal, nicht nur in unsere
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
  return call(`/inbox/${threadId}/anfrage/entscheiden`, {
    method: "POST",
    body: input,
  });
}

// --- Antwort-Werkzeuge (Etappe 2) -------------------------------------------
//
// Was das Telefon davon braucht und was nicht: Vorlagen werden EINGEFÜGT, nicht
// verwaltet (Anlegen/Ändern bleibt am Schreibtisch, dort ist der mehrsprachige
// Editor). Der KI-Vorschlag ist ein Entwurf, nie ein Versand: er landet im
// Eingabefeld und wird von Hand abgeschickt.

/**
 * Eine Nachrichten-Vorlage. `body` ist der serverseitig abgeleitete KLARTEXT —
 * und nur der wird verschickt: die Portale übertragen im Gast-Chat keinen
 * Rich-Text. Das Autorenformat (`body_html` im Web) braucht die App deshalb
 * nicht.
 */
export type MessageTemplate = {
  id: string;
  title: string;
  body: string;
  subject: string;
};

export async function listTemplates(): Promise<
  Result<{ items: MessageTemplate[]; total: number }>
> {
  return call("/inbox/templates");
}

/**
 * Platzhalter mit den Daten DIESES Threads auflösen — Pflicht vor dem Einfügen
 * einer Vorlage, damit niemand `{{guest_name}}` an einen Gast schickt.
 *
 * Fehlt der Wert eines benutzten Feldes, antwortet der Server mit 422 und nennt
 * das Feld. Das ist kein Anlass, den Platzhalter stehen zu lassen: dann ist die
 * Reservierung unvollständig, und der Text darf so nicht raus (Wurzel 4/5).
 */
export async function renderForThread(
  threadId: string,
  text: string,
): Promise<Result<{ text: string }>> {
  return call(`/inbox/${threadId}/render`, {
    method: "POST",
    body: { text },
  });
}

/**
 * KI-Antwortvorschlag aus Verlauf und Buchungskontext. `sources` nennt die
 * Wissensfakten, auf die er sich stützt — die Oberfläche zeigt sie, damit
 * niemand einen erfundenen Satz für belegt hält.
 */
export async function getAiReply(
  threadId: string,
): Promise<Result<{ reply: string; sources: string[] }>> {
  return call(`/inbox/${threadId}/ai-reply`, { method: "POST", body: {} });
}

/**
 * Übersetzung einer einzelnen Nachricht (content-Slice, wie im Web).
 *
 * Das Ergebnis wird NICHT gespeichert: es ist eine Lesehilfe, keine Tatsache —
 * geschrieben hat der Gast sein Original, und das bleibt die Quelle.
 */
export async function translateText(
  text: string,
  target: string,
): Promise<Result<{ text: string; detected_source: string | null }>> {
  return call("/content/translate", {
    method: "POST",
    body: { text, target, fmt: "text" },
  });
}

// --- Geplantes Senden --------------------------------------------------------

export type ScheduledMessage = {
  id: string;
  thread_id: string;
  body: string;
  send_at: string;
  status: string;
};

export async function listScheduled(
  threadId: string,
): Promise<Result<{ items: ScheduledMessage[]; total: number }>> {
  return call(`/inbox/${threadId}/scheduled`);
}

/** `sendAt` ist ein ISO-Zeitpunkt; der Server weist Vergangenheit ab. */
export async function scheduleMessage(
  threadId: string,
  body: string,
  sendAt: string,
): Promise<Result<ScheduledMessage>> {
  return call(`/inbox/${threadId}/scheduled`, {
    method: "POST",
    body: { body, send_at: sendAt },
  });
}

export async function cancelScheduled(
  scheduledId: string,
): Promise<Result<void>> {
  return call(`/inbox/scheduled/${scheduledId}`, { method: "DELETE" });
}

// --- Anhänge -----------------------------------------------------------------

export type Attachment = {
  id: string;
  filename: string;
  mime: string;
  size: number;
  /** Befristet signierte URL (der Bucket ist privat). */
  url: string | null;
  created_at: string | null;
  /** Gesetzt, sobald an den Kanal übergeben. null = liegt nur bei uns. */
  sent_at: string | null;
  /** Warum der Kanal die Datei abgelehnt hat (Airbnb nimmt kein PDF). */
  channel_error: string | null;
};

export async function listAttachments(
  threadId: string,
): Promise<Result<{ items: Attachment[]; total: number }>> {
  return call(`/inbox/${threadId}/attachments`);
}

export async function deleteAttachment(id: string): Promise<Result<void>> {
  return call(`/inbox/attachments/${id}`, { method: "DELETE" });
}

/**
 * Eine Datei an die Konversation haengen und an den Kanal uebergeben.
 *
 * Bis 28.08.2026 gab es das in der App NICHT — die Anhang-Ansicht sagte
 * ausdruecklich „Hochladen geht derzeit nur im Dashboard". Gefehlt hat genau
 * diese Funktion: `listAttachments` und `deleteAttachment` standen laengst da,
 * die Dateiauswahl (`lib/foto.ts`) ebenso, und der Endpunkt existiert seit
 * jeher (`apps/api/.../inbox/router.py`, `POST /{thread_id}/attachments`).
 *
 * Multipart wie beim Foto-Nachweis an Aufgaben (`lib/tasks.ts`): React Native
 * schickt Dateien als `{uri, name, type}`, nicht als `Blob`. `call()` erkennt
 * FormData selbst und setzt dann KEINEN Content-Type — die Boundary muss die
 * Laufzeit bestimmen.
 *
 * `filename` gehoert in die Query, nicht ins Formular: so liest es der Server
 * (`request.query_params.get("filename")`). Der mitgeschickte `type` ist nur
 * ein Hinweis — entschieden wird ueber die Magic-Bytes (Wurzel 8).
 *
 * Ein Fehlschlag beim KANAL ist kein Fehlschlag des Uploads: die Datei liegt
 * dann bei uns, `sent_at` bleibt leer und `channel_error` traegt den Grund
 * (Airbnb nimmt z. B. kein PDF). Die Oberflaeche muss beides unterscheiden.
 */
export async function uploadAttachment(
  threadId: string,
  datei: { uri: string; name: string; type: string },
  message?: string,
): Promise<Result<Attachment>> {
  const form = new FormData();
  // Der Cast ist noetig, weil die DOM-Typen fuer `append` nur Blob/string
  // kennen; die React-Native-Laufzeit erwartet genau dieses Objekt.
  form.append("file", datei as unknown as Blob);
  const params = new URLSearchParams({ filename: datei.name });
  if (message) params.set("message", message);
  return call(`/inbox/${threadId}/attachments?${params.toString()}`, {
    method: "POST",
    body: form,
  });
}

// --- Vorgang: zuweisen, Notiz, Merker, Lebenszyklus (Etappe 3) ---------------

export type TeamMember = { id: string; name: string; email: string | null };

/** Mögliche Bearbeiter des Betriebs. */
export async function listTeam(): Promise<
  Result<{ items: TeamMember[]; total: number }>
> {
  return call("/inbox/team");
}

/** Konversation einem Benutzer zuweisen; `null` hebt die Zuweisung auf. */
export async function assignThread(
  threadId: string,
  userId: string | null,
): Promise<Result<void>> {
  return call(`/inbox/${threadId}/assign`, {
    method: "PUT",
    body: { user_id: userId },
  });
}

/** Interne Notiz in den Verlauf legen — sieht nur das Team, nie der Gast. */
export async function addNote(
  threadId: string,
  body: string,
): Promise<Result<InboxMessage>> {
  return call(`/inbox/${threadId}/notes`, { method: "POST", body: { body } });
}

/**
 * Merker der Konversation. `remind_at` ist das Snooze: ein ISO-Zeitpunkt, zu dem
 * der Thread wieder auftaucht.
 */
export async function updateThreadFlags(
  threadId: string,
  input: {
    is_starred?: boolean;
    is_read?: boolean;
    is_archived?: boolean;
    remind_at?: string;
  },
): Promise<Result<void>> {
  return call(`/inbox/${threadId}/flags`, { method: "PUT", body: input });
}

/**
 * Lebenszyklus: active (wiederherstellen) | archived | trashed | deleted.
 *
 * `deleted` ist endgültig — die Oberfläche fragt davor nach, und zwar nur im
 * Papierkorb: aus der aktiven Liste heraus wäre ein Fehlgriff nicht behebbar.
 */
export async function setInboxStatus(
  threadId: string,
  status: "active" | "archived" | "trashed" | "deleted",
): Promise<Result<void>> {
  return call(`/inbox/${threadId}/status`, {
    method: "PUT",
    body: { status },
  });
}

/**
 * Zahl der offenen Konversationen — Abzeichen am Tab und Hinweis auf der
 * Übersicht.
 *
 * Bewusst dieser Endpunkt und NICHT `/inbox/kennzahlen` oder eine gefilterte
 * Thread-Liste: für eine Zahl 200 Threads samt Gastnamen, Vorschautexten und
 * Aufenthaltsdaten zu laden wäre eine Datenlast, die niemand anzeigt — dazu
 * Gastdaten in einem Bildschirm, der sie nicht braucht.
 *
 * Die Durchsatz-Kennzahlen des Postfachs (gesendet/empfangen/Automation, Ø je
 * Tag) stehen absichtlich nicht in der App: das ist eine Auswertung, kein
 * Handlungsobjekt am Telefon. Sie bleiben im Web-Dashboard.
 */
export async function getInboxUnreadCount(): Promise<
  Result<{ ungelesen: number }>
> {
  return call("/inbox/unread-count");
}

// --- Verwaltung (Etappe 4) ---------------------------------------------------
//
// AUFGETEILT NACH DEM, WAS AUF EIN TELEFON GEHÖRT:
//   * Vorlagen und Wissensfakten sind ÄNDERBAR — beides sind kurze Texte, und
//     beides fällt unterwegs an („der Türcode hat sich geändert").
//   * Automationen, KI-Einstellungen und Sprachen nur LESEND. Eine Automation
//     hat Trigger, vorzeichenbehafteten Versatz, Sendezeit, Kanal- und
//     Objektfilter sowie mehrsprachige Texte; dieses Formular auf einem Telefon
//     nachzubauen hiesse, eine Fehlerquelle zu bauen, die niemand braucht — es
//     wird einmal eingerichtet, nicht am Bahnsteig geändert. Gezeigt wird es
//     trotzdem: die häufige Frage unterwegs ist „läuft dafür schon eine
//     Automation?", nicht „ich will sie umbauen".

/** Eine Vorlage anlegen/ändern. Es geht NUR `body_html` raus — den Klartext
 *  leitet der Server selbst ab, damit es genau EINE Umwandlung gibt. Die App
 *  schickt reinen Text; das ist gültiges HTML-Autorenformat. */
export type TemplateInput = {
  title: string;
  body_html: string;
  subject?: string;
};

export async function createTemplate(
  input: TemplateInput,
): Promise<Result<MessageTemplate>> {
  return call("/inbox/templates", { method: "POST", body: input });
}

export async function updateTemplate(
  id: string,
  input: TemplateInput,
): Promise<Result<MessageTemplate>> {
  return call(`/inbox/templates/${id}`, { method: "PUT", body: input });
}

export async function deleteTemplate(id: string): Promise<Result<void>> {
  return call(`/inbox/templates/${id}`, { method: "DELETE" });
}

/** Ein Wissensfakt für die KI-Antworten. `property_id = null` gilt betriebsweit. */
export type KnowledgeFact = {
  id: string;
  property_id: string | null;
  property_title: string | null;
  fact: string;
  source: "manual" | "document" | "message";
  source_ref: string | null;
  updated_at: string | null;
};

export async function listKnowledge(
  propertyId?: string,
): Promise<Result<{ items: KnowledgeFact[]; total: number }>> {
  const q = propertyId ? `?property_id=${encodeURIComponent(propertyId)}` : "";
  return call(`/inbox/knowledge${q}`);
}

export async function createKnowledge(input: {
  property_id: string | null;
  fact: string;
}): Promise<Result<KnowledgeFact>> {
  return call("/inbox/knowledge", { method: "POST", body: input });
}

export async function updateKnowledge(
  id: string,
  input: { property_id: string | null; fact: string },
): Promise<Result<KnowledgeFact>> {
  return call(`/inbox/knowledge/${id}`, { method: "PUT", body: input });
}

export async function deleteKnowledge(id: string): Promise<Result<void>> {
  return call(`/inbox/knowledge/${id}`, { method: "DELETE" });
}

// --- Nur lesend --------------------------------------------------------------

export type AiSettings = {
  tone: string;
  language: string;
  signature: string | null;
  extra_prompt: string | null;
  auto_suggest: boolean;
};

export async function getAiSettings(): Promise<Result<AiSettings>> {
  return call("/inbox/ai-settings");
}

export type Automation = {
  id: string;
  name: string;
  trigger: string;
  offset_days: number;
  offset_unit?: "minutes" | "hours" | "days";
  offset_value?: number;
  send_time: string | null;
  channels: string[];
  template_id: string | null;
  message: string | null;
  is_active: boolean;
};

export async function listAutomations(): Promise<
  Result<{ items: Automation[]; total: number }>
> {
  return call("/inbox/automations");
}

/** Sprachen, in denen der Betrieb seine Nachrichten pflegt (genau eine ist
 *  Standard). Eine LEERE Liste ist gültig: dann gibt es nur die Grundfassung. */
export type MessageLanguage = { code: string; is_default: boolean };

export async function listMessageLanguages(): Promise<
  Result<{ items: MessageLanguage[] }>
> {
  return call("/inbox/languages");
}

