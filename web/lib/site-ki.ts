"use server";

// KI-Assistent des Website-Baukastens (0463–0465) — Server-Actions gegen
// /api/v1/site-config/ki/*.
//
// Eigene Datei und nicht ein Anhang an `site-pages.ts`: der Assistent ist eine
// eigene Ressource mit eigenem Zustand (verfügbar? Tagesdeckel? Profil?), und
// er wird aus VIER verschiedenen Oberflächen aufgerufen — dem Texteditor, der
// SEO-Seite, der Mediathek und den Einstellungen.
//
// Zu `"use server"`: hier dürfen AUSSCHLIESSLICH async functions exportiert
// werden. Typen sind erlaubt (sie verschwinden beim Kompilieren), ein `const`
// oder Objekt bricht den Build erst in „Collecting page data".
import { revalidatePath } from "next/cache";

import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";

/** Woher ein Text stammt. Dieselben drei Werte wie in der Datenbank (0463).
 *
 *  `ai_rewritten` ist assistierende Bearbeitung — keine Kennzeichnung, keine
 *  Freigabe. Nur `ai_generated` löst beides aus. */
export type Herkunft = "human" | "ai_rewritten" | "ai_generated";

/** Die fünf Bearbeitungen des Texteditor-Assistenten. */
export type UmschreibArt =
  | "kuerzen"
  | "verlaengern"
  | "ton"
  | "rechtschreibung"
  | "uebersetzen";

export type KiStatus = {
  /** false = die Anbindung ist nicht eingerichtet. Die Oberfläche zeigt die
   *  KI-Knöpfe dann GAR NICHT — statt einen Knopf anzubieten, der beim Klicken
   *  einen Fehler wirft. */
  verfuegbar: boolean;
  modell: string | null;
  region: string | null;
  verbrauch_heute: number;
  tageslimit: number;
  profil_gepflegt: boolean;
};

export type TextAntwort = {
  text: string;
  herkunft: Herkunft;
  modell: string;
  region: string;
  /** Nicht-blockierende Hinweise: abgeschnittener Text, verbotene Wörter.
   *  Sie werden ANGEZEIGT, nicht verschluckt — ein bei der Token-Grenze
   *  gekappter Text sieht fertig aus. */
  warnungen: string[];
  verbrauch_heute: number;
  tageslimit: number;
};

export type SeoAntwort = {
  seo_title: string;
  seo_description: string;
  modell: string;
  region: string;
  warnungen: string[];
  verbrauch_heute: number;
  tageslimit: number;
};

export type AltTextAntwort = {
  alt_text: string;
  modell: string;
  region: string;
  warnungen: string[];
  verbrauch_heute: number;
  tageslimit: number;
};

export type KiProfil = {
  ton: string | null;
  zielgruppe: string | null;
  alleinstellung: string | null;
  verbotene_woerter: string[];
  notiz: string | null;
};

export type ProfilVorschlag = {
  ton: string | null;
  zielgruppe: string | null;
  alleinstellung: string | null;
  modell: string;
  region: string;
  verbrauch_heute: number;
  tageslimit: number;
};

export type Freigabestand = {
  seite_offen: boolean;
  offene_abschnitte: string[];
  enthaelt_erzeugten_text: boolean;
};

type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

async function call<T>(
  path: string,
  opts: { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: unknown } = {},
): Promise<Result<T>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  try {
    const data = await api<T>(path, { ...opts, token });
    return { ok: true, data };
  } catch (exc) {
    const error =
      exc instanceof ApiError ? exc.message : "Aktion fehlgeschlagen.";
    const status = exc instanceof ApiError ? exc.status : undefined;
    return { ok: false, error, status };
  }
}

/** Ist der Assistent eingerichtet, und wie viel ist heute verbraucht?
 *
 *  Wird VOR dem Zeichnen der Oberfläche gefragt. Ein `verfuegbar: false`
 *  bedeutet: keine Knöpfe zeigen. Das ist die Anforderung „fehlt die
 *  Umgebungsvariable, erscheint die Funktion gar nicht". */
export async function kiStatus(): Promise<Result<KiStatus>> {
  return call("/site-config/ki/status");
}

/** Markierten Text bearbeiten. Ergebnis ist immer `ai_rewritten`. */
export async function kiUmschreiben(eingabe: {
  text: string;
  art: UmschreibArt;
  sprache: string;
  ton?: string;
  zielsprache?: string;
}): Promise<Result<TextAntwort>> {
  return call("/site-config/ki/umschreiben", {
    method: "POST",
    body: eingabe,
  });
}

/** Meta-Titel und -Beschreibung aus dem tatsächlichen Seiteninhalt. */
export async function kiSeo(eingabe: {
  page_id: string;
  sprache: string;
}): Promise<Result<SeoAntwort>> {
  return call("/site-config/ki/seo", { method: "POST", body: eingabe });
}

/** Einen Abschnittstext NEU erzeugen. Ergebnis ist `ai_generated` — also
 *  kennzeichnungspflichtig und vor der Veröffentlichung freizugeben. */
export async function kiAbschnitt(eingabe: {
  sprache: string;
  auftrag: string;
  property_id?: string;
  woerter?: number;
}): Promise<Result<TextAntwort>> {
  return call("/site-config/ki/abschnitt", { method: "POST", body: eingabe });
}

/** Einen Blogbeitrag NEU erzeugen. Bekommt zusätzlich den Fußhinweis beim
 *  Gast — ein Beitrag kann die Grenze zum öffentlichen Interesse reißen. */
export async function kiBlogbeitrag(eingabe: {
  sprache: string;
  thema: string;
  woerter?: number;
}): Promise<Result<TextAntwort>> {
  return call("/site-config/ki/blogbeitrag", { method: "POST", body: eingabe });
}

/** Alternativtext für ein Bild der Mediathek. */
export async function kiAltText(eingabe: {
  medium_id: string;
  sprache: string;
}): Promise<Result<AltTextAntwort>> {
  return call("/site-config/ki/alt-text", { method: "POST", body: eingabe });
}

export async function kiProfilLesen(): Promise<Result<KiProfil>> {
  return call("/site-config/ki/profil");
}

/** Die Haltung setzen. VOLLSTÄNDIG, nicht als Teiländerung: die Felder wirken
 *  zusammen, und eine Teiländerung wäre nicht unterscheidbar von „ich habe die
 *  Wortliste geleert". */
export async function kiProfilSpeichern(
  profil: KiProfil,
): Promise<Result<KiProfil>> {
  const res = await call<KiProfil>("/site-config/ki/profil", {
    method: "PUT",
    body: profil,
  });
  if (res.ok) revalidatePath("/website/einstellungen/ki");
  return res;
}

/** Aus den Stammdaten einen Vorschlag machen — statt ihn abzufragen.
 *
 *  Gespeichert wird NICHT: der Betrieb sieht drei Sätze und bestätigt sie
 *  über `kiProfilSpeichern`. */
export async function kiProfilVorschlag(): Promise<Result<ProfilVorschlag>> {
  return call("/site-config/ki/profil/vorschlag", { method: "POST" });
}

/** Die Herkunft an einer GESPEICHERTEN Zeile setzen.
 *
 *  Wird aufgerufen, nachdem der Vorschlag übernommen und die Seite bzw. der
 *  Abschnitt gespeichert wurde. Wer den Vorschlag verwirft, ruft das hier
 *  nicht auf — dann ist nichts erzeugt worden, was zu kennzeichnen wäre. */
export async function kiHerkunftSetzen(eingabe: {
  tabelle: "site_pages" | "site_blocks";
  zeilen_id: string;
  herkunft: Herkunft;
  modell?: string;
}): Promise<Result<null>> {
  return call("/site-config/ki/herkunft", { method: "POST", body: eingabe });
}

export async function kiAltTextHerkunftSetzen(eingabe: {
  medium_id: string;
  herkunft: Herkunft;
}): Promise<Result<null>> {
  return call("/site-config/ki/alt-text-herkunft", {
    method: "POST",
    body: eingabe,
  });
}

/** „Geprüft und übernommen."
 *
 *  Kein Haken zur Beruhigung: die Freigabe ist die Rechtsgrundlage dafür, dass
 *  neben der maschinenlesbaren Kennzeichnung keine Offenlegung nötig ist
 *  (EU AI Act Art. 50 Abs. 4). Wer sie setzt, übernimmt die redaktionelle
 *  Verantwortung — deshalb speichert der Server Person UND Zeitpunkt. */
export async function kiFreigeben(eingabe: {
  tabelle: "site_pages" | "site_blocks";
  zeilen_id: string;
}): Promise<Result<null>> {
  const res = await call<null>("/site-config/ki/freigabe", {
    method: "POST",
    body: eingabe,
  });
  if (res.ok) revalidatePath("/website/seiten");
  return res;
}

/** Was einer Seite an Freigaben fehlt. */
export async function kiFreigabestand(
  pageId: string,
): Promise<Result<Freigabestand>> {
  return call(`/site-config/ki/freigabestand/${pageId}`);
}

/** Was ein Übersetzungslauf getan hat (0476).
 *
 *  Vier getrennte Listen und keine bloße Zahl: „18 übersetzt" beantwortet die
 *  Frage nicht, die der Betrieb stellt — nämlich WELCHE Sprache fehlt und
 *  warum. `geschuetzt` ist dabei kein Fehler, sondern die Auskunft „hier hat
 *  jemand von Hand gearbeitet, das habe ich nicht angefasst".
 *
 *  KEIN `modell` und keine `region`, anders als bei den übrigen KI-Antworten:
 *  welcher Dienst übersetzt, ist unsere Betriebsangelegenheit und keine
 *  Auskunft für den Kunden. */
export type UebersetzungsLauf = {
  uebersetzt: string[];
  unveraendert: string[];
  geschuetzt: string[];
  fehlgeschlagen: Record<string, string>;
  verbrauch_heute: number;
  tageslimit: number;
};

/** Die Kopfangaben einer Seite (Titel, Meta-Angaben, Anriss) in die geführten
 *  Sprachen der Website bringen.
 *
 *  `sprachen` leer = alle geführten außer der Standardsprache. Ein Lauf ist
 *  idempotent: unveränderte Texte kosten keinen Aufruf. */
export async function kiSeiteUebersetzen(eingabe: {
  page_id: string;
  sprachen?: string[];
}): Promise<Result<UebersetzungsLauf>> {
  return call("/site-config/ki/seite-uebersetzen", {
    method: "POST",
    body: eingabe,
  });
}
