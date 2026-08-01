"use client";

// Andy — freihaendiger Sprach-Assistent mit Wake-Word („Hallo Andy"), wie Siri.
//
// Ablauf:
//  1) Consent-Gate: einmalig „Andy aktivieren". Der Klick liefert die User-Geste
//     (Mikrofon-Erlaubnis + Speech-Freischaltung) und startet das Dauerlauschen.
//  2) Andy lauscht dann dauerhaft im Hintergrund (continuous recognition, startet
//     bei onend automatisch neu). Faellt „Andy"/„Hallo Andy"/„Hey Andy", wacht er
//     auf, bestaetigt kurz und nimmt die Frage (Rest des Satzes oder naechster) auf.
//  3) Frage → Backend (/dashboard/voice) → Antwort wird vorgelesen → zurueck ins
//     Lauschen. Grundlage fuer die spaetere Voice-Vollsteuerung von myNextDays.

import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@nextdays/ui/button";
import {
  answerLocalQuery,
  buildActionConfirmation,
  classifyCommand,
  classifyConfirmation,
  type PricingItemLite,
  type UiAction,
  type VoiceAction,
} from "@/lib/voice-commands";
import {
  readVoiceConsent,
  writeVoiceConsent,
  type VoiceConsent,
} from "@/lib/voice-consent";

type DashboardEntrySnapshot = {
  guest_name: string | null;
  property_title: string | null;
  channel: string;
  ota_name: string | null;
  check_in: string;
  check_out: string;
  status: string;
};

type DashboardKpiSnapshot = {
  value: number;
  change_pct: number | null;
};

type DashboardVoiceSnapshot = {
  today: string;
  checkouts_today: DashboardEntrySnapshot[];
  checkins_today: DashboardEntrySnapshot[];
  upcoming: DashboardEntrySnapshot[];
  properties: {
    id: string;
    title: string;
    property_type: string;
    status: string;
    city: string | null;
    country: string | null;
    max_guests: number | null;
  }[];
  checkins_30d: DashboardKpiSnapshot;
  revenue_30d: DashboardKpiSnapshot | null;
  confirmed_30d: DashboardKpiSnapshot;
  currency: string;
};

type DashboardVoiceAssistantProps = {
  // Optional: wird Andy im Dashboard-Layout gerendert, laedt er die Daten selbst
  // (damit er beim Navigieren auf jeder Seite bestehen bleibt).
  dashboard?: DashboardVoiceSnapshot | null;
  userLabel?: string | null;
};

// Leerer Snapshot als Startwert, bis die Daten client-seitig geladen sind.
const EMPTY_SNAPSHOT: DashboardVoiceSnapshot = {
  today: "",
  checkouts_today: [],
  checkins_today: [],
  upcoming: [],
  properties: [],
  checkins_30d: { value: 0, change_pct: null },
  revenue_30d: null,
  confirmed_30d: { value: 0, change_pct: null },
  currency: "",
};

// Andy-Zustaende: idle (aktiv, aber wartet auf Wake-Word), awake (Frage-Aufnahme),
// thinking (Backend), speaking (liest vor).
type AndyPhase = "idle" | "awake" | "thinking" | "speaking";

type SpeechRecognitionAlt = { transcript: string };
type SpeechRecognitionResultLike = ArrayLike<SpeechRecognitionAlt> & {
  isFinal: boolean;
  length: number;
};
type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

// Wake-Word-Muster. „andy" nur als eigenstaendiges Wort (Wortgrenze), sonst
// wuerde „Sandy", „Mandy" etc. faelschlich ausloesen. Die laengeren Varianten
// zuerst, damit „Hallo Andy, …" den Rest korrekt abschneidet.
const WAKE_PATTERNS: { re: RegExp }[] = [
  { re: /\b(?:hallo|hey|hi|hallöchen)\s+(?:and(?:y|i|ie)|handy)\b/i },
  { re: /\b(?:and(?:y|i|ie)|handy)\b/i },
];

// Nur am SATZANFANG verwendbar (awake-Modus), damit ein Name wie
// "... mit freundlichen Grüßen Andy Staudinger" nicht den Satz abschneidet.
const LEADING_WAKE_RE =
  /^(?:\s*)(?:(?:hallo|hey|hi|hallöchen)\s+)?(?:and(?:y|i|ie)|handy)\b[\s,.!?-]*/i;

// Zeitfenster nach einer Antwort, in dem Andy ohne erneutes Wake-Word weiter
// zuhoert (echtes Gespraech). Danach zurueck in den Ruhemodus.
const FOLLOW_UP_MS = 20000;

// Sprechpause, nach der ein gesammelter Satz als fertig gilt und verarbeitet
// wird (verhindert, dass ein laengerer Satz stueckweise interpretiert wird).
const PHRASE_PAUSE_MS = 1200;

const DOMAIN_HINTS = [
  "dynamic pricing",
  "preisautomatik",
  "check-in",
  "check-out",
  "posteingang",
  "kalender",
  "reservierung",
  "buchung",
  "umsatz",
  "objekt",
];

// Erzwingt das Freigeben des Mikrofons: Chrome/Safari halten den Mic-Indikator
// nach SpeechRecognition.abort() weiter, weil der intern gekapselte Stream nicht
// sofort freigegeben wird. Ein kurz geholter eigener Stream, dessen Tracks wir
// sofort stoppen, zwingt den Browser, den Indikator zu löschen. Da der Consent
// beim Deaktivieren bereits erteilt war, kommt kein neuer Erlaubnis-Prompt.
function releaseMicrophone(): void {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return;
  }
  navigator.mediaDevices
    .getUserMedia({ audio: true })
    .then((stream) => {
      for (const track of stream.getTracks()) {
        track.stop();
      }
    })
    .catch(() => {
      // Kein Zugriff / bereits frei — nichts zu tun.
    });
}

function buildSnapshot(dashboard: DashboardVoiceSnapshot): DashboardVoiceSnapshot {
  return {
    ...dashboard,
    checkouts_today: dashboard.checkouts_today.slice(0, 3),
    checkins_today: dashboard.checkins_today.slice(0, 3),
    upcoming: dashboard.upcoming.slice(0, 3),
    properties: dashboard.properties,
  };
}

// Prueft, ob im Text ein Wake-Word vorkommt, und liefert den Teil DANACH als
// direkte Frage zurueck (leer, wenn nur das Wake-Word fiel).
function matchWake(text: string): { hit: boolean; rest: string } {
  for (const { re } of WAKE_PATTERNS) {
    const m = re.exec(text);
    if (m) {
      const rest = text
        .slice(m.index + m[0].length)
        .replace(/^[\s,.!?]+/, "")
        .trim();
      return { hit: true, rest };
    }
  }
  return { hit: false, rest: "" };
}

function stripLeadingWake(text: string): { hit: boolean; rest: string } {
  const m = LEADING_WAKE_RE.exec(text);
  if (!m) {
    return { hit: false, rest: text.trim() };
  }
  const rest = text.slice(m[0].length).trim();
  return { hit: true, rest };
}

function toUiText(value: unknown, fallback = "Unbekannter Fehler."): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || fallback;
  }
  if (value instanceof Error) {
    return toUiText(value.message, fallback);
  }
  if (Array.isArray(value)) {
    const parts = value
      .map((entry) => toUiText(entry, ""))
      .filter((entry) => entry.length > 0);
    if (parts.length > 0) {
      return parts.join("; ");
    }
    return fallback;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if ("detail" in record) {
      return toUiText(record.detail, fallback);
    }
    if ("message" in record) {
      return toUiText(record.message, fallback);
    }
    if ("error" in record) {
      return toUiText(record.error, fallback);
    }
    try {
      const serialized = JSON.stringify(record);
      return serialized && serialized !== "{}" ? serialized : fallback;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function normalizeUtterance(raw: string): string {
  const compact = raw.replace(/\s+/g, " ").trim();
  const stripped = compact
    .replace(/^(?:ja|okay|ok|also|äh|ähm|hm|hmm)[\s,.:;-]+/i, "")
    .trim();
  const corrected = (stripped || compact)
    // Typische de-DE-Transkriptionsfehler im Domain-Kontext glätten.
    .replace(/\b(hallo|hey|hi|hallöchen)\s+handy\b/gi, "$1 andy")
    .replace(/\bandie\b/gi, "andy")
    .replace(/^verarbeiten$/gi, "bearbeiten")
    .replace(/^arbeiten$/gi, "bearbeiten")
    .replace(/\bdynamic\s*(preising|prizing|pricing)\b/gi, "dynamic pricing")
    .replace(/\bdynamik\s*pricing\b/gi, "dynamic pricing")
    .replace(/\bpreis\s*automatik\b/gi, "preisautomatik")
    .replace(/\bcheck\s*-?\s*ins?\b/gi, "check-in")
    .replace(/\bcheck\s*-?\s*outs?\b/gi, "check-out")
    .trim();
  return corrected;
}

function debugValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function setNativeTextareaValue(node: HTMLTextAreaElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    "value",
  )?.set;
  if (setter) {
    setter.call(node, value);
  } else {
    node.value = value;
  }
  node.dispatchEvent(new Event("input", { bubbles: true }));
}

function applyInboxAiDraftText(text: string): boolean {
  const area = document.querySelector<HTMLTextAreaElement>(
    '[data-testid="inbox-ai-draft-textarea"]',
  );
  if (!area) {
    return false;
  }
  setNativeTextareaValue(area, text.trim());
  area.focus();
  return true;
}

function applyInboxComposerText(text: string): boolean {
  const area = document.querySelector<HTMLTextAreaElement>(
    '[data-testid="inbox-composer-textarea"]',
  );
  if (!area) {
    return false;
  }
  setNativeTextareaValue(area, text.trim());
  area.focus();
  return true;
}

function applyInboxReplyText(text: string): { ok: boolean; target: "ai-draft" | "composer" | "none" } {
  if (applyInboxAiDraftText(text)) {
    return { ok: true, target: "ai-draft" };
  }
  if (applyInboxComposerText(text)) {
    return { ok: true, target: "composer" };
  }
  return { ok: false, target: "none" };
}

function readInboxAiDraftText(): string {
  const area = document.querySelector<HTMLTextAreaElement>(
    '[data-testid="inbox-ai-draft-textarea"]',
  );
  if (area?.value?.trim()) {
    return area.value.trim();
  }
  const preview = document.querySelector<HTMLElement>(
    '[data-testid="inbox-ai-draft-preview"]',
  );
  return preview?.innerText?.trim() ?? "";
}

function readInboxComposerText(): string {
  const area = document.querySelector<HTMLTextAreaElement>(
    '[data-testid="inbox-composer-textarea"]',
  );
  return area?.value?.trim() ?? "";
}

function applyOrthographyInstructionToReplyText(instruction: string): {
  ok: boolean;
  target: "ai-draft" | "composer" | "none";
  text: string;
} {
  const sourceText = readInboxAiDraftText() || readInboxComposerText();
  if (!sourceText) {
    return { ok: false, target: "none", text: "" };
  }
  let nextText = sourceText;
  const normalizedInstruction = normalizeForMatch(instruction);
  const wantsHalloCapitalized =
    /\bhallo\b/.test(normalizedInstruction) &&
    /\b(gross|gro[sz])\b/.test(normalizedInstruction) &&
    /\b(schreib|anfang)\b/.test(normalizedInstruction);
  if (wantsHalloCapitalized) {
    nextText = nextText.replace(/^\s*hallo\b/i, (m) =>
      m.replace(/hallo/i, "Hallo"),
    );
  }
  const write = applyInboxReplyText(nextText);
  return { ok: write.ok, target: write.target, text: nextText };
}

function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractInboxDictatedText(utterance: string): string | null {
  const normalized = normalizeForMatch(utterance);
  const asksToWrite =
    /(schreib|beantwort|antworte|verfass|erstell).*(nachricht|antwort)/.test(
      normalized,
    ) ||
    /(schreib|beantwort|antworte|verfass|erstell).*(posteingang|buchung|reservierung)/.test(
      normalized,
    );
  if (!asksToWrite) {
    return null;
  }

  // Alles vor dem eigentlichen Nachrichtentext abschneiden.
  let tail = utterance
    .replace(
      /^.*?(?:schreibe?|beantworte?|antworte?|verfasse?|erstelle?)\s*(?:bitte\s*)?(?:eine\s*)?(?:nachricht|antwort)?\s*/i,
      "",
    )
    .trim();

  const starterWords = [
    "hallo",
    "guten",
    "danke",
    "vielen",
    "wir",
    "bitte",
    "sehr geehrte",
    "liebe",
  ];
  const lowerTail = tail.toLowerCase();
  const starterIndex = starterWords
    .map((w) => lowerTail.indexOf(w))
    .filter((idx) => idx >= 0)
    .sort((a, b) => a - b)[0];
  if (starterIndex !== undefined) {
    tail = tail.slice(starterIndex).trim();
  }

  if (!tail) {
    return null;
  }
  const cleaned = tail.replace(/^[:,\-\s]+/, "").trim();
  if (!cleaned) {
    return null;
  }
  return cleaned;
}

function isCorrectionFeedback(utterance: string): boolean {
  const text = normalizeForMatch(utterance);
  const hasCorrectionTopic =
    /\b(rechtschreib\w*|schreibweise|grammatik|formulierung|text|satz|wortwahl)\b/.test(
      text,
    ) || /\b(korrigier\w*|verbesser\w*|umschreib\w*)\b/.test(text);
  const hasNegativeSignal =
    /\b(stimmt\s+nicht|falsch|nicht\s+gut|fehlerhaft|passt\s+nicht|ist\s+nicht\s+gut)\b/.test(
      text,
    ) || text.startsWith("aber ");
  return hasCorrectionTopic && hasNegativeSignal;
}

function isInboxInsertInstruction(utterance: string): boolean {
  const text = normalizeForMatch(utterance);
  const hasInsertVerb = /\b(einfug\w*|einfueg\w*|erganz\w*|ergaenz\w*|hinzu\w*|rein\s*schreib\w*)\b/.test(
    text,
  );
  const hasTextTarget = /\b(text|sendetext|nachricht|antwort|entwurf)\b/.test(text);
  return hasInsertVerb && hasTextTarget;
}

function isLikelyReplyGreetingText(utterance: string): boolean {
  const text = normalizeForMatch(utterance);
  if (text.split(" ").length < 3) {
    return false;
  }
  if (/\b(hallo\s+andy|hallo\s+andi|hallo\s+handy)\b/.test(text)) {
    return false;
  }
  // Korrektur-Anweisungen duerfen NICHT als neuer Nachrichtentext landen.
  if (
    /\b(gross|gro[sz]|anfang|geschrieben|grossschreiben|rechtschreib\w*|korrigier\w*|verbesser\w*)\b/.test(
      text,
    )
  ) {
    return false;
  }
  return /^(hallo|guten\s+tag|liebe\w*|sehr\s+geehrte\w*)\b/.test(text);
}

function toTitleCaseWords(value: string): string {
  return value
    .split(" ")
    .map((part) => {
      if (!part) {
        return part;
      }
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(" ");
}

function extractCorrectedGuestName(utterance: string): string | null {
  const m = utterance.match(
    /\b(?:und\s+)?(?:sie|er)\s+hei(?:s|ß)t(?:\s+doch)?(?:\s+als)?\s+(.+)$/i,
  );
  if (!m) {
    return null;
  }
  const raw = m[1]
    .trim()
    .replace(/^[,:;\-\s]+/, "")
    .replace(/\s+/g, " ");
  const safe = raw.replace(/[^a-zA-ZäöüÄÖÜß'\-\s]/g, " ").replace(/\s+/g, " ").trim();
  if (!safe) {
    return null;
  }
  const words = safe.split(" ").filter((w) => w.length >= 2);
  if (words.length < 2) {
    return null;
  }
  return toTitleCaseWords(words.join(" "));
}

function applyGuestNameCorrectionToReplyText(name: string): {
  ok: boolean;
  target: "ai-draft" | "composer" | "none";
  text: string;
} {
  const sourceText = readInboxAiDraftText() || readInboxComposerText();
  if (!sourceText) {
    return { ok: false, target: "none", text: "" };
  }
  let nextText = sourceText;

  if (/\bhallo\s+(?:frau|herr)\s+/i.test(nextText)) {
    nextText = nextText.replace(
      /(\bhallo\s+(?:frau|herr)\s+)([^,.!\n]+)/i,
      (_, prefix: string) => `${prefix}${name}`,
    );
  } else if (/\bhallo\s+/i.test(nextText)) {
    nextText = nextText.replace(
      /(\bhallo\s+)([^,.!\n]+)/i,
      (_, prefix: string) => `${prefix}${name}`,
    );
  }

  const write = applyInboxReplyText(nextText);
  return { ok: write.ok, target: write.target, text: nextText };
}

function trySelectInboxThreadByUtterance(utterance: string): { selected: boolean; guest?: string } {
  const normalizedUtterance = normalizeForMatch(utterance);
  if (!normalizedUtterance || !normalizedUtterance.includes("posteingang")) {
    return { selected: false };
  }
  const items = Array.from(
    document.querySelectorAll<HTMLButtonElement>('[data-testid="inbox-thread-item"]'),
  );
  for (const item of items) {
    const guest = normalizeForMatch(item.getAttribute("data-thread-guest") ?? "");
    if (!guest) {
      continue;
    }
    const parts = guest.split(" ").filter((p) => p.length >= 3);
    if (parts.length === 0) {
      continue;
    }
    const matchCount = parts.filter((p) => normalizedUtterance.includes(p)).length;
    if (matchCount >= Math.min(2, parts.length)) {
      item.click();
      return { selected: true, guest };
    }
  }
  return { selected: false };
}

function runUiAction(action: UiAction): { ok: boolean; detail: string } {
  if (action.key === "inbox-ai-edit") {
    const editBtn = document.querySelector<HTMLElement>(
      '[data-testid="inbox-ai-edit-button"]',
    );
    if (!editBtn) {
      return { ok: false, detail: "edit-button-not-found" };
    }
    editBtn.click();
    return { ok: true, detail: "edit-clicked" };
  }

  if (action.key === "inbox-ai-send") {
    const sendBtn = document.querySelector<HTMLElement>(
      '[data-testid="inbox-ai-send-button"]',
    );
    if (sendBtn) {
      sendBtn.click();
      return { ok: true, detail: "ai-send-clicked" };
    }
    const composerSend = document.querySelector<HTMLElement>(
      '[data-testid="inbox-composer-send-button"]',
    );
    if (composerSend) {
      composerSend.click();
      return { ok: true, detail: "composer-send-clicked" };
    }
    return { ok: false, detail: "send-button-not-found" };
  }

  const selectors = [
    '[data-testid="inbox-ai-reply-button"]',
    '[data-testid="inbox-ai-reply"]',
    '[aria-label*="KI-Antwort"]',
    '[title*="KI-Antwort"]',
  ];
  for (const selector of selectors) {
    const node = document.querySelector<HTMLElement>(selector);
    if (node) {
      node.click();
      return { ok: true, detail: `selector:${selector}` };
    }
  }

  const controls = Array.from(
    document.querySelectorAll<HTMLElement>(
      'button,[role="button"],a,[role="tab"],[data-slot="tab"]',
    ),
  );
  const target = controls.find((el) => {
    const text = [
      el.innerText,
      el.textContent,
      el.getAttribute("aria-label"),
      el.getAttribute("title"),
    ]
      .filter((x): x is string => Boolean(x))
      .join(" ")
      .toLowerCase();
    return (
      text.includes("ki-antwort") ||
      text.includes("ki antwort") ||
      text.includes("ai-antwort") ||
      text.includes("ai antwort") ||
      text.includes("darauf antworten")
    );
  });
  if (!target) {
    return { ok: false, detail: "control-not-found" };
  }
  target.click();
  return { ok: true, detail: "control-text-match" };
}

function scoreTranscriptCandidate(candidate: string): number {
  const text = candidate.toLowerCase();
  if (!text) {
    return Number.NEGATIVE_INFINITY;
  }
  let score = 0;
  for (const hint of DOMAIN_HINTS) {
    if (text.includes(hint)) {
      score += 3;
    }
  }
  // Leicht längere Kandidaten bevorzugen (mehr Kontext), aber moderat.
  score += Math.min(text.length / 40, 2);
  if (text.split(" ").length <= 2) {
    score -= 0.5;
  }
  return score;
}

function pickBestTranscript(res: SpeechRecognitionResultLike): string {
  let best = "";
  let bestScore = Number.NEGATIVE_INFINITY;
  for (let j = 0; j < res.length; j += 1) {
    const alt = res[j]?.transcript?.trim() ?? "";
    if (!alt) {
      continue;
    }
    const normalized = normalizeUtterance(alt);
    const score = scoreTranscriptCandidate(normalized);
    if (score > bestScore) {
      bestScore = score;
      best = normalized;
    }
  }
  return best;
}

function detectAmbiguousAction(utterance: string):
  | { type: "toggle"; suggestions: string[] }
  | null {
  const text = utterance.toLowerCase();
  const hasGenericToggle =
    /\b(ausschalten|ausmachen|deaktivieren|deaktiviere|abschalten|abstellen|einschalten|anmachen|aktivieren|aktiviere)\b/.test(
      text,
    );
  if (!hasGenericToggle) {
    return null;
  }
  const hasKnownTarget =
    /\b(dynamic pricing|preisautomatik|kalender|posteingang|inbox|objekt|buchhaltung|umsatz|zahlung|gäste|gaeste)\b/.test(
      text,
    );
  if (hasKnownTarget) {
    return null;
  }
  return {
    type: "toggle",
    suggestions: [
      "Schalte Dynamic Pricing aus.",
      "Schalte Dynamic Pricing ein.",
      "Ist Dynamic Pricing aktiv?",
    ],
  };
}

function isHelpRequest(utterance: string): boolean {
  const text = utterance.toLowerCase();
  return /\b(hilfe|help|was kannst du|was kannst du machen|welche befehle|was geht)\b/.test(
    text,
  );
}

function buildHelpMessage(): string {
  return (
    "Gern. Ich kann dir beim Dashboard helfen: " +
    "Ich beantworte Fragen zu Umsatz, Check-ins und Reservierungen, " +
    "prüfe ob Dynamic Pricing aktiv ist, öffne Bereiche wie Kalender oder Posteingang " +
    "und kann Dynamic Pricing nach deiner Bestätigung ein- oder ausschalten. " +
    "Beispiele: Sag 'Wie viel Umsatz in den letzten 30 Tagen?', " +
    "'Ist Dynamic Pricing aktiv?', 'Öffne den Kalender' oder 'Schalte Dynamic Pricing aus'."
  );
}

export function DashboardVoiceAssistant({
  dashboard: dashboardProp,
  userLabel: userLabelProp,
}: DashboardVoiceAssistantProps) {
  const router = useRouter();
  // Interner Snapshot: entweder vom Prop (Dashboard-Seite) oder client-seitig
  // geladen (Layout, damit Andy auf allen Seiten lebt).
  const [dashboard, setDashboard] = useState<DashboardVoiceSnapshot>(
    dashboardProp ?? EMPTY_SNAPSHOT,
  );
  const [userLabel, setUserLabel] = useState<string | null>(
    userLabelProp ?? null,
  );
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const phaseRef = useRef<AndyPhase>("idle");
  const activeRef = useRef(false); // Consent erteilt → Dauerlauschen an
  const restartTimerRef = useRef<number | null>(null);
  const runningRef = useRef(false); // laeuft recognition GERADE (zwischen start/end)?
  // Nach einer Antwort bleibt Andy kurz „wach" (Folgefrage ohne erneutes
  // Wake-Word). Dieser Timer schliesst das Fenster nach Stille.
  const followUpTimerRef = useRef<number | null>(null);
  // Satz-Sammler: finale Erkennungs-Segmente werden gepuffert und erst nach einer
  // kurzen Sprechpause als GANZER Satz verarbeitet (sonst kommt „dynamic pricing"
  // aus einem laengeren Satz einzeln an und wird falsch interpretiert).
  const phraseBufferRef = useRef<string>("");
  const phraseTimerRef = useRef<number | null>(null);
  // Ausstehende, bestaetigungspflichtige Aktion. Ist sie gesetzt, wird die
  // naechste Aeusserung als Ja/Nein-Antwort gewertet (nicht als neuer Befehl).
  const pendingActionRef = useRef<{
    action: VoiceAction;
    targets: PricingItemLite[];
  } | null>(null);
  const pendingInboxDraftRef = useRef(false);
  // askAndy in einer Ref, damit der Recognition-Effekt NICHT von askAndy abhaengt
  // (sonst wird die Erkennung bei jeder dashboard-Aenderung neu aufgesetzt und
  // bleibt nach der ersten Antwort haengen).
  const askAndyRef = useRef<(utterance: string) => void>(() => { });
  // Steuert die Erkennung von aussen: waehrend Andy spricht wird sie pausiert,
  // damit sie sich nicht selbst hoert und den Audio-Output nicht stoert.
  const pauseListeningRef = useRef<() => void>(() => { });
  const resumeListeningRef = useRef<() => void>(() => { });

  const [consent, setConsent] = useState<VoiceConsent>(null);
  const [open, setOpen] = useState(true);
  const [supported, setSupported] = useState(true);
  const [phase, setPhase] = useState<AndyPhase>("idle");
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);
  const t = useTranslations("voice");
  const locale = useLocale();
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugLines, setDebugLines] = useState<string[]>([]);

  const appendDebug = useCallback((label: string, value?: unknown) => {
    const stamp = new Date().toLocaleTimeString(locale, { hour12: false });
    const line = value === undefined ? `[${stamp}] ${label}` : `[${stamp}] ${label}: ${debugValue(value)}`;
    setDebugLines((prev) => [line, ...prev].slice(0, 40));
  }, [locale]);

  const setPhaseBoth = useCallback((p: AndyPhase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  // Nach einer Antwort: Andy bleibt „wach" und nimmt die naechste Aeusserung
  // direkt als Folgefrage — ohne erneutes „Hallo Andy" (echtes Gespraech). Nach
  // FOLLOW_UP_MS Stille faellt er zurueck in den Ruhemodus (Wake-Word noetig).
  const enterFollowUp = useCallback(() => {
    if (followUpTimerRef.current) {
      window.clearTimeout(followUpTimerRef.current);
    }
    setPhaseBoth("awake");
    resumeListeningRef.current();
    followUpTimerRef.current = window.setTimeout(() => {
      // Nur zuruecksetzen, wenn Andy noch wartet (nicht mitten in Frage/Antwort).
      if (phaseRef.current === "awake") {
        setPhaseBoth("idle");
      }
    }, FOLLOW_UP_MS);
  }, [setPhaseBoth]);

  // Frage ans Backend schicken und Antwort vorlesen.
  const askAndy = useCallback(
    async (utterance: string) => {
      const normalizedUtterance = normalizeUtterance(utterance);
      appendDebug("UTTERANCE_RAW", utterance);
      if (normalizedUtterance !== utterance) {
        appendDebug("UTTERANCE_NORMALIZED", normalizedUtterance);
      }
      // Folgefrage kam rechtzeitig → Ruhemodus-Timer stoppen.
      if (followUpTimerRef.current) {
        window.clearTimeout(followUpTimerRef.current);
        followUpTimerRef.current = null;
      }
      // Erkennung stoppen, solange Andy denkt/spricht (kein Selbst-Zuhoeren).
      pauseListeningRef.current();
      setTranscript(normalizedUtterance || utterance);
      setError(null);

      // Antwort sprechen; danach bleibt Andy kurz wach fuer eine Folgefrage.
      const say = (text: string) => {
        const spoken = toUiText(text, "Alles klar.");
        setReply(spoken);
        setPhaseBoth("speaking");
        speakText(spoken, () => {
          enterFollowUp();
        });
      };

      const interpretedUtterance = normalizedUtterance || utterance;

      if (window.location.pathname.startsWith("/posteingang")) {
        const correctedGuestName = extractCorrectedGuestName(interpretedUtterance);
        if (correctedGuestName) {
          const correction = applyGuestNameCorrectionToReplyText(correctedGuestName);
          appendDebug("UI_NAME_CORRECTION", {
            ok: correction.ok,
            target: correction.target,
            guest: correctedGuestName,
          });
          if (correction.ok) {
            say(
              `Verstanden. Ich habe den Namen auf ${correctedGuestName} korrigiert. Neuer Text: ${correction.text}`,
            );
          } else {
            say(
              "Ich sehe gerade keinen Entwurf zum Korrigieren. Sag zuerst bitte eine Antwort, dann passe ich den Namen an.",
            );
          }
          return;
        }

        const directOrthography = applyOrthographyInstructionToReplyText(
          interpretedUtterance,
        );
        if (directOrthography.ok && directOrthography.text) {
          appendDebug("UI_DRAFT_APPLY", {
            ok: true,
            target: directOrthography.target,
            mode: "orthography-direct",
          });
          say(
            `Alles klar. Ich habe die Korrektur angewendet. Neuer Text: ${directOrthography.text}`,
          );
          return;
        }

        if (isInboxInsertInstruction(interpretedUtterance)) {
          pendingInboxDraftRef.current = true;
          appendDebug("UI_INSERT_MODE", "armed");
          say("Alles klar. Sag mir jetzt bitte den genauen Text, den ich in den Sendetext einfügen soll.");
          return;
        }

        if (isLikelyReplyGreetingText(interpretedUtterance)) {
          const writeResult = applyInboxReplyText(interpretedUtterance);
          appendDebug("UI_DICTATED_WRITE", { ...writeResult, mode: "greeting-fallback" });
          if (writeResult.ok) {
            say(`Erledigt. Ich habe folgenden Text eingetragen: ${interpretedUtterance}`);
            return;
          }
        }
      }

      if (
        isCorrectionFeedback(interpretedUtterance) &&
        window.location.pathname.startsWith("/posteingang")
      ) {
        const existingDraft = readInboxAiDraftText();
        const existingComposer = readInboxComposerText();
        if (!existingDraft && !existingComposer) {
          say(
            "Verstanden. Ich sehe gerade keinen Entwurf zum Korrigieren. Sag zuerst bitte eine Antwort oder KI-Antwort, dann überarbeite ich sie mit dir.",
          );
          return;
        }
        if (existingDraft) {
          runUiAction({ key: "inbox-ai-edit" });
        }
        pendingInboxDraftRef.current = true;
        appendDebug("UI_CORRECTION_MODE", { source: existingDraft ? "ai-draft" : "composer" });
        say(
          "Alles klar. Diktiere mir bitte die korrigierte Version, ich überschreibe den Text und lese ihn dir vor.",
        );
        return;
      }

      // 0) Steht eine bestaetigungspflichtige Aktion aus? Dann Ja/Nein werten.
      if (pendingInboxDraftRef.current) {
        if (/\b(abbrechen|stopp|vergiss es|doch nicht)\b/i.test(interpretedUtterance)) {
          pendingInboxDraftRef.current = false;
          say("Alles klar, ich breche das Bearbeiten ab.");
          return;
        }

        if (/\b(bearbeit\w*|editier\w*|verarbeit\w*)\b/i.test(interpretedUtterance)) {
          runUiAction({ key: "inbox-ai-edit" });
          say("Bearbeiten ist aktiv. Diktiere mir bitte jetzt den gewünschten Text.");
          return;
        }

        const orthography = applyOrthographyInstructionToReplyText(
          interpretedUtterance,
        );
        if (orthography.ok && orthography.text) {
          appendDebug("UI_DRAFT_APPLY", {
            ok: true,
            target: orthography.target,
            mode: "orthography",
          });
          pendingInboxDraftRef.current = false;
          say(
            `Erledigt. Ich habe die Korrektur angewendet. Neuer Text: ${orthography.text}`,
          );
          return;
        }

        const writeResult = applyInboxReplyText(interpretedUtterance);
        appendDebug("UI_DRAFT_APPLY", {
          ok: writeResult.ok,
          target: writeResult.target,
          mode: "overwrite",
        });
        if (writeResult.ok) {
          pendingInboxDraftRef.current = false;
          say(
            `Erledigt. Ich habe folgenden Entwurf eingetragen: ${interpretedUtterance}`,
          );
          return;
        }
        say(
          "Ich finde das Bearbeitungsfeld nicht. Sag zuerst bearbeiten, dann kann ich deinen Text eintragen.",
        );
        return;
      }

      const pending = pendingActionRef.current;
      if (pending) {
        const conf = classifyConfirmation(normalizedUtterance || utterance);
        appendDebug("CONFIRMATION_CLASSIFIED", conf ?? "unknown");
        if (conf === "no") {
          pendingActionRef.current = null;
          say("Alles klar, ich habe nichts geändert.");
          return;
        }
        if (conf === "yes") {
          pendingActionRef.current = null;
          setPhaseBoth("thinking");
          setReply("");
          try {
            // Pricing an-/ausschalten fuer alle betroffenen Objekte.
            const results = await Promise.all(
              pending.targets.map((t) =>
                fetch(`/api/v1/pricing/settings/${t.property_id}`, {
                  method: "PUT",
                  credentials: "include",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ enabled: pending.action.turnOn }),
                }),
              ),
            );
            const failed = results.filter((r) => !r.ok).length;
            if (failed > 0) {
              throw new Error(`${failed} Änderung(en) fehlgeschlagen.`);
            }
            const verb = pending.action.turnOn ? "eingeschaltet" : "ausgeschaltet";
            say(`Erledigt. Die Preisautomatik ist jetzt ${verb}.`);
          } catch (err) {
            const message = toUiText(err, "Unbekannter Fehler.");
            setError(message);
            say("Das hat leider nicht geklappt.");
          }
          return;
        }
        // unklar → nachfragen, Aktion bleibt ausstehend.
        say(
          "Ich habe dich nicht ganz verstanden. Sag einfach kurz ja oder nein. " +
          "Zum Beispiel: Ja, bitte ausschalten.",
        );
        return;
      }

      // Hilfe-Intent: erklärt kurz, was Andy bereits kann.
      const dictatedText = extractInboxDictatedText(interpretedUtterance);
      if (dictatedText) {
        if (!window.location.pathname.startsWith("/posteingang")) {
          router.push("/posteingang");
          say(
            "Ich öffne den Posteingang. Sag den Nachrichtentext danach bitte noch einmal.",
          );
          return;
        }

        const pick = trySelectInboxThreadByUtterance(interpretedUtterance);
        if (pick.selected) {
          appendDebug("UI_THREAD_SELECTED", pick.guest ?? "match");
          await new Promise((resolve) => {
            window.setTimeout(resolve, 220);
          });
        }
        const writeResult = applyInboxReplyText(dictatedText);
        appendDebug("UI_DICTATED_WRITE", writeResult);
        if (writeResult.ok) {
          say(`Alles klar. Ich habe folgenden Text eingetragen: ${dictatedText}`);
        } else {
          say(
            "Ich kann den Nachrichteneditor gerade nicht finden. Wähl bitte erst eine Unterhaltung im Posteingang aus.",
          );
        }
        return;
      }

      // Hilfe-Intent: erklärt kurz, was Andy bereits kann.
      if (isHelpRequest(interpretedUtterance)) {
        appendDebug("HELP_INTENT", true);
        say(buildHelpMessage());
        return;
      }

      const command = classifyCommand(interpretedUtterance);
      appendDebug("COMMAND_KIND", command.kind);

      // 1) Aktion (Daten aendern) → betroffene Objekte holen, Rueckfrage stellen.
      if (command.kind === "action") {
        setPhaseBoth("thinking");
        setReply("");
        try {
          const res = await fetch("/api/v1/pricing/overview", {
            credentials: "include",
          });
          const payload = (await res.json().catch(() => null)) as
            | { items?: PricingItemLite[] }
            | null;
          if (!res.ok) {
            throw new Error(t("unreachable"));
          }
          const { spoken, targets } = buildActionConfirmation(
            command.action,
            payload?.items ?? [],
          );
          // Nur wenn es wirklich etwas zu tun gibt, Bestaetigung anfordern.
          if (targets.length > 0) {
            pendingActionRef.current = { action: command.action, targets };
          }
          say(spoken);
        } catch (err) {
          const message = toUiText(err, "Unbekannter Fehler.");
          setError(message);
          say("Das hat leider nicht geklappt.");
        }
        return;
      }

      // 1) Navigation → Seite wechseln, kurz bestaetigen.
      if (command.kind === "navigate") {
        router.push(command.target.href);
        say(command.target.spoken);
        return;
      }

      // 2) Daten-Abfrage → echten Bereichs-Zustand holen, auswerten, sprechen
      //    (kein Seitenwechsel). Deckt Posteingang, Dynamic Pricing usw. ab.
      if (command.kind === "data-query") {
        setPhaseBoth("thinking");
        setReply("");
        try {
          const res = await fetch(`/api/v1${command.skill.endpoint}`, {
            credentials: "include",
          });
          const payload = await res.json().catch(() => null);
          if (!res.ok) {
            throw new Error(t("unreachable"));
          }
          say(toUiText(command.skill.summarize(payload), "Keine klare Antwort verfügbar."));
        } catch (err) {
          const message = toUiText(err, "Unbekannter Fehler.");
          setError(message);
          enterFollowUp();
        }
        return;
      }

      // 2b) UI-Aktion (z. B. KI-Antwort-Button in Posteingang ausloesen).
      if (command.kind === "ui-action") {
        const shouldTargetInboxThread =
          command.action.key === "inbox-ai-reply" ||
          command.action.key === "inbox-ai-edit" ||
          command.action.key === "inbox-ai-send" ||
          command.action.key === "inbox-ai-read";
        if (shouldTargetInboxThread) {
          const pick = trySelectInboxThreadByUtterance(interpretedUtterance);
          if (pick.selected) {
            appendDebug("UI_THREAD_SELECTED", pick.guest ?? "match");
            await new Promise((resolve) => {
              window.setTimeout(resolve, 220);
            });
          }
        }

        if (command.action.key === "inbox-ai-read") {
          const draft = readInboxAiDraftText();
          appendDebug("UI_ACTION_READ", { hasDraft: Boolean(draft) });
          if (draft) {
            say(`Hier ist der aktuelle KI-Vorschlag: ${draft}`);
          } else {
            say(
              "Ich finde gerade keinen KI-Vorschlag. Sag zuerst bitte KI-Antwort, dann lese ich ihn dir vor.",
            );
          }
          return;
        }

        const result = runUiAction(command.action);
        appendDebug("UI_ACTION", result);
        if (result.ok) {
          if (command.action.key === "inbox-ai-edit") {
            pendingInboxDraftRef.current = true;
            say(
              "Bearbeiten ist aktiv. Welchen Text soll ich verfassen? Ich lese ihn dir danach vor.",
            );
            return;
          }
          if (command.action.key === "inbox-ai-send") {
            say("Erledigt, ich habe auf Senden geklickt.");
            return;
          }
          const draft = readInboxAiDraftText();
          if (draft) {
            say(
              `Erledigt, ich habe die KI-Antwort ausgelöst. Aktueller Entwurf: ${draft}`,
            );
          } else {
            say("Erledigt, ich habe die KI-Antwort ausgelöst.");
          }
          return;
        }

        if (!window.location.pathname.startsWith("/posteingang")) {
          router.push("/posteingang");
          window.setTimeout(() => {
            const retry = runUiAction(command.action);
            appendDebug("UI_ACTION_RETRY", retry);
          }, 700);
          if (command.action.key === "inbox-ai-send") {
            say("Ich öffne den Posteingang und versuche dort auf Senden zu klicken.");
          } else if (command.action.key === "inbox-ai-edit") {
            pendingInboxDraftRef.current = true;
            say("Ich öffne den Posteingang und aktiviere Bearbeiten. Danach sag mir bitte den gewünschten Text.");
          } else {
            say("Ich öffne den Posteingang und versuche die KI-Antwort dort auszulösen.");
          }
          return;
        }

        if (command.action.key === "inbox-ai-send") {
          say("Ich finde den Senden-Button gerade nicht. Wähl bitte zuerst eine Unterhaltung oder einen Entwurf aus.");
        } else if (command.action.key === "inbox-ai-edit") {
          say("Ich finde den Bearbeiten-Button gerade nicht. Bitte erst eine KI-Antwort erzeugen oder eine Unterhaltung auswählen.");
        } else {
          say("Ich finde den KI-Antwort-Button gerade nicht. Wähl bitte zuerst eine Unterhaltung aus.");
        }
        return;
      }

      // 3) Lokale Snapshot-Frage → sofort aus vorhandenen Daten antworten.
      if (command.kind === "local-query") {
        appendDebug("LOCAL_QUERY", command.query);
        const answer = answerLocalQuery(command.query, dashboard);
        if (answer) {
          appendDebug("ANSWER_SOURCE", "local-query");
          say(answer);
          return;
        }
        // Kein Snapshot → an die KI weiterreichen (unten).
      }

      // 3b) Unklare Aktion ohne Ziel: menschlich nachfragen statt steifer KI-Text.
      if (command.kind === "ai") {
        const ambiguous = detectAmbiguousAction(interpretedUtterance);
        if (ambiguous?.type === "toggle") {
          appendDebug("WHY_NOT_UNDERSTOOD", "ambiguous-action-missing-target");
          appendDebug("SUGGESTIONS", ambiguous.suggestions);
          say(
            "Klar, ich helfe dir gern. Was genau soll ich schalten? " +
            `Du kannst zum Beispiel sagen: ${ambiguous.suggestions.join(" ")}`,
          );
          return;
        }
      }

      // 4) Sonst: Frage ans KI-Backend.
      setPhaseBoth("thinking");
      setReply("");
      try {
        appendDebug("ANSWER_SOURCE", "backend");
        appendDebug("BACKEND_REQUEST", { utterance: interpretedUtterance });
        const response = await fetch("/api/v1/dashboard/voice", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            utterance: interpretedUtterance,
            snapshot: buildSnapshot(dashboard),
          }),
        });
        const data = (await response.json().catch(() => null)) as
          | { reply?: string; detail?: string; message?: string }
          | null;
        if (!response.ok) {
          throw new Error(
            toUiText(data?.detail ?? data?.message, "Andy ist nicht erreichbar."),
          );
        }
        const answer = data?.reply?.trim() || "";
        if (!answer) {
          throw new Error(t("emptyReply"));
        }
        appendDebug("BACKEND_REPLY", answer);
        say(answer);
      } catch (err) {
        const message = toUiText(err, "Unbekannter Fehler.");
        appendDebug("BACKEND_ERROR", message);
        setError(message);
        enterFollowUp();
      }
    },
    [dashboard, setPhaseBoth, router, enterFollowUp, appendDebug],
  );

  // askAndy-Ref immer auf die aktuelle Version zeigen lassen.
  useEffect(() => {
    askAndyRef.current = (utterance: string) => {
      void askAndy(utterance);
    };
  }, [askAndy]);

  // Consent clientseitig lesen.
  useEffect(() => {
    setConsent(readVoiceConsent());
    const RecognitionCtor =
      typeof window !== "undefined"
        ? window.SpeechRecognition ?? window.webkitSpeechRecognition
        : undefined;
    setSupported(Boolean(RecognitionCtor));
  }, []);

  // Ohne dashboard-Prop (Layout-Fall): Snapshot + Nutzer client-seitig laden,
  // damit Andy auf jeder Seite lebt und trotzdem begruessen/antworten kann.
  useEffect(() => {
    if (dashboardProp) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [dashRes, propRes, meRes] = await Promise.all([
          fetch("/api/v1/reservations/dashboard", { credentials: "include" }),
          fetch("/api/v1/properties", { credentials: "include" }),
          fetch("/api/v1/auth/me", { credentials: "include" }),
        ]);
        const dash = (await dashRes.json().catch(() => null)) as
          | DashboardVoiceSnapshot
          | null;
        const props = (await propRes.json().catch(() => null)) as
          | { items?: DashboardVoiceSnapshot["properties"] }
          | null;
        const me = (await meRes.json().catch(() => null)) as
          | { email?: string | null }
          | null;
        if (cancelled || !dash) {
          return;
        }
        setDashboard({
          ...dash,
          properties: props?.items ?? [],
        });
        if (me?.email) {
          setUserLabel(me.email);
        }
      } catch {
        // Andy funktioniert auch ohne frische Daten (leerer Snapshot).
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dashboardProp]);

  // Dauer-Erkennung aufsetzen, sobald Consent erteilt ist. Haengt BEWUSST nur an
  // [consent] — so laeuft genau EINE Erkennungsinstanz stabil durch, unabhaengig
  // von dashboard/askAndy-Neubildungen. Zugriff auf die aktuelle Frage-Logik via
  // askAndyRef, auf die Phase via phaseRef.
  useEffect(() => {
    if (consent !== "granted") {
      return;
    }
    const RecognitionCtor =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!RecognitionCtor) {
      setSupported(false);
      return;
    }

    activeRef.current = true;
    // Bewusste Pause (Andy spricht) — kein Selbst-Restart, kein Selbst-Zuhoeren.
    let paused = false;
    const recognition = new RecognitionCtor();
    recognition.lang = "de-DE";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;

    // Startet die Erkennung, falls sie gerade NICHT laeuft. Idempotent — der
    // running-Guard verhindert den „InvalidStateError: already started".
    const ensureRunning = () => {
      if (!activeRef.current || runningRef.current) {
        return;
      }
      try {
        recognition.start();
      } catch {
        // Falls doch schon aktiv — onstart korrigiert den Guard.
      }
    };

    recognition.onstart = () => {
      runningRef.current = true;
    };

    // Verarbeitet den fertig gesammelten Satz (nach Sprechpause).
    const processPhrase = () => {
      const said = phraseBufferRef.current.trim();
      phraseBufferRef.current = "";
      if (!said) {
        return;
      }
      appendDebug("PHRASE_FINAL", said);
      // Waehrend Andy denkt/spricht: nichts annehmen (verhindert Selbst-Trigger).
      if (phaseRef.current === "thinking" || phaseRef.current === "speaking") {
        return;
      }
      if (phaseRef.current === "awake") {
        // Andy wartet auf die Frage → dieser Satz ist die Frage. Ein evtl. erneut
        // vorangestelltes „Hallo Andy" wird abgeschnitten.
        const { hit: w, rest: r } = stripLeadingWake(said);
        appendDebug("AWAKE_WAKE_MATCH", { hit: w, rest: r });
        askAndyRef.current(w && r ? r : said);
        return;
      }

      // Wenn eine Aktion auf Ja/Nein wartet, akzeptieren wir im Idle explizite
      // Bestätigungen auch ohne erneutes Wake-Word.
      if (phaseRef.current === "idle" && pendingActionRef.current) {
        const conf = classifyConfirmation(said);
        appendDebug("IDLE_CONFIRMATION_CLASSIFIED", conf);
        if (conf === "yes" || conf === "no") {
          appendDebug("IDLE_CONFIRMATION_BYPASS_WAKE", "pending-action");
          askAndyRef.current(said);
          return;
        }
      }

      // idle → auf Wake-Word pruefen.
      const { hit, rest } = matchWake(said);
      appendDebug("IDLE_WAKE_MATCH", { hit, rest });
      if (!hit) {
        appendDebug("IGNORED", "no-wake-word-in-idle");
        return;
      }
      if (rest) {
        // „Andy, für welches Objekt ist Dynamic Pricing aktiv?" → Frage steckt drin.
        askAndyRef.current(rest);
      } else {
        // Nur „Andy" → aufwachen und auf die Frage warten.
        setPhaseBoth("awake");
        setTranscript("");
        setError(null);
        speakText("Ja?", null);
      }
    };

    // Sammelt finale Segmente und verarbeitet den Satz erst nach einer kurzen
    // Sprechpause — so kommt der GANZE Satz an, nicht nur ein Stichwort.
    recognition.onresult = (event) => {
      let addedFinal = false;
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const res = event.results[i];
        if (!res.isFinal) {
          continue;
        }
        const alternatives: string[] = [];
        for (let j = 0; j < res.length; j += 1) {
          const alt = res[j]?.transcript?.trim();
          if (alt) {
            alternatives.push(alt);
          }
        }
        if (alternatives.length > 1) {
          appendDebug("ASR_ALTERNATIVES", alternatives);
        }
        const chunk = pickBestTranscript(res).trim();
        if (!chunk) {
          continue;
        }
        phraseBufferRef.current = (phraseBufferRef.current + " " + chunk).trim();
        appendDebug("ASR_CHUNK_FINAL", chunk);
        addedFinal = true;
      }
      if (!addedFinal) {
        return; // nur Zwischenergebnis — weiter zuhoeren.
      }
      // Debounce: nach PHRASE_PAUSE_MS ohne neues Segment gilt der Satz als fertig.
      if (phraseTimerRef.current) {
        window.clearTimeout(phraseTimerRef.current);
      }
      phraseTimerRef.current = window.setTimeout(processPhrase, PHRASE_PAUSE_MS);
    };

    recognition.onerror = (event) => {
      if (event.error === "aborted") {
        appendDebug("ASR_INFO", "aborted (expected during pause/speak)");
      } else if (event.error === "no-speech") {
        appendDebug("ASR_INFO", "no-speech");
      } else {
        appendDebug("ASR_ERROR", event.error);
      }
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        activeRef.current = false;
        setError("Mikrofonzugriff nicht erlaubt.");
      }
      // no-speech/aborted/network etc. sind harmlos — onend startet neu.
    };

    // Dauerlauschen: bei jedem Ende neu starten, solange aktiv und nicht bewusst
    // pausiert (Andy spricht gerade).
    recognition.onend = () => {
      runningRef.current = false;
      if (!activeRef.current || paused) {
        return;
      }
      if (restartTimerRef.current) {
        window.clearTimeout(restartTimerRef.current);
      }
      restartTimerRef.current = window.setTimeout(ensureRunning, 300);
    };

    // Von aussen (askAndy) steuerbar: waehrend Andy spricht Erkennung stoppen.
    pauseListeningRef.current = () => {
      paused = true;
      // Angesammelten Satzrest verwerfen + Debounce stoppen (kein Nachhall).
      phraseBufferRef.current = "";
      if (phraseTimerRef.current) {
        window.clearTimeout(phraseTimerRef.current);
        phraseTimerRef.current = null;
      }
      try {
        recognition.abort();
      } catch {
        // egal
      }
    };
    resumeListeningRef.current = () => {
      paused = false;
      ensureRunning();
    };

    recognitionRef.current = recognition;
    ensureRunning();

    // Sicherheitsnetz: falls die Erkennung doch mal still stirbt (Chrome beendet
    // sie nach ~1 min Stille ohne onend), regelmaessig neu anstupsen — aber nicht
    // waehrend Andy bewusst pausiert (spricht).
    const watchdog = window.setInterval(() => {
      if (!paused) {
        ensureRunning();
      }
    }, 4000);

    return () => {
      activeRef.current = false;
      runningRef.current = false;
      window.clearInterval(watchdog);
      if (restartTimerRef.current) {
        window.clearTimeout(restartTimerRef.current);
      }
      if (followUpTimerRef.current) {
        window.clearTimeout(followUpTimerRef.current);
      }
      if (phraseTimerRef.current) {
        window.clearTimeout(phraseTimerRef.current);
      }
      recognition.onend = null;
      recognition.onstart = null;
      recognition.onresult = null;
      recognition.onerror = null;
      try {
        recognition.abort();
        recognition.stop();
      } catch {
        // egal
      }
      recognitionRef.current = null;
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      // Mikrofon-Indikator sicher löschen (Chrome/Safari geben den intern
      // gekapselten SpeechRecognition-Stream nach abort() nicht immer frei).
      releaseMicrophone();
    };
  }, [consent, setPhaseBoth, appendDebug]);

  // Consent erteilen: speichern, begruessen (in der Klick-Geste → Speech frei).
  function activateAndy(): void {
    writeVoiceConsent("granted");
    setConsent("granted");
    setOpen(true);
    setError(null);
    const welcome = buildWelcome(dashboard, userLabel);
    setReply(welcome);
    setPhaseBoth("speaking");
    speakText(welcome, () => setPhaseBoth("idle"));
  }

  function deactivateAndy(): void {
    // Zuerst den Auto-Restart hart stoppen: activeRef=false + laufende Timer
    // clearen, damit onend NICHT ensureRunning() neu aufruft (sonst zieht das
    // Mikrofon direkt nach dem abort() wieder hoch → „Micro bleibt an").
    activeRef.current = false;
    runningRef.current = false;
    if (restartTimerRef.current) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        // onend abklemmen, bevor abort/stop den Stream schließt — kein Restart.
        recognitionRef.current.onend = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.abort();
        recognitionRef.current.stop();
      } catch {
        // egal
      }
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setPhaseBoth("idle");
    writeVoiceConsent("denied");
    setConsent("denied");
    releaseMicrophone();
  }

  // Ausgeschaltet (denied) → nur ein kleines, unaufdringliches Icon zum
  // Wieder-Einschalten. Andy lauscht NICHT und verdeckt den Bildschirm nicht.
  if (consent === "denied") {
    return (
      <button
        type="button"
        aria-label={t("turnOn")}
        title={t("turnOn")}
        onClick={activateAndy}
        className="fixed bottom-6 right-6 z-50 flex size-10 items-center justify-center rounded-full border bg-card text-muted-foreground shadow-md transition hover:text-foreground"
      >
        <Icon icon="ph:microphone-slash" className="size-5" />
      </button>
    );
  }

  // --- Consent-Gate (erstmalig / null) --------------------------------------
  if (consent !== "granted") {
    return (
      <div className="fixed bottom-6 right-6 z-50 w-[min(22rem,calc(100vw-3rem))] rounded-2xl border border-border/80 bg-card/98 p-4 shadow-xl backdrop-blur">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Icon icon="ph:waveform" className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="font-display text-sm font-semibold">{t("subtitle")}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Sag einfach „Hallo Andy" und stell deine Frage — freihändig, wie bei
              Siri. Andy braucht dafür Mikrofon-Zugriff.
            </p>
            <div className="mt-3 flex gap-2">
              <Button
                type="button"
                size="sm"
                onClick={activateAndy}
                className="h-8 px-4 text-xs"
              >
                Andy aktivieren
              </Button>
              {consent === "denied" ? null : (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={deactivateAndy}
                  className="h-8 px-4 text-xs"
                >
                  Später
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Eingeklappt → kleiner Wieder-Öffnen-Knopf (Andy lauscht weiter).
  if (!open) {
    return (
      <button
        type="button"
        aria-label={t("open")}
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl transition hover:scale-105"
      >
        <Icon icon="ph:microphone-stage" className="size-5" />
      </button>
    );
  }

  // --- Aktives Andy-Popup ---------------------------------------------------
  const statusLabel =
    phase === "awake"
      ? "Hört zu…"
      : phase === "thinking"
        ? "Denkt nach…"
        : phase === "speaking"
          ? "Spricht…"
          : "Sag „Hallo Andy“";

  const dotClass =
    phase === "awake"
      ? "bg-destructive"
      : phase === "thinking"
        ? "bg-primary"
        : phase === "speaking"
          ? "bg-primary"
          : "bg-emerald-500";
  const pinging = phase === "awake" || phase === "thinking" || phase === "speaking";

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[min(22rem,calc(100vw-3rem))] rounded-2xl border border-border/80 bg-card/98 shadow-xl backdrop-blur">
      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="relative flex size-2 items-center justify-center">
            {pinging ? (
              <span className={"absolute inline-flex size-2 animate-ping rounded-full " + dotClass} />
            ) : null}
            <span className={"relative inline-flex size-2 rounded-full " + dotClass} />
          </span>
          <span className="font-display text-sm font-semibold">Andy</span>
          <span className="text-xs text-muted-foreground">{statusLabel}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={t("collapse")}
            onClick={() => setOpen(false)}
            className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            <Icon icon="ph:minus" className="size-4" />
          </button>
          <button
            type="button"
            aria-label={t("turnOff")}
            title={t("turnOff")}
            onClick={deactivateAndy}
            className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            <Icon icon="ph:power" className="size-4" />
          </button>
        </div>
      </div>

      <div className="space-y-2 px-4 py-3">
        {transcript ? (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Du:</span> {transcript}
          </p>
        ) : null}
        <p className="min-h-10 text-sm leading-6">
          {reply || "Sag „Hallo Andy“ und dann deine Frage."}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDebugOpen((v) => !v)}
            className="text-xs text-muted-foreground underline-offset-2 transition hover:text-foreground hover:underline"
          >
            {debugOpen ? "Debug ausblenden" : "Debug anzeigen"}
          </button>
          {debugLines.length > 0 ? (
            <button
              type="button"
              onClick={() => setDebugLines([])}
              className="text-xs text-muted-foreground underline-offset-2 transition hover:text-foreground hover:underline"
            >
              Log leeren
            </button>
          ) : null}
        </div>
        {debugOpen ? (
          <div className="max-h-44 overflow-auto rounded-md border border-border/70 bg-muted/30 p-2">
            {debugLines.length > 0 ? (
              <div className="space-y-1">
                {debugLines.map((line, idx) => (
                  <p key={`${idx}-${line}`} className="break-words font-mono text-[0.6875rem] leading-4 text-muted-foreground">
                    {line}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-[0.6875rem] text-muted-foreground">
                Noch keine Debug-Ereignisse.
              </p>
            )}
          </div>
        ) : null}
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        {!supported ? (
          <p className="text-xs text-muted-foreground">
            Spracherkennung nur in Chrome/Edge verfügbar.
          </p>
        ) : null}
      </div>
    </div>
  );
}

// Liest text vor und ruft onDone nach dem Ende. speakText darf beim ersten Aufruf
// aus einer User-Geste kommen; danach ist die Engine frei. Kein cancel() direkt
// vor speak() (verschluckt in Chrome die Ausgabe).
function speakText(text: string, onDone: (() => void) | null): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    onDone?.();
    return;
  }
  const synth = window.speechSynthesis;
  // Alte Ausgabe sauber beenden, BEVOR neu gestartet wird (nicht direkt vor
  // demselben speak() — hier ist es ein separater, frueherer Schritt).
  synth.cancel();

  const speakNow = () => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "de-DE";
    utterance.rate = 0.96;
    const voice = pickGermanVoice(synth);
    if (voice) {
      utterance.voice = voice;
    }

    // Chrome-Bug: bei laengeren Utterances friert die Queue ein und es kommt
    // kein Ton. Ein periodischer pause()/resume()-Kick haelt sie am Leben.
    let keepAlive: number | null = window.setInterval(() => {
      if (!synth.speaking) {
        return;
      }
      synth.pause();
      synth.resume();
    }, 5000);
    const stopKeepAlive = () => {
      if (keepAlive !== null) {
        window.clearInterval(keepAlive);
        keepAlive = null;
      }
    };

    utterance.onend = () => {
      stopKeepAlive();
      onDone?.();
    };
    utterance.onerror = () => {
      stopKeepAlive();
      onDone?.();
    };

    synth.speak(utterance);
    // Manche Chrome-Versionen starten pausiert — sofort anstupsen.
    window.setTimeout(() => {
      if (synth.paused) {
        synth.resume();
      }
    }, 100);
  };

  if (synth.getVoices().length > 0) {
    speakNow();
    return;
  }
  // Stimmen noch nicht geladen: einmal auf voiceschanged warten, dann sprechen.
  const onVoicesChanged = () => {
    synth.removeEventListener("voiceschanged", onVoicesChanged);
    speakNow();
  };
  synth.addEventListener("voiceschanged", onVoicesChanged);
  // Manche Browser laden Netz-/Premium-Stimmen verzoegert nach. Ein fruehes
  // Fallback fuehrt sonst fast immer zur gleichen Basis-Stimme.
  synth.getVoices();
  // Fallback: falls voiceschanged nie feuert, trotzdem nach kurzer Zeit sprechen.
  window.setTimeout(() => {
    synth.removeEventListener("voiceschanged", onVoicesChanged);
    if (!synth.speaking && !synth.pending) {
      speakNow();
    }
  }, 1500);
}

// Gewuenschte Hauptstimme: Katja (Azure/Microsoft de-DE). Da Browser je nach
// Plattform unterschiedliche Anzeigenamen nutzen, matchen wir ueber mehrere
// stabile Hinweise und fallen erst danach auf generische Deutsch-Stimmen zurueck.
const PREFERRED_GERMAN_VOICE_HINTS = [
  "de-de-katjaneural",
  "katja neural",
  "microsoft katja online",
  "katja",
];

const NATURAL_GERMAN_VOICE_HINTS = [
  "natural",
  "neural",
  "online",
  "premium",
  "enhanced",
  "google",
  "siri",
  "anna",
  "petra",
  "vicki",
  "daniel",
  "lennart",
  "hannah",
  "sabrina",
];

const ROBOTIC_GERMAN_VOICE_HINTS = [
  "compact",
  "classic",
  "default",
  "espeak",
  "sapi",
  "old",
  "legacy",
];

function scoreGermanVoice(voice: SpeechSynthesisVoice): number {
  const haystack = `${voice.name} ${voice.voiceURI}`.toLowerCase();
  let score = 0;

  if (voice.lang.toLowerCase() === "de-de") {
    score += 60;
  } else if (voice.lang.toLowerCase().startsWith("de")) {
    score += 40;
  }

  // Netzwerk-/Online-Stimmen klingen im Schnitt deutlich natuerlicher.
  if (!voice.localService) {
    score += 35;
  }

  for (const hint of PREFERRED_GERMAN_VOICE_HINTS) {
    if (haystack.includes(hint)) {
      score += 120;
    }
  }
  for (const hint of NATURAL_GERMAN_VOICE_HINTS) {
    if (haystack.includes(hint)) {
      score += 18;
    }
  }
  for (const hint of ROBOTIC_GERMAN_VOICE_HINTS) {
    if (haystack.includes(hint)) {
      score -= 30;
    }
  }

  return score;
}

function pickGermanVoice(synth: SpeechSynthesis): SpeechSynthesisVoice | null {
  const voices = synth.getVoices();
  if (voices.length === 0) {
    return null;
  }

  const germanVoices = voices.filter((v) =>
    v.lang.toLowerCase().startsWith("de"),
  );
  if (germanVoices.length === 0) {
    return null;
  }

  germanVoices.sort((a, b) => scoreGermanVoice(b) - scoreGermanVoice(a));
  return germanVoices[0] ?? null;
}

function buildWelcome(
  dashboard: DashboardVoiceSnapshot,
  userLabel?: string | null,
): string {
  const name = userLabel?.split("@")[0]?.trim() || "Hallo";
  const checkins = dashboard.checkins_today.length;
  const checkouts = dashboard.checkouts_today.length;
  const upcoming = dashboard.upcoming.length;
  const objectCount = dashboard.properties.length;

  const parts = [
    `${name}, ich bin bereit.`,
    checkins > 0
      ? `Heute reisen ${checkins} Gäste an.`
      : "Heute reist niemand neu an.",
    checkouts > 0 ? `${checkouts} Check-outs stehen an.` : "",
    upcoming > 0 ? `${upcoming} Reservierungen sind in Vorbereitung.` : "",
    objectCount > 0 ? `Im Bestand sind ${objectCount} Objekte.` : "",
    "Sag einfach „Hallo Andy“ und dann deine Frage.",
  ].filter(Boolean);

  return parts.join(" ");
}
