"use server";

// Bewertungen: Server-Actions gegen den FastAPI-Slice (/api/v1/reviews).
// EINE Liste über alle Kanäle — myBestDays-Marktplatz und die Portale
// (Booking.com/Airbnb/Expedia) kommen normalisiert aus dem Backend, die
// Rohnote samt ihrer Skala bleibt erhalten.
import { ApiError, api, apiBasis } from "@/lib/api";
import { currentToken } from "@/lib/session-token";

/** Herkunft einer Bewertung. Bestimmt den Schreibpfad: der Marktplatz wird
 *  direkt beschrieben, eine Portal-Antwort geht zuerst zum Portal. */
export type ReviewSource = "marketplace" | "ota";

/** Skala der Rohnote: die Portale rechnen auf 10, myBestDays auf 5. */
export type ReviewScale = "1-5" | "0-10";

export type CategoryScore = {
  key: string;
  score: number;
  scale: ReviewScale;
  /** Aus welchen Kanälen dieser Durchschnitt stammt. Leer an einer einzelnen
   *  Bewertung, gefüllt im Qualitäts-Dashboard: „comfort" gibt es nur bei
   *  Booking.com, „accuracy" nur bei Airbnb — ein Durchschnitt über
   *  verschiedene Grundgesamtheiten ohne diesen Hinweis ist irreführend. */
  channels: string[];
};

export type UnifiedReview = {
  source: ReviewSource;
  id: string;
  channel_code: string;
  property_id: string | null;
  property_title: string | null;
  author: string;
  text: string | null;
  score: number | null;
  scale: ReviewScale;
  /** Auf 5 Sterne normalisiert. null heißt: keine Note — dann keine Sterne zeigen. */
  score_5: number | null;
  categories: CategoryScore[];
  reply: string | null;
  reply_at: string | null;
  is_replied: boolean;
  /** false, wenn das Antwortfenster des Portals zu ist. */
  can_reply: boolean;
  /** Bis wann das Portal eine Antwort annimmt; null = nicht gemeldet. */
  reply_expires_at: string | null;
  /** Die Antwort kam aus der KI-Warteschlange. */
  reply_ki: boolean;
  /** myBestDays: null = noch verdeckt (Zwei-Wege-Frist läuft). */
  published_at: string | null;
  /** Portale: Airbnb hält verdeckt, bis beide Seiten abgegeben haben. */
  is_hidden: boolean;
  reservation_id: string | null;
  ota_reservation_id: string | null;
  guest_rated: boolean;
  received_at: string | null;
  /** KI-Deutung. `null` = noch nicht ausgewertet (nicht: nichts gefunden). */
  ai: ReviewAi | null;
};

/** Stimmung eines Bewertungstextes. Bewusst NICHT die Note: ein Gast kann
 *  fünf Sterne geben und im Text meckern — genau dieser Fall taucht in keiner
 *  Statistik auf. */
export type AiSentiment = "positiv" | "neutral" | "negativ";

/** Der geschlossene Themen-Katalog. Deckungsgleich mit `ki_deutung.THEMEN`
 *  (Backend) und der Domain `public.ki_bewertungsthema` (0501). Geschlossen,
 *  weil freie Themen nicht vergleichbar wären — „Lärm", „Lärmbelästigung" und
 *  „laute Nachbarn" wären drei Zeilen in jeder Rangliste. */
export type AiThemeKey =
  | "sauberkeit"
  | "lage"
  | "ausstattung"
  | "kommunikation"
  | "anreise"
  | "laerm"
  | "preis";

export type AiTheme = {
  thema: AiThemeKey;
  /** Die Bewertung DIESES Themas, nicht der Gesamteindruck. */
  richtung: AiSentiment;
};

/** Was die KI aus dem Text gelesen hat. `null` an der Bewertung heißt „noch
 *  nicht ausgewertet" — ausdrücklich nicht „nichts gefunden". */
export type ReviewAi = {
  stimmung: AiSentiment;
  themen: AiTheme[];
  kernaussage: string | null;
  bewertet_at: string;
};

export type AiThemeCount = {
  thema: AiThemeKey;
  positiv: number;
  neutral: number;
  negativ: number;
};

export type AiSentimentPoint = {
  date: string;
  positiv: number;
  neutral: number;
  negativ: number;
};

export type AiInsights = {
  from_date: string;
  to_date: string;
  /** Alle Bewertungen im Zeitraum — auch die noch nicht ausgewerteten. */
  gesamt: number;
  /** Davon ausgewertet. Steht neben `gesamt`, damit sichtbar ist, auf wie
   *  viel die Aussage beruht: eine Themenrangliste aus 12 von 400
   *  Bewertungen ist keine Aussage über das Objekt. */
  ausgewertet: number;
  positiv: number;
  neutral: number;
  negativ: number;
  themen: AiThemeCount[];
  series: AiSentimentPoint[];
};

export type AiBilanz = {
  property_id: string;
  property_title: string | null;
  /** Anzahl der eingegangenen Bewertungen — ohne sie wäre nicht
   *  unterscheidbar, ob die Empfehlung auf drei oder sechzig Texten beruht. */
  grundlage: number;
  staerken: string[];
  schwaechen: string[];
  empfehlungen: string[];
  zusammenfassung: string;
};

export type ReviewList = {
  items: UnifiedReview[];
  total: number;
  limit: number;
  offset: number;
};

export type ChannelSummary = {
  channel_code: string;
  count: number;
  average_5: number | null;
  unanswered: number;
};

export type ReviewSummary = {
  count: number;
  average_5: number | null;
  unanswered: number;
  /** Davon mit geschlossenem Antwortfenster — nicht mehr beantwortbar. */
  expired_unanswered: number;
  /** Davon noch verdeckt (Airbnb, zweiseitig) — noch nichts zu beantworten. */
  hidden_unanswered: number;
  /** Anteil beantworteter Bewertungen (0..1). null bei null Bewertungen. */
  response_rate: number | null;
  by_channel: ChannelSummary[];
};

export type AutomationConfig = {
  auto_review_active: boolean;
  auto_review_after_days: number;
  auto_review_min_rating: number | null;
  auto_review_rating: number;
  auto_review_public: string | null;
  auto_review_private: string | null;
  guest_reminder_active: boolean;
  guest_reminder_after_days: number;
};

/** Zustand eines geplanten Eintrags in der Warteschlange. */
export type QueueStatus =
  | "geplant"
  | "gesendet"
  | "uebersprungen"
  | "abgelaufen"
  | "fehler";

export type QueueEntry = {
  id: string;
  source: ReviewSource;
  status: QueueStatus;
  property_id: string | null;
  property_title: string | null;
  guest_name: string | null;
  reservation_id: string | null;
  review_id: string | null;
  send_at: string;
  expires_at: string | null;
  /** Tage bis zum Versand. Negativ = überfällig. */
  days_until_send: number | null;
  /** Tage bis das Fenster zugeht. null = Frist des Kanals unbekannt. */
  days_left: number | null;
  rating: number;
  text: string | null;
  private_text: string | null;
  scores: {
    cleanliness: number | null;
    communication: number | null;
    house_rules: number | null;
  };
  recommended: boolean;
  tags: string[];
  sent_at: string | null;
  error: string | null;
  /** Gastbewertung ODER öffentliche Antwort unter einer Bewertung (0549). */
  richtung: KiRichtung;
  ki_erzeugt: boolean;
  antwort_auf_id: string | null;
  /** 'entwurf' wartet auf einen Menschen; 'automatisch' geht zur Fälligkeit raus (0566). */
  zustellart: KiZustellart;
  /** Portal der zugehörigen Bewertung; myBestDays beim Marktplatz; null = unbekannt. */
  channel_code: string | null;
};

export type QueueList = {
  items: QueueEntry[];
  total: number;
  limit: number;
  offset: number;
  /** Anzahl je Status über den ganzen Bestand, unabhängig vom Filter. */
  counts: Record<string, number>;
};

export type QueuePatch = {
  rating?: number;
  text?: string | null;
  private_text?: string | null;
  recommended?: boolean;
  score_cleanliness?: number | null;
  score_communication?: number | null;
  score_house_rules?: number | null;
};

export type QualityPoint = {
  date: string;
  count: number;
  /** null an Tagen ohne Bewertung — kein Nullpunkt im Verlauf. */
  average_5: number | null;
};

export type QualityProperty = {
  property_id: string;
  title: string | null;
  count: number;
  average_5: number | null;
  unanswered: number;
};

export type QualityDashboard = {
  from_date: string;
  to_date: string;
  count: number;
  average_5: number | null;
  five_star_rate: number | null;
  response_rate: number | null;
  categories: CategoryScore[];
  series: QualityPoint[];
  by_property: QualityProperty[];
};

/** Eine Auto-Bewertungs-Vorlage: womit der Betrieb seine Gäste automatisch
 *  bewertet. */
export type AutoTemplate = {
  id: string;
  name: string;
  aktiv: boolean;
  /** Tage nach Abreise bis zum Versand. */
  nach_tagen: number;
  note: number;
  /** „Nur bewerten, wenn der Gast selbst mindestens so gut bewertet hat."
   *  null = immer bewerten. */
  min_gastnote: number | null;
  /** Mehrere Texte, aus denen der Versand zufällig einen zieht. Der Grund ist
   *  ein Betriebsbefund: Airbnb straft identische Bewertungen ab. */
  texte: string[];
  privater_text: string | null;
  property_ids: string[];
  created_at: string | null;
};

export type AutoTemplateList = { items: AutoTemplate[] };

export type AutoTemplateRequest = {
  name: string;
  aktiv: boolean;
  nach_tagen: number;
  note: number;
  min_gastnote: number | null;
  texte: string[];
  privater_text: string | null;
  property_ids: string[];
};

export type ReplyState = "offen" | "beantwortet" | "frist_abgelaufen" | "verdeckt";

export type ReviewFilter = {
  source?: ReviewSource;
  propertyId?: string;
  channelCode?: string;
  unanswered?: boolean;
  /** Antwortstand: offen (beantwortbar) · beantwortet · frist_abgelaufen. */
  replyState?: ReplyState;
  /** Volltext im Bewertungstext — NICHT im Gastnamen: der ist auf der
   *  Marktplatzseite bewusst maskiert, und eine Namenssuche liesse ihn
   *  Zeichen für Zeichen erraten. */
  suche?: string;
  /** Notenbereich in der 5er-Skala. Das Backend rechnet für Portal-
   *  Bewertungen selbst auf 0..10 um — die gemischte Liste soll dem Nutzer
   *  nicht abverlangen zu wissen, welcher Kanal welche Skala führt. */
  ratingMin?: number;
  ratingMax?: number;
  sentiment?: AiSentiment;
  limit?: number;
  offset?: number;
};

type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

async function call<T>(
  path: string,
  opts: {
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

/** Wie `call`, aber für Antworten, die KEIN JSON sind (CSV).
 *
 *  Eigener Weg statt `api<string>`: das würde `res.json()` versuchen und an
 *  einer CSV mit „Unexpected token" scheitern — der Nutzer bekäme einen
 *  Parserfehler zu sehen, wo in Wahrheit alles funktioniert hat.
 */
async function callText(path: string): Promise<Result<string>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  let res: Response;
  try {
    res = await fetch(`${apiBasis()}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  } catch {
    return { ok: false, error: "Backend nicht erreichbar.", status: 503 };
  }
  if (!res.ok) {
    // Der Fehlerfall ist sehr wohl JSON (FastAPIs `detail`) — nur der
    // Erfolgsfall nicht.
    let meldung = `Fehler ${res.status}`;
    try {
      const daten = await res.json();
      if (typeof daten?.detail === "string") meldung = daten.detail;
    } catch {
      // kein JSON-Body — Standardmeldung behalten
    }
    return { ok: false, error: meldung, status: res.status };
  }
  return { ok: true, data: await res.text() };
}

export async function listReviews(filter: ReviewFilter = {}): Promise<Result<ReviewList>> {
  const qs = new URLSearchParams();
  if (filter.source) qs.set("source", filter.source);
  if (filter.propertyId) qs.set("property_id", filter.propertyId);
  if (filter.channelCode) qs.set("channel_code", filter.channelCode);
  if (filter.unanswered) qs.set("unanswered", "true");
  if (filter.replyState) qs.set("antwort", filter.replyState);
  if (filter.suche) qs.set("suche", filter.suche);
  if (filter.ratingMin != null) qs.set("rating_min", String(filter.ratingMin));
  if (filter.ratingMax != null) qs.set("rating_max", String(filter.ratingMax));
  if (filter.sentiment) qs.set("sentiment", filter.sentiment);
  if (filter.limit != null) qs.set("limit", String(filter.limit));
  if (filter.offset != null) qs.set("offset", String(filter.offset));
  const suffix = qs.size ? `?${qs.toString()}` : "";
  return call(`/reviews${suffix}`);
}

export async function reviewSummary(): Promise<Result<ReviewSummary>> {
  return call("/reviews/summary");
}

export async function replyToReview(
  source: ReviewSource,
  id: string,
  reply: string,
): Promise<Result<UnifiedReview>> {
  return call(`/reviews/${source}/${id}/reply`, { method: "PUT", body: { reply } });
}

export async function deleteReviewReply(id: string): Promise<Result<void>> {
  return call(`/reviews/marketplace/${id}/reply`, { method: "DELETE" });
}

export async function syncOtaReviews(): Promise<Result<{ mirrored: number }>> {
  return call("/reviews/sync", { method: "POST" });
}

export async function getReviewAutomation(): Promise<Result<AutomationConfig>> {
  return call("/reviews/automation");
}

export async function saveReviewAutomation(
  cfg: AutomationConfig,
): Promise<Result<AutomationConfig>> {
  return call("/reviews/automation", { method: "PUT", body: cfg });
}

export async function rateGuest(input: {
  reservation_id: string;
  rating: number;
  text?: string | null;
  scores?: {
    cleanliness?: number | null;
    communication?: number | null;
    house_rules?: number | null;
  };
}): Promise<Result<{ id: string }>> {
  return call("/reviews/guest-rating", { method: "POST", body: input });
}

export async function sendOtaGuestReview(
  id: string,
  input: {
    rating: number;
    public_review?: string | null;
    private_review?: string | null;
    recommended?: boolean;
    scores?: {
      cleanliness?: number | null;
      communication?: number | null;
      house_rules?: number | null;
    };
  },
): Promise<Result<UnifiedReview>> {
  return call(`/reviews/ota/${id}/guest-review`, { method: "POST", body: input });
}

// --- Warteschlange -----------------------------------------------------------

export async function listQueue(
  opts: { status?: QueueStatus; limit?: number; offset?: number } = {},
): Promise<Result<QueueList>> {
  const qs = new URLSearchParams();
  if (opts.status) qs.set("status", opts.status);
  qs.set("limit", String(opts.limit ?? 25));
  qs.set("offset", String(opts.offset ?? 0));
  return call(`/reviews/queue?${qs.toString()}`);
}

export async function updateQueueEntry(
  id: string,
  patch: QueuePatch,
): Promise<Result<QueueEntry>> {
  return call(`/reviews/queue/${id}`, { method: "PATCH", body: patch });
}

export async function skipQueueEntry(id: string): Promise<Result<QueueEntry>> {
  return call(`/reviews/queue/${id}/skip`, { method: "POST" });
}

/** Jetzt abschicken statt auf die Fälligkeit zu warten. Unumkehrbar. */
export async function sendQueueEntry(id: string): Promise<Result<QueueEntry>> {
  return call(`/reviews/queue/${id}/send`, { method: "POST" });
}

// --- Qualität ----------------------------------------------------------------

export async function reviewQuality(
  range: { from?: string; to?: string } = {},
): Promise<Result<QualityDashboard>> {
  const qs = new URLSearchParams();
  if (range.from) qs.set("from", range.from);
  if (range.to) qs.set("to", range.to);
  const suffix = qs.size ? `?${qs.toString()}` : "";
  return call(`/reviews/quality${suffix}`);
}

// --- KI-Auswertung -----------------------------------------------------------

/** Stimmungsverteilung, Themen-Rangliste und Verlauf. Kein Modellaufruf —
 *  reines Rechnen über gespeicherte Deutungen, deshalb so billig wie jede
 *  andere Liste. */
export async function reviewAiInsights(
  range: { from?: string; to?: string } = {},
): Promise<Result<AiInsights>> {
  const qs = new URLSearchParams();
  if (range.from) qs.set("from", range.from);
  if (range.to) qs.set("to", range.to);
  const suffix = qs.size ? `?${qs.toString()}` : "";
  return call(`/reviews/ai/insights${suffix}`);
}

/** Was Gäste an DIESEM Objekt wiederholt loben und bemängeln, plus konkrete
 *  Empfehlungen. EIN Modellaufruf über bis zu 60 Texte — dauert Sekunden und
 *  kostet, deshalb nie automatisch beim Seitenaufruf. 422, wenn zu wenige
 *  Bewertungen mit Text vorliegen. */
export async function reviewAiBilanz(
  propertyId: string,
  range: { from?: string; to?: string } = {},
): Promise<Result<AiBilanz>> {
  const qs = new URLSearchParams();
  if (range.from) qs.set("from", range.from);
  if (range.to) qs.set("to", range.to);
  const suffix = qs.size ? `?${qs.toString()}` : "";
  return call(`/reviews/ai/bilanz/${propertyId}${suffix}`);
}

/** Noch nicht ausgewertete Bewertungen jetzt auswerten. Der Regelbetrieb
 *  läuft über den Tick; das hier ist für den Betrieb, der gerade
 *  eingeschaltet hat und nicht bis morgen warten will. */
export async function reviewAiDeuten(
  limit = 25,
): Promise<Result<{ gedeutet: number; fehler: number }>> {
  return call(`/reviews/ai/deuten?limit=${limit}`, { method: "POST" });
}

/** Die gefilterte Liste als CSV-Text. Dieselben Filter wie die Liste — was
 *  man sieht, bekommt man. `spalten` ist die Auswahl aus der Tabelle; ohne
 *  Angabe gilt der Standardsatz des Backends. */
export async function exportReviewsCsv(
  filter: ReviewFilter = {},
  spalten?: readonly string[],
): Promise<Result<string>> {
  const qs = new URLSearchParams();
  if (filter.source) qs.set("source", filter.source);
  if (filter.propertyId) qs.set("property_id", filter.propertyId);
  if (filter.channelCode) qs.set("channel_code", filter.channelCode);
  if (filter.unanswered) qs.set("unanswered", "true");
  if (filter.replyState) qs.set("antwort", filter.replyState);
  if (filter.suche) qs.set("suche", filter.suche);
  if (filter.ratingMin != null) qs.set("rating_min", String(filter.ratingMin));
  if (filter.ratingMax != null) qs.set("rating_max", String(filter.ratingMax));
  if (filter.sentiment) qs.set("sentiment", filter.sentiment);
  if (spalten?.length) qs.set("spalten", spalten.join(","));
  const suffix = qs.size ? `?${qs.toString()}` : "";
  return callText(`/reviews/export${suffix}`);
}

// --- Auto-Bewertungs-Vorlagen ------------------------------------------------

export async function listAutoTemplates(): Promise<Result<AutoTemplateList>> {
  return call("/reviews/templates");
}

export async function createAutoTemplate(
  req: AutoTemplateRequest,
): Promise<Result<AutoTemplate>> {
  return call("/reviews/templates", { method: "POST", body: req });
}

export async function updateAutoTemplate(
  id: string,
  req: AutoTemplateRequest,
): Promise<Result<AutoTemplate>> {
  return call(`/reviews/templates/${id}`, { method: "PUT", body: req });
}

/** Duplizieren — die Kopie entsteht INAKTIV und ohne Objekte, damit sie die
 *  kopierte Vorlage nicht sofort verdrängt (ein Objekt darf nur eine aktive
 *  haben). */
export async function copyAutoTemplate(
  id: string,
): Promise<Result<AutoTemplate>> {
  return call(`/reviews/templates/${id}/copy`, { method: "POST" });
}

export async function deleteAutoTemplate(id: string): Promise<Result<void>> {
  return call(`/reviews/templates/${id}`, { method: "DELETE" });
}

// ---------------------------------------------------------- Bewertungs-KI
// Beide Richtungen teilen sich Katalog und Einstellungen (0549): es ist
// derselbe Betrieb, der redet. Die Zustellart steht je Richtung, weil eine
// öffentliche Antwort auf eine 1-Stern-Bewertung riskanter ist als eine
// Gastbewertung, die ausser dem Gast kaum jemand sieht.

/** Wer schreibt über wen. */
export type KiRichtung = "gast_bewerten" | "antwort";

/** Geht der Text von selbst raus oder wird er nur entworfen? */
export type KiZustellart = "entwurf" | "automatisch";

export type KiKatalogFrage = {
  schluessel: string;
  frage: string;
  beispiel: string;
  antwort: string | null;
  /** Bei welchen Noten diese Antwort in den Prompt geht. Leer = immer. */
  noten: number[];
  richtungen: KiRichtung[];
};

export type KiKatalogAntwort = {
  fragen: KiKatalogFrage[];
  beantwortet: number;
  gesamt: number;
};

export type KiSettings = {
  ki_aktiv: boolean;
  zustellart_gast_bewerten: KiZustellart;
  zustellart_antwort: KiZustellart;
  /** Unter dieser Note bleibt die ANTWORT Entwurf, auch bei 'automatisch'. */
  antwort_mensch_ab_note: number | null;
  tonfall: string;
  unterschrift: string | null;
  sprache: string;
  verzoegerung_minuten: number;
};

export type KiTestFrage = {
  richtung: KiRichtung;
  note: number;
  gast_text?: string | null;
  gast_name?: string | null;
  property_id?: string | null;
  sprache?: string | null;
};

export type KiTestAntwort = {
  text: string;
  zustellart: KiZustellart;
  /** Warum NICHT automatisch zugestellt würde. null = es ginge raus. */
  grund: string | null;
  verwendete_fragen: string[];
  /** Das Modell bittet um menschliche Prüfung. */
  mensch_pruefen: string | null;
  offene_fragen: string[];
};

export type KiProtokollEintrag = {
  id: string;
  richtung: KiRichtung;
  quelle: string;
  bezug_id: string | null;
  note: number | null;
  eingabe_auszug: string | null;
  ergebnis: string | null;
  zustellart: KiZustellart;
  gesendet_at: string | null;
  verwendete_fragen: string[];
  grund: string | null;
  created_at: string | null;
  /** Kontext der beantworteten Bewertung; null bei Test-KI oder Marktplatz. */
  gast_name: string | null;
  kanal: string | null;
  objekt_titel: string | null;
  /** Stand des Warteschlangen-Eintrags; null = kein Eintrag entstanden. */
  warteschlange_status: string | null;
  warteschlange_fehler: string | null;
};

export type KiProtokollList = { items: KiProtokollEintrag[]; total: number };

export async function getKiKatalog(): Promise<Result<KiKatalogAntwort>> {
  return call("/reviews/ki/katalog");
}

/** Eine Antwort setzen. Leerer Text LÖSCHT sie — die einzige Art, eine
 *  Haltung zurückzunehmen. */
export async function saveKiKatalogFrage(
  schluessel: string,
  antwort: string,
): Promise<Result<KiKatalogAntwort>> {
  return call("/reviews/ki/katalog", {
    method: "PUT",
    body: { schluessel, antwort },
  });
}

export async function getKiSettings(): Promise<Result<KiSettings>> {
  return call("/reviews/ki/settings");
}

export async function saveKiSettings(
  s: KiSettings,
): Promise<Result<KiSettings>> {
  return call("/reviews/ki/settings", { method: "PUT", body: s });
}

/** Die Probe. SENDET NICHTS — sie zeigt, was im Ernstfall passieren würde. */
export async function kiTesten(
  req: KiTestFrage,
): Promise<Result<KiTestAntwort>> {
  return call("/reviews/ki/test", { method: "POST", body: req });
}

export async function getKiProtokoll(
  richtung?: KiRichtung,
  limit = 50,
): Promise<Result<KiProtokollList>> {
  const qs = new URLSearchParams({ limit: String(limit) });
  if (richtung) qs.set("richtung", richtung);
  return call(`/reviews/ki/protokoll?${qs.toString()}`);
}
