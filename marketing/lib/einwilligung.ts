// Einwilligung der Besucher — Modell und Speicher.
//
// WAS HIER WIRKLICH GESCHALTET WIRD: genau EIN Dienst, der externe Spamschutz
// des Kontaktformulars (reCAPTCHA Enterprise, `lib/captcha.ts`). Mehr gibt es
// in dieser App nicht, und das ist nachgezählt, nicht angenommen:
//   · Schriften liegen lokal im Repo (app/layout.tsx, marketing/fonts/)
//   · Symbole werden serverseitig aus dem eingecheckten Satz gerendert
//     (components/ui/icon-set.ts) — kein Abruf bei api.iconify.design
//   · Support-Chat und Voranmeldung sprechen mit UNSERER API, nicht mit Dritten
//   · Newsletter/Brevo läuft ausschließlich serverseitig in der FastAPI
//   · Analyse-, Werbe- oder Tracking-Dienste existieren nicht (kein Analytics,
//     kein Pixel, kein Werbenetzwerk)
// Deshalb steht hier KEINE Kategorie „Statistik" oder „Marketing". Eine
// Kategorie ohne dahinterliegenden Dienst wäre eine Attrappe: sie sammelt eine
// Einwilligung ein und schaltet nichts — genau der Fehler, den ein
// Einwilligungs-Dialog nicht machen darf.
// Kommt ein neuer Dienst im Browser hinzu, gehört er HIER als Kategorie hinein
// UND an seiner Ladestelle abgefragt; sonst lädt er ungefragt.
//
// WARUM localStorage UND KEIN COOKIE: Die Entscheidung wird ausschließlich im
// Browser gebraucht — die Leiste rendert clientseitig, und das einzige
// geschaltete Skript lädt der Browser selbst. Ein Cookie würde bei JEDEM
// Seitenaufruf mitgesendet, also mehr Daten übertragen als der Zweck braucht.
// Der Wert hat keinen Personenbezug: Kategoriename, Zeitpunkt, Fassung — keine
// Kennung, die einen Besucher wiedererkennbar macht.

import { RECAPTCHA_SITE_KEY } from "@/lib/config";

/** Die einzige optionale Kategorie — siehe Kopfkommentar. */
export const OPTIONALE_KATEGORIEN = ["spamschutz"] as const;

export type OptionaleKategorie = (typeof OPTIONALE_KATEGORIEN)[number];

export type Auswahl = Record<OptionaleKategorie, boolean>;

/**
 * Voreinstellung: nichts Optionales an. Das ist zugleich der Zustand, der
 * gilt, solange niemand entschieden hat — die datenschutzfreundlichste Fassung
 * und kein „vorausgewählt".
 */
export const NICHTS_ERLAUBT: Auswahl = { spamschutz: false };

export const ALLES_ERLAUBT: Auswahl = { spamschutz: true };

export const SPEICHER_SCHLUESSEL = "nd_consent";

/**
 * Fassung der Kategorien. Kommt eine Kategorie hinzu oder ändert sich ihr
 * Zweck, wird diese Zahl erhöht: eine gespeicherte Entscheidung nach altem
 * Stand gilt dann NICHT für den neuen Dienst, die Leiste fragt erneut. Ohne
 * diese Zahl würde eine alte Zustimmung stillschweigend auf etwas ausgedehnt,
 * dem niemand zugestimmt hat.
 */
export const EINWILLIGUNG_FASSUNG = 1;

/**
 * Wie lange eine Einwilligung gilt, bevor erneut gefragt wird — in Tagen.
 *
 * WARUM ÜBERHAUPT: Eine Einwilligung, die nie abläuft, ist keine Einwilligung
 * mehr, sondern ein Zustand. Das war hier bis zum 24.08.2026 der Fall —
 * `entscheidungLesen` prüfte nur die Fassung, nicht das Alter.
 *
 * WARUM SECHS MONATE: Cookies richten sich nach der ePrivacy-Richtlinie
 * 2002/58/EG, und die ist in jedem Mitgliedstaat einzeln umgesetzt — es gibt
 * keinen EU-weit einheitlichen Wert. Die veröffentlichten Empfehlungen der
 * Aufsichtsbehörden laufen auseinander: CNIL (FR) und die irische DPC nennen
 * sechs Monate, der BfDI (DE) sechs bis zwölf, Luxemburg zwölf, die AEPD (ES)
 * lässt in bestimmten Fällen bis zu 24 Monate zu. Wir spielen EU-weit aus und
 * können nicht je Besucher das Land bestimmen — also gilt der STRENGSTE Wert
 * für alle. Sechs Monate erfüllen damit auch die längeren Fristen.
 *
 * Die Frist verkürzen ist unproblematisch; sie zu verlängern hieße, für
 * französische und irische Besucher unter den dortigen Wert zu gehen.
 */
export const EINWILLIGUNG_GUELTIG_TAGE = 182;

/**
 * Eigenes Ereignis, damit Leiste, Einstellungsfeld und Kontaktformular im
 * gleichen Tab sofort denselben Stand sehen. `storage` feuert nur in ANDEREN
 * Tabs — allein darauf zu hören hieße, dass die eigene Seite ihre eigene
 * Änderung nicht mitbekommt.
 */
export const EINWILLIGUNG_EREIGNIS = "nd:einwilligung";

/**
 * Ereignis, das die Leiste ERNEUT öffnet — der Widerrufsweg.
 *
 * Ausgelöst vom Footer-Eintrag „Cookie-Einstellungen". Das ist die übliche
 * Umsetzung von Art. 7 Abs. 3 DSGVO („so einfach widerrufbar wie erteilt"):
 * ein dauerhaft erreichbarer Link, der dasselbe Banner wieder aufruft, mit dem
 * die Einwilligung erteilt wurde. Cookiebot, CookieYes und Usercentrics machen
 * es genauso (Footer-Link oder Symbol am Seitenrand).
 *
 * Bewusst NICHT: ein Bedienfeld mitten in der Cookie-Richtlinie. Das stand hier
 * einen halben Tag und war der falsche Ort — eine Rechtsseite ist der Text,
 * nicht die Bedienoberfläche, und der Widerruf wäre dort zwei Klicks entfernt
 * statt einem.
 *
 * Ein Ereignis statt eines Zustands im Speicher: die gespeicherte Entscheidung
 * bleibt beim Öffnen unangetastet. Wer die Leiste aufruft und wieder weggeht,
 * hat nichts widerrufen — widerrufen wird erst mit dem Klick auf einen der
 * Knöpfe.
 */
export const EINWILLIGUNG_OEFFNEN = "nd:einwilligung-oeffnen";

export type Entscheidung = {
  fassung: number;
  /** ISO-8601, UTC. Nur für die Anzeige „Ihre Entscheidung vom …". */
  zeitpunkt: string;
  auswahl: Auswahl;
};

function auswahlLesen(rohwert: unknown): Auswahl | null {
  if (typeof rohwert !== "object" || rohwert === null) return null;
  const quelle = rohwert as Record<string, unknown>;
  const auswahl = { ...NICHTS_ERLAUBT };
  for (const kategorie of OPTIONALE_KATEGORIEN) {
    const wert = quelle[kategorie];
    // Nur ein echtes `true` erlaubt. Alles andere — fehlend, "true", 1 —
    // bleibt aus (fail-closed): ein unlesbarer Wert ist keine Einwilligung.
    if (wert === true) auswahl[kategorie] = true;
  }
  return auswahl;
}

/**
 * Gespeicherte Entscheidung oder `null`, wenn keine gültige vorliegt.
 *
 * `null` heißt für jeden Aufrufer: NICHT entschieden, also nichts Optionales
 * laden. Ein defekter Wert, ein gesperrter Speicher (privates Fenster) oder
 * eine veraltete Fassung führen bewusst auf denselben Zustand — nie auf „ist
 * wohl erlaubt".
 */
export function entscheidungLesen(): Entscheidung | null {
  if (typeof window === "undefined") return null;
  let rohtext: string | null;
  try {
    rohtext = window.localStorage.getItem(SPEICHER_SCHLUESSEL);
  } catch {
    // Speicher gesperrt (privates Fenster, Browser-Einstellung). Dann gibt es
    // keine Entscheidung — die Leiste fragt bei jedem Besuch erneut, und
    // geladen wird nichts. Das ist die richtige Richtung.
    return null;
  }
  if (!rohtext) return null;

  let daten: unknown;
  try {
    daten = JSON.parse(rohtext);
  } catch {
    return null;
  }
  if (typeof daten !== "object" || daten === null) return null;

  const satz = daten as Record<string, unknown>;
  if (satz.fassung !== EINWILLIGUNG_FASSUNG) return null;
  const auswahl = auswahlLesen(satz.auswahl);
  if (!auswahl) return null;
  const zeitpunkt =
    typeof satz.zeitpunkt === "string" && satz.zeitpunkt ? satz.zeitpunkt : "";
  // Abgelaufen? Dann gilt sie NICHT mehr — die Leiste fragt erneut.
  //
  // Ein FEHLENDER oder unlesbarer Zeitpunkt zählt ebenfalls als abgelaufen.
  // Das ist die einzige richtige Richtung: ohne Zeitpunkt lässt sich das Alter
  // nicht prüfen, und eine Einwilligung, deren Alter niemand kennt, darf nicht
  // unbegrenzt weitergelten. Kein erfundener Ersatzzeitpunkt (Wurzel 4), und
  // kein Weitergelten im Zweifel (Wurzel 5, fail-closed).
  if (abgelaufen(zeitpunkt)) return null;
  return { fassung: EINWILLIGUNG_FASSUNG, zeitpunkt, auswahl };
}

/**
 * Ist eine Einwilligung mit diesem Zeitstempel älter als
 * `EINWILLIGUNG_GUELTIG_TAGE`?
 *
 * Leerer, unparsbarer oder in der ZUKUNFT liegender Zeitpunkt gilt als
 * abgelaufen. Der Zukunftsfall ist nicht theoretisch: der Wert kommt aus dem
 * Speicher des Besuchers, dessen Uhr falsch stehen kann — eine auf 2030
 * datierte Einwilligung wäre sonst zwölf Jahre gültig.
 */
function abgelaufen(zeitpunkt: string): boolean {
  if (!zeitpunkt) return true;
  const erteilt = Date.parse(zeitpunkt);
  if (Number.isNaN(erteilt)) return true;
  const alterTage = (Date.now() - erteilt) / 86_400_000;
  return alterTage < 0 || alterTage > EINWILLIGUNG_GUELTIG_TAGE;
}

/**
 * Entscheidung festhalten und alle Zuhörer im Tab benachrichtigen.
 *
 * Schlägt das Schreiben fehl (gesperrter Speicher), wird das Ereignis trotzdem
 * gesendet: die Wahl gilt dann für diese Sitzung im Zustand der Komponenten,
 * und beim nächsten Aufruf fragt die Leiste wieder — sie tut nicht so, als
 * wäre etwas dauerhaft gespeichert.
 */
export function entscheidungSpeichern(auswahl: Auswahl): Entscheidung {
  const entscheidung: Entscheidung = {
    fassung: EINWILLIGUNG_FASSUNG,
    zeitpunkt: new Date().toISOString(),
    auswahl: { ...auswahl },
  };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(
        SPEICHER_SCHLUESSEL,
        JSON.stringify(entscheidung),
      );
    } catch (fehler) {
      // Nur protokollieren, nicht den Hauptpfad kippen (best effort).
      console.warn("[einwilligung] konnte nicht gespeichert werden", fehler);
    }
    window.dispatchEvent(new CustomEvent(EINWILLIGUNG_EREIGNIS));
  }
  return entscheidung;
}

/**
 * Gibt es in dieser Umgebung überhaupt etwas zu entscheiden?
 *
 * Ohne konfigurierten reCAPTCHA-Schlüssel lädt die App keinen einzigen
 * Drittanbieter (lib/captcha.ts steigt dann sofort aus) — eine Leiste hätte
 * nichts zu schalten und wäre genau die Attrappe, die hier vermieden werden
 * soll. Das ist der lokale Normalfall; in Produktion ist der Schlüssel gesetzt.
 * Auf /cookie-richtlinie bleibt das Einstellungsfeld trotzdem sichtbar: wer
 * dort nachsieht, sucht die Einstellung bewusst.
 */
export function optionaleDiensteVorhanden(): boolean {
  return RECAPTCHA_SITE_KEY !== "";
}

/**
 * Darf dieser Dienst laden? Ohne Entscheidung: nein.
 *
 * Das ist die Frage, die JEDE Ladestelle eines optionalen Dienstes stellen
 * muss — sie ist der Grund, dass die Leiste keine Attrappe ist.
 */
export function istErlaubt(kategorie: OptionaleKategorie): boolean {
  return entscheidungLesen()?.auswahl[kategorie] === true;
}
