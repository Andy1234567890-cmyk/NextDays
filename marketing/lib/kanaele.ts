// SCHWESTERDATEI: partner/lib/kanaele.ts == admin/lib/kanaele.ts == marketing/lib/kanaele.ts (byte-identisch).
// Plattformliste der Partner-Kanäle — gespiegelt aus
// apps/api/src/features/affiliates/kanaele.py. Logos sind die Original-
// Markenglyphen aus simple-icons (über @nextdays/icons gebündelt), generische
// Kanäle (Website, Blog …) bekommen Phosphor-Symbole.
export const PLATTFORMEN = [
  "instagram",
  "tiktok",
  "youtube",
  "facebook",
  "x",
  "linkedin",
  "pinterest",
  "threads",
  "twitch",
  "snapchat",
  "telegram",
  "whatsapp",
  "website",
  "blog",
  "newsletter",
  "podcast",
  "other",
] as const;

export type Plattform = (typeof PLATTFORMEN)[number];

export type SocialKanal = {
  platform: Plattform;
  url: string;
  handle: string | null;
  followers: number | null;
  // Reichweite (0521): bei verbundenem Konto trägt `followers` den letzten
  // Snapshot und `verified` ist gesetzt; die Selbstauskunft steht daneben.
  // Pflegt ausschließlich der Server — Eingaben hierzu werden überschrieben.
  followers_self_reported?: number | null;
  verified?: boolean;
  verified_at?: string | null;
  connection_id?: string | null;
};

/** Anzeige je Plattform: Markenname (nicht übersetzt), Icon, Markenfarbe, Beispiel-Adresse. */
export const PLATTFORM_META: Record<
  Plattform,
  { label: string; icon: string; farbe: string; beispiel: string; marke: boolean }
> = {
  instagram: { label: "Instagram", icon: "simple-icons:instagram", farbe: "#E4405F", beispiel: "https://www.instagram.com/", marke: true },
  tiktok: { label: "TikTok", icon: "simple-icons:tiktok", farbe: "#000000", beispiel: "https://www.tiktok.com/@", marke: true },
  youtube: { label: "YouTube", icon: "simple-icons:youtube", farbe: "#FF0000", beispiel: "https://www.youtube.com/@", marke: true },
  facebook: { label: "Facebook", icon: "simple-icons:facebook", farbe: "#0866FF", beispiel: "https://www.facebook.com/", marke: true },
  x: { label: "X", icon: "simple-icons:x", farbe: "#000000", beispiel: "https://x.com/", marke: true },
  linkedin: { label: "LinkedIn", icon: "simple-icons:linkedin", farbe: "#0A66C2", beispiel: "https://www.linkedin.com/in/", marke: true },
  pinterest: { label: "Pinterest", icon: "simple-icons:pinterest", farbe: "#BD081C", beispiel: "https://www.pinterest.com/", marke: true },
  threads: { label: "Threads", icon: "simple-icons:threads", farbe: "#000000", beispiel: "https://www.threads.net/@", marke: true },
  twitch: { label: "Twitch", icon: "simple-icons:twitch", farbe: "#9146FF", beispiel: "https://www.twitch.tv/", marke: true },
  snapchat: { label: "Snapchat", icon: "simple-icons:snapchat", farbe: "#FFFC00", beispiel: "https://www.snapchat.com/add/", marke: true },
  telegram: { label: "Telegram", icon: "simple-icons:telegram", farbe: "#26A5E4", beispiel: "https://t.me/", marke: true },
  whatsapp: { label: "WhatsApp", icon: "simple-icons:whatsapp", farbe: "#25D366", beispiel: "https://wa.me/", marke: true },
  website: { label: "Website", icon: "ph:globe", farbe: "", beispiel: "https://", marke: false },
  blog: { label: "Blog", icon: "ph:article", farbe: "", beispiel: "https://", marke: false },
  newsletter: { label: "Newsletter", icon: "ph:envelope-simple", farbe: "", beispiel: "https://", marke: false },
  podcast: { label: "Podcast", icon: "ph:microphone", farbe: "", beispiel: "https://", marke: false },
  other: { label: "Other", icon: "ph:link", farbe: "", beispiel: "https://", marke: false },
};

const DOMAINS: [string, Plattform][] = [
  ["instagram.com", "instagram"],
  ["instagr.am", "instagram"],
  ["tiktok.com", "tiktok"],
  ["youtube.com", "youtube"],
  ["youtu.be", "youtube"],
  ["facebook.com", "facebook"],
  ["fb.com", "facebook"],
  ["fb.me", "facebook"],
  ["x.com", "x"],
  ["twitter.com", "x"],
  ["linkedin.com", "linkedin"],
  ["lnkd.in", "linkedin"],
  ["pinterest.com", "pinterest"],
  ["pinterest.de", "pinterest"],
  ["pinterest.dk", "pinterest"],
  ["pin.it", "pinterest"],
  ["threads.net", "threads"],
  ["threads.com", "threads"],
  ["twitch.tv", "twitch"],
  ["snapchat.com", "snapchat"],
  ["t.me", "telegram"],
  ["telegram.me", "telegram"],
  ["whatsapp.com", "whatsapp"],
  ["wa.me", "whatsapp"],
];

/** Plattform am Host erkennen (Subdomains zählen mit); null = kein bekanntes Netzwerk. */
export function plattformAusUrl(url: string): Plattform | null {
  let host: string;
  try {
    host = new URL(url.trim()).hostname.toLowerCase();
  } catch {
    return null;
  }
  while (host) {
    const treffer = DOMAINS.find(([d]) => d === host);
    if (treffer) return treffer[1];
    const punkt = host.indexOf(".");
    if (punkt < 0) break;
    host = host.slice(punkt + 1);
  }
  return null;
}

/** Reichweite kompakt: 12 300 → „12,3k“, 1 200 000 → „1,2M“. */
export function reichweite(n: number | null, locale = "de"): string {
  if (n === null) return "";
  return new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

// Profil-Adresse je Plattform aus dem Handle — gespiegelt aus
// apps/api/.../kanaele.py (`_PROFIL_MUSTER`). Eine Plattform ohne Eintrag hier
// braucht die vollständige Adresse; der Handle allein genügt dort nicht.
//
// WARUM DER HANDLE FÜHRT (03.09.2026): die Bewerbung verlangte vorher die
// Profil-ADRESSE. Bewerber kennen aber ihren Benutzernamen, nicht die URL — die
// steht in keiner App sichtbar und muss über „Profil teilen → Link kopieren"
// geholt werden. Wer sie nicht findet, tippt etwas Falsches oder bricht ab.
const PROFIL_MUSTER: Partial<Record<Plattform, string>> = {
  instagram: "https://www.instagram.com/{h}",
  tiktok: "https://www.tiktok.com/@{h}",
  youtube: "https://www.youtube.com/@{h}",
  facebook: "https://www.facebook.com/{h}",
  x: "https://x.com/{h}",
  linkedin: "https://www.linkedin.com/in/{h}",
  pinterest: "https://www.pinterest.com/{h}",
  threads: "https://www.threads.net/@{h}",
  twitch: "https://www.twitch.tv/{h}",
  snapchat: "https://www.snapchat.com/add/{h}",
  telegram: "https://t.me/{h}",
};

/** True, wenn bei dieser Plattform der Benutzername allein genügt. */
export function hatHandle(p: Plattform): boolean {
  return PROFIL_MUSTER[p] !== undefined;
}

/** Wie der Benutzername auf dieser Plattform angezeigt wird (Beispiel im Feld). */
export function handleBeispiel(p: Plattform): string {
  return p === "linkedin" ? "pia-partner" : "pia.reist";
}

// Erlaubte Zeichen eines Handles — dieselbe Regel wie serverseitig, damit die
// Meldung schon beim Tippen kommt und nicht erst als 422.
const HANDLE_ERLAUBT = /^[A-Za-z0-9._-]{1,100}$/;

/** Handle normalisieren: @ und Leerzeichen weg. Leer → null. */
export function handleBereinigen(handle: string): string | null {
  const wert = handle.trim().replace(/^@+/, "").trim();
  return wert || null;
}

/** True, wenn der Handle serverseitig durchgeht (leer gilt als „noch nichts getippt"). */
export function handleGueltig(handle: string): boolean {
  const wert = handleBereinigen(handle);
  return wert === null || HANDLE_ERLAUBT.test(wert);
}

// Pfadsegmente, die KEIN Handle sind (LinkedIn `/in/`, YouTube `/channel/` …).
const KEIN_HANDLE = new Set(["in", "add", "channel", "c", "user", "p", "pin", "profile.php"]);

/** Profil-Adresse aus Plattform + Handle; null, wenn die Plattform keine hat. */
export function profilUrl(p: Plattform, handle: string): string | null {
  const muster = PROFIL_MUSTER[p];
  const wert = handleBereinigen(handle);
  if (muster === undefined || wert === null) return null;
  return muster.replace("{h}", encodeURIComponent(wert));
}

/** Handle aus einer Profil-Adresse lesen; null, wenn keiner erkennbar ist. */
export function handleAusUrl(url: string): string | null {
  let pfad: string;
  try {
    pfad = new URL(url.trim()).pathname;
  } catch {
    return null;
  }
  for (const teil of pfad.split("/")) {
    const stueck = teil.trim().replace(/^@+/, "");
    if (!stueck || KEIN_HANDLE.has(stueck.toLowerCase())) continue;
    return HANDLE_ERLAUBT.test(stueck) ? stueck : null;
  }
  return null;
}

/**
 * Eingabe im Handle-Feld deuten. Wer eine ganze Adresse einklebt (häufig, weil
 * „Link kopieren" genau das liefert), soll nicht scheitern: dann wird die
 * Plattform am Host erkannt und der Handle aus dem Pfad gelesen.
 */
export function handleEingabeDeuten(eingabe: string): {
  handle: string | null;
  plattform: Plattform | null;
  url: string | null;
} {
  const wert = eingabe.trim();
  if (!/^https?:\/\//i.test(wert)) {
    return { handle: handleBereinigen(wert), plattform: null, url: null };
  }
  return { handle: handleAusUrl(wert), plattform: plattformAusUrl(wert), url: wert };
}
