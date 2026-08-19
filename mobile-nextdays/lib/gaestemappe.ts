// Gästemappe eines Objekts — die acht mehrsprachigen Gasttexte.
//
// EINE WAHRHEIT: Dieselben Daten wie im Web unter Objekt → „Gästemappe"
// (`web/app/(dashboard)/reservierungen/unterkuenfte/[id]/gaestemappe`) und
// Objekt → „Nachrichten" — beide schreiben in
// `properties.type_attributes.messaging`. Die Feldliste hier ist der Spiegel
// von `web/lib/messaging-meta.ts`; ein neuer Block wird dort UND hier
// eingetragen, sonst pflegt der Betrieb am Telefon einen Text, den keine
// Nachricht einsetzt.
//
// Wer die Texte liest: `apps/api/.../inbox/feld_kontext.py` löst die
// Platzhalter ({{CheckinInstructions}} …) in der Sprache des GASTES auf
// (Gastsprache → Englisch → Deutsch → erster gepflegter Text).
//
// FORMAT: Der Web-Editor ist ein Rich-Text-Editor, in `messaging` steht also
// HTML (`<p>`, `<strong>`, `<ul><li>`, `<a href>`). Die App hat keinen
// Rich-Text-Editor; sie zeigt und bearbeitet Klartext und wandelt beim
// Speichern zurück (`textZuHtml`). Was dabei NICHT überlebt — fett, kursiv,
// Link-Ziele —, wird dem Nutzer VOR dem Bearbeiten gesagt
// (`hatFormatierung`), statt es still zu verlieren.
import type { Property } from "@/lib/properties";

/** Sprachen der Gasttexte — identisch zu `web/lib/policy-meta.ts` LANGS. */
export const SPRACHEN = ["de", "en", "da"] as const;
export type Sprache = (typeof SPRACHEN)[number];

export const SPRACH_LABEL: Record<Sprache, string> = {
  de: "Deutsch",
  en: "English",
  da: "Dansk",
};

/** Ein Text in allen Sprachen (fehlende Sprache = leerer String, nie undefined). */
export type Mappentext = Record<Sprache, string>;

export type MappenFeld =
  | "checkIn"
  | "checkOut"
  | "directions"
  | "doorInstructions"
  | "rules"
  | "wifi"
  | "localGuide"
  | "emergency";

export type Gaestemappe = Record<MappenFeld, Mappentext>;

export type MappenFeldMeta = {
  key: MappenFeld;
  titel: string;
  hinweis: string;
  /** Platzhalter, mit dem der Text in eine Nachricht kommt. */
  shortcode: string;
  platzhalter: string;
  /** Symbol aus `components/ui/Icon.tsx`. */
  icon: string;
};

// Reihenfolge = Anzeige-Reihenfolge, wie im Web.
export const MAPPEN_FELDER: readonly MappenFeldMeta[] = [
  {
    key: "checkIn",
    titel: "Check-in-Anweisungen",
    hinweis: "Details zur Ankunft und Besonderheiten beim Check-in.",
    shortcode: "{{CheckinInstructions}}",
    platzhalter: "Check-in-Anweisungen eingeben",
    icon: "clock",
  },
  {
    key: "checkOut",
    titel: "Check-out-Anweisungen",
    hinweis: "Details zum Check-out und wer im Zweifel hilft.",
    shortcode: "{{CheckoutInstructions}}",
    platzhalter: "Check-out-Anweisungen eingeben",
    icon: "clock",
  },
  {
    key: "directions",
    titel: "Anfahrt",
    hinweis: "Wie Gäste zum Objekt gelangen.",
    shortcode: "{{RentalDirections}}",
    platzhalter: "Anfahrtsbeschreibung eingeben",
    icon: "map",
  },
  {
    key: "doorInstructions",
    titel: "Türzugang",
    hinweis: "Wie Gäste Zutritt erhalten (Türcode, Schlüssellage).",
    shortcode: "{{DoorInstructions}}",
    platzhalter: "Zugangs-Anweisungen eingeben",
    icon: "key",
  },
  {
    key: "rules",
    titel: "Hausordnung",
    hinweis: "Die Regeln im Objekt.",
    shortcode: "{{RentalRules}}",
    platzhalter: "Hausordnung eingeben",
    icon: "shield",
  },
  {
    key: "wifi",
    titel: "WLAN-Informationen",
    hinweis: "Netzname, Passwort und wie man die Verbindung prüft.",
    shortcode: "{{WifiInformation}}",
    platzhalter: "WLAN-Name & -Passwort eingeben",
    icon: "wifi",
  },
  {
    key: "localGuide",
    titel: "Reiseführer",
    hinweis: "Orte und Aktivitäten in der Umgebung.",
    shortcode: "{{LocalGuide}}",
    platzhalter: "Tipps für die Umgebung eingeben",
    icon: "compass",
  },
  {
    key: "emergency",
    titel: "Notfallkontakt",
    hinweis: "Wen Gäste im Notfall erreichen.",
    shortcode: "{{EmergencyContact}}",
    platzhalter: "Notfallkontakt eingeben",
    icon: "bellhop",
  },
];

export function mappenFeld(key: MappenFeld): MappenFeldMeta {
  const treffer = MAPPEN_FELDER.find((f) => f.key === key);
  // Der Aufrufer kommt aus MAPPEN_FELDER bzw. den Navigations-Parametern; ein
  // unbekannter Schlüssel ist ein Programmierfehler und soll auffallen, nicht
  // still einen leeren Block öffnen (Wurzel 4).
  if (!treffer) throw new Error(`Unbekanntes Gästemappe-Feld: ${key}`);
  return treffer;
}

function leererText(): Mappentext {
  return { de: "", en: "", da: "" };
}

/** Liest die Mappe robust aus `type_attributes` (Form unbekannt, alles optional). */
export function leseGaestemappe(attrs: Record<string, unknown> | null | undefined): Gaestemappe {
  const roh = istMap(attrs?.messaging) ? (attrs?.messaging as Record<string, unknown>) : {};
  const out = {} as Gaestemappe;
  for (const f of MAPPEN_FELDER) {
    const wert = roh[f.key];
    const text = leererText();
    if (istMap(wert)) {
      for (const s of SPRACHEN) {
        const v = (wert as Record<string, unknown>)[s];
        if (typeof v === "string") text[s] = v;
      }
    }
    out[f.key] = text;
  }
  return out;
}

/** Die Sprachen, in denen dieser Block gepflegt ist. */
export function gepflegteSprachen(text: Mappentext): Sprache[] {
  return SPRACHEN.filter((s) => htmlZuText(text[s]).trim().length > 0);
}

/** Wie viele der acht Blöcke überhaupt einen Text haben (in irgendeiner Sprache). */
export function anzahlGepflegt(mappe: Gaestemappe): number {
  return MAPPEN_FELDER.filter((f) => gepflegteSprachen(mappe[f.key]).length > 0).length;
}

/**
 * Der `type_attributes`-Wert für ein PATCH, das GENAU einen Block in GENAU
 * einer Sprache ändert.
 *
 * Der Endpoint ersetzt `type_attributes` als Ganzes, deshalb wird der
 * vorhandene Stand mitgegeben und nur der eine Wert ersetzt — sonst wären
 * Richtlinien, Betten und die anderen Sprachen nach dem Speichern weg
 * (Wurzel 1: der Gegenzustand muss mitgepflegt werden).
 *
 * Gebaut wird auf dem ROHEN `messaging`, nicht auf der gelesenen Mappe: sonst
 * löscht ein Speichern in der App alles, was diese Feldliste nicht kennt — eine
 * vierte Sprache oder einen Block, der erst im Web dazukommt. Was die App nicht
 * versteht, lässt sie stehen, statt es wegzuräumen.
 *
 * Ein Block, der als Klartext-String statt als Sprach-Map vorliegt (Altbestand),
 * wird zu `{ de: <Text> }` normalisiert — er darf nicht als Beifang verschwinden.
 */
export function mappeSchreiben(
  p: Property,
  feld: MappenFeld,
  sprache: Sprache,
  html: string,
): Record<string, unknown> {
  const attrs = p.type_attributes ?? {};
  const roh = istMap(attrs.messaging) ? (attrs.messaging as Record<string, unknown>) : {};
  const vorher = roh[feld];
  let block: Record<string, unknown>;
  if (istMap(vorher)) {
    block = { ...(vorher as Record<string, unknown>) };
  } else if (typeof vorher === "string" && vorher.trim()) {
    block = { de: vorher };
  } else {
    block = leererText() as unknown as Record<string, unknown>;
  }
  return {
    ...attrs,
    messaging: { ...roh, [feld]: { ...block, [sprache]: html } },
  };
}

/** Objekt, aber kein Array und kein null — die Form, die `messaging` haben muss. */
function istMap(wert: unknown): boolean {
  return typeof wert === "object" && wert !== null && !Array.isArray(wert);
}

// ---------------------------------------------------------------------------
// Rich-Text ↔ Klartext
//
// Gegenstücke: `html_zu_text` in `apps/api/.../inbox/felder.py` (dieselben vier
// Regeln) und `textZuHtml` in `web/components/inbox/composer-editor.tsx`. Die
// Rundreise Klartext → HTML → Klartext muss stabil sein, sonst wächst der Text
// bei jedem Speichern.
// ---------------------------------------------------------------------------

const ENTITAETEN: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
};

function entschluesseln(wert: string): string {
  return wert
    .replace(/&nbsp;|&amp;|&lt;|&gt;|&quot;|&#39;|&apos;/g, (e) => ENTITAETEN[e] ?? e)
    .replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(Number(code)));
}

function escapeHtml(wert: string): string {
  return wert
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Tags weg, `<br>` als Umbruch — für den Inhalt EINES Blocks/Listenpunkts. */
function inhaltZuText(html: string): string {
  return entschluesseln(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]*>/g, ""),
  ).trim();
}

function listeZuText(inner: string, marke: (i: number) => string): string {
  const punkte: string[] = [];
  const re = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
  let m = re.exec(inner);
  while (m) {
    punkte.push(inhaltZuText(m[1]));
    m = re.exec(inner);
  }
  // Zwischen den Punkten EINER Liste steht ein einfacher Umbruch — mit einer
  // Leerzeile zerfiele die Liste beim Zurücklesen in n Einzellisten.
  return punkte.map((p, i) => marke(i) + p).join("\n");
}

/** Rich-Text aus der Objektpflege → Klartext für Anzeige und Bearbeitung. */
export function htmlZuText(roh: string): string {
  if (!roh) return "";
  let t = roh.replace(/\r\n?/g, "\n");

  // `<a href="URL">Text</a>` → „Text (URL)": ein Ziel, das nur im href steht,
  // wäre im Klartext verloren.
  t = t.replace(
    /<a\b[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi,
    (_m, url: string, inneres: string) => {
      const text = inhaltZuText(inneres);
      const ziel = url.trim();
      if (!text) return ziel;
      return ziel && ziel !== text ? `${text} (${ziel})` : text;
    },
  );

  // Listen zuerst: sie tragen die Marken, die kein späterer Schritt mehr sieht.
  t = t.replace(/<ol\b([^>]*)>([\s\S]*?)<\/ol>/gi, (_m, attr: string, inner: string) => {
    const start = /start=["']?(\d+)/i.exec(attr);
    const ab = start ? Number(start[1]) : 1;
    return `\n\n${listeZuText(inner, (i) => `${ab + i}. `)}\n\n`;
  });
  t = t.replace(/<ul\b[^>]*>([\s\S]*?)<\/ul>/gi, (_m, inner: string) => {
    return `\n\n${listeZuText(inner, () => "- ")}\n\n`;
  });

  // `</p>` ist eine LEERZEILE, `<br>` nur ein Umbruch.
  t = t
    .replace(/<\/p\s*>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(div|h[1-6]|blockquote)\s*>/gi, "\n\n")
    .replace(/<[^>]*>/g, "");

  return entschluesseln(t)
    .split("\n")
    .map((z) => z.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Klartext aus der App → HTML, wie der Web-Editor es erwartet. */
export function textZuHtml(wert: string): string {
  const text = wert.trim();
  if (!text) return "";
  return text
    .split(/\n{2,}/)
    .map((absatz) => {
      const zeilen = absatz.split("\n").map((z) => escapeHtml(z.trim()));
      // Aufzählungen, die als Klartext eingegeben wurden („- …" / „1. …"),
      // werden zu echten Listen — sonst verliert der Text im Web-Editor seine
      // Gliederung.
      if (zeilen.every((z) => /^-\s+/.test(z))) {
        return `<ul>${zeilen.map((z) => `<li>${z.replace(/^-\s+/, "")}</li>`).join("")}</ul>`;
      }
      if (zeilen.every((z) => /^\d+\.\s+/.test(z))) {
        return `<ol>${zeilen.map((z) => `<li>${z.replace(/^\d+\.\s+/, "")}</li>`).join("")}</ol>`;
      }
      return `<p>${zeilen.join("<br>") || "<br>"}</p>`;
    })
    .join("");
}

/**
 * Trägt der gespeicherte Text Formatierung, die Klartext nicht halten kann?
 *
 * Absätze, Umbrüche und einfache Listen überleben die Rundreise; fett, kursiv,
 * unterstrichen, Links und verschachtelte Listen nicht. Wer hier bearbeitet,
 * wird vorher gefragt — ein stiller Verlust wäre nicht wiederherstellbar.
 */
export function hatFormatierung(html: string): boolean {
  if (!html) return false;
  if (/<(strong|b|em|i|u|s|del|code|a)\b/i.test(html)) return true;
  // Verschachtelte Liste: eine Liste INNERHALB eines Punktes.
  return /<li\b[^>]*>[\s\S]*?<(ul|ol)\b/i.test(html);
}
