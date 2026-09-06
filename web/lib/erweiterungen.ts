// Katalog der buchbaren Erweiterungen (Zusatzmodule des Abos).
//
// UI-Vorbild ist der Lodgify-Marktplatz: Kachel-Raster mit Preis-Badge →
// Detailseite mit „Aktivieren", Meta-Zeile (Preis · Verfügbarkeit · Kategorie),
// „Über", „Wie funktioniert es", „Wie funktioniert die Einrichtung?" in drei
// Schritten und Hilfe-Links. Bewusst NICHT in der Abrechnung: dort stehen Tarif
// und Rechnungen, nicht der Modul-Verkauf (Lodgify trennt das genauso).
//
// Hier stehen nur TEXTE und Struktur — kein Preis. Beträge und Prozentsätze
// kommen aus `getPricing()` (Stripe bzw. Server-Konstante), damit es keine
// zweite Preis-Wahrheit im Frontend gibt (Wurzel 4).
//
// Ein Modul kommt erst in diese Liste, wenn sein Feature-Gate serverseitig
// existiert (bei „Dynamische Preise": `recompute.py` rechnet ohne Entitlement
// nicht, `settings_service` verweigert das Einschalten mit 402). Ohne Gate
// würde man etwas verkaufen, das ohnehin läuft.
import { formatCurrency } from "@/lib/currency";
import type { ModuleKey, ModulePrice } from "@/lib/subscriptions";
import { hilfeUrl } from "@/lib/marketing-url";
import {
  SCHLOSS_ANBIETER,
  anbieterLogo,
  anbieterModulKey,
  type SchlossAnbieter,
} from "@/lib/schloss-anbieter";

export type Erweiterung = {
  /** URL-Segment unter /erweiterungen (sprechend, nicht der Modul-Schlüssel). */
  slug: string;
  /** Schlüssel im Abo (POST /subscriptions/modules). */
  moduleKey: ModuleKey;
  name: string;
  untertitel: string;
  icon: string;
  /** Pfad eines Marken-SVGs. Gesetzt bei Schloss-Anbietern; fehlt die Datei,
   *  zeigt die Kachel den Namen (die Komponente prüft das per `onError`). */
  logo?: string | null;
  kategorie: string;
  /** In welchen Ländern buchbar (Lodgify-Meta-Zeile „Regionen"). */
  verfuegbarkeit: string;
  /** Die Fläche, die das Modul freischaltet — Ziel nach dem Aktivieren. */
  flaeche: { href: string; label: string };
  /** Absätze für „Über …". */
  ueber: readonly string[];
  /** „Wie funktioniert … mit myNextDays?" — Stichpunkte. */
  soFunktioniert: readonly string[];
  /** „Wie funktioniert die Einrichtung?" — genau drei Schritte (Lodgify-Muster). */
  einrichtung: readonly string[];
  /** Kleingedrucktes unter der Einrichtung (Abrechnung, Kündigung, Grenzen). */
  hinweis: string;
  /** Nutzen-Kacheln der Verkaufsseite (gesperrte Fläche). */
  vorteile: readonly { icon: string; titel: string; text: string }[];
  /** Weiterführende Hilfe-Artikel (nur existierende Pfade — kein 404). */
  links: readonly { href: string; text: string }[];
};

const DYNAMISCHE_PREISE: Erweiterung = {
  slug: "dynamische-preise",
  moduleKey: "dynamische_preise",
  name: "Dynamische Preise",
  untertitel: "Nachtpreise automatisch an Nachfrage und Auslastung anpassen.",
  icon: "ph:lightning",
  kategorie: "Preissteuerung",
  verfuegbarkeit: "Alle Länder",
  flaeche: { href: "/dynamic-pricing", label: "Zu den dynamischen Preisen" },
  ueber: [
    "Dynamische Preise berechnen für jedes Objekt einen Preis pro Nacht — aus " +
      "Ihrem Basispreis und den Faktoren, die die Nachfrage bewegen: " +
      "Buchungsvorlauf, aktuelle Auslastung, Wochentag und Wochenende, Saison " +
      "und Events, kurze Lücken zwischen zwei Buchungen sowie ein Markt-Signal, " +
      "wenn Sie es einschalten.",
    "Der berechnete Preis geht denselben Weg wie ein von Hand gesetzter: in den " +
      "Kalender, auf Ihre Buchungswebsite, auf den myBestDays-Marktplatz und über " +
      "die Portale zu Booking, Airbnb & Co. Solange das Modul für ein Objekt an " +
      "ist, übernimmt es dessen Preisgestaltung; schalten Sie es ab, gelten Ihre " +
      "eigenen Tagespreise sofort wieder.",
  ],
  soFunktioniert: [
    "Sie schalten das Modul pro Objekt ein — nicht alle Objekte müssen mitmachen.",
    "Mindest- und Höchstpreis begrenzen die Automatik nach unten und nach oben.",
    "Abgeleitete Rate-Pläne folgen der neu berechneten Basisrate automatisch.",
    "Die 30-Tage-Vorschau zeigt je Objekt, welcher Preis an welchem Tag entsteht " +
      "und welcher Faktor ihn verursacht hat.",
    "Ihre eigenen Tagespreise bleiben gespeichert und greifen sofort wieder, " +
      "sobald Sie das Modul für das Objekt abschalten.",
  ],
  einrichtung: [
    "Auf „Aktivieren“ klicken — das Modul wird Ihrem laufenden Abo zugeordnet. " +
      "Es wird nichts im Voraus abgebucht.",
    "Unter „Dynamische Preise“ die Objekte einschalten und je Objekt " +
      "Basispreis-Strategie sowie Mindest- und Höchstpreis festlegen.",
    "Preise in der 30-Tage-Vorschau prüfen. Ab dann rechnet die Automatik " +
      "täglich weiter und verteilt die Preise an alle Kanäle.",
  ],
  hinweis:
    "Abgerechnet wird nachgelagert: Für jede Buchung, die während der " +
    "Aktivierung entsteht, wird der Satz auf ihren Buchungsumsatz erfasst und " +
    "am Monatsende in der Währung der Buchung über Ihre hinterlegte " +
    "Zahlungsmethode abgerechnet. Keine Grundgebühr, kein Mindestumsatz. Beim " +
    "Kündigen endet der Zugang sofort — bereits erfasste Gebühren werden noch " +
    "abgerechnet, weil die Leistung erbracht wurde. Ein laufendes Abo ist " +
    "Voraussetzung.",
  vorteile: [
    {
      icon: "lucide:clock",
      titel: "Zeit sparen",
      text:
        "Kein tägliches Nachjustieren mehr. Die Preise folgen der Nachfrage " +
        "automatisch — auf allen Kanälen gleichzeitig.",
    },
    {
      icon: "lucide:sliders-horizontal",
      titel: "Kontrolle behalten",
      text:
        "Mindest- und Höchstpreis setzen die Grenzen, und Sie entscheiden je " +
        "Objekt, ob die Automatik überhaupt läuft.",
    },
    {
      icon: "lucide:trending-up",
      titel: "Umsatz steigern",
      text:
        "Starke Tage werden teurer, schwache Tage und übrig gebliebene " +
        "Lücken günstiger — statt eines Preises für alles.",
    },
  ],
  links: [
    {
      href: hilfeUrl("preise-raten/dynamische-preise"),
      text: "Dynamische Preise einrichten",
    },
    {
      href: hilfeUrl("preise-raten/grundpreis-waehrung"),
      text: "Grundpreis und Währung festlegen",
    },
    {
      href: hilfeUrl("konto-abo/abonnement-tarif"),
      text: "Abonnement, Tarif und Zusatzmodule",
    },
  ],
};

/** Aus einem Schloss-Anbieter eine Erweiterung machen (0577).
 *
 *  GENERIERT statt 32-mal getippt: die Texte unterscheiden sich nur im
 *  Markennamen und in zwei Sätzen zur Technik. 32 handgeschriebene Blöcke
 *  wären 32 Stellen, an denen beim nächsten Umbau einer vergessen wird — und
 *  die Marken-Kennung müsste dreimal stimmen (Katalog, Modul, Logo).
 *
 *  Was je Anbieter WIRKLICH verschieden ist, steht in `schloss-anbieter.ts`:
 *  der Kurztext und ob die Codes ohne Netz entstehen. Genau diese zwei Dinge
 *  entscheiden, was der Betrieb wissen muss.
 */
function ausAnbieter(a: SchlossAnbieter): Erweiterung {
  const offlineHinweis = a.offline
    ? "Die Codes entstehen rechnerisch und brauchen keine Verbindung zum " +
      "Schloss — dafür lassen sie sich nach der Ausgabe nicht mehr vorzeitig " +
      "entziehen. Bei einer Stornierung gilt der Code bis zum Ende seines " +
      "Zeitraums weiter; das steht dann auch so an der Buchung."
    : "Codes lassen sich jederzeit zurückziehen, solange das Schloss " +
      "erreichbar ist. Bei einer Stornierung verliert der Gast den Zugang.";

  return {
    slug: a.slug,
    moduleKey: anbieterModulKey(a.kennung) as Erweiterung["moduleKey"],
    name: a.name,
    untertitel: a.kurz,
    icon: a.art === "keybox" ? "ph:key" : "ph:lock-key",
    logo: anbieterLogo(a.kennung),
    kategorie:
      a.art === "acs"
        ? "Zutritt · Gebäudesystem"
        : a.art === "keybox"
          ? "Zutritt · Schlüsselübergabe"
          : "Zutritt · Türschloss",
    verfuegbarkeit: "Alle Länder",
    flaeche: { href: "/channels/schloesser", label: "Zu den Schlössern" },
    ueber: [
      `Jede Buchung bekommt einen eigenen Türcode für Ihre ${a.name}-Geräte — ` +
        "gültig von der Anreise bis zur Abreise, mit einem Puffer, den Sie je " +
        "Objekt festlegen. Der Gast erhält ihn über Ihre Nachricht; Sie sehen " +
        "ihn an der Buchung.",
      offlineHinweis,
      "Sie verbinden Ihr eigenes " +
        a.name +
        "-Konto. Die Anmeldung läuft beim Hersteller selbst — Zugangsdaten " +
        "werden bei myNextDays nicht eingegeben und nicht gespeichert.",
    ],
    soFunktioniert: [
      "Der Code entsteht mit der Buchung und geht 72 Stunden vor der Anreise " +
        "an das Schloss. So bleibt Zeit für einen zweiten Versuch, falls das " +
        "Gerät gerade nicht erreichbar ist.",
      "Jedes Schloss gehört zu einer Einheit (die Tür dieser Einheit) oder zu " +
        "einem Gebäude (Gemeinschaftstür, etwa der Hauseingang).",
      "Ein Gast bekommt EINEN Code für alle Türen, die er braucht.",
      "Verschiebt sich die Buchung, zieht der Zeitraum mit. Wird sie " +
        "storniert, wird der Zugang zurückgezogen — soweit das Gerät es " +
        "zulässt.",
      "Der Code steht als Platzhalter in Ihren Nachrichtenvorlagen und im " +
        "Gastportal, mit denselben Freigaberegeln wie ein fest hinterlegter " +
        "Code (erst ab Anreise, erst nach Zahlung).",
    ],
    einrichtung: [
      "Auf „Aktivieren“ klicken — das Modul wird Ihrem laufenden Abo " +
        "zugeordnet.",
      `Unter „Channel Manager → Schlösser“ Ihr ${a.name}-Konto verbinden. ` +
        "Die Anmeldung öffnet sich beim Hersteller.",
      "Jedes Schloss seiner Einheit oder seinem Gebäude zuordnen. Ab dann " +
        "bekommt jede neue Buchung ihren Code automatisch.",
    ],
    hinweis:
      "Abgerechnet wird monatlich über Ihre hinterlegte Zahlungsmethode, " +
      "solange das Modul aktiv ist. Beim Kündigen endet der Zugang zum " +
      "Monatsende; bereits erzeugte Codes bleiben bis zu ihrem Ablauf gültig. " +
      "Die Geräte und ein etwaiges Abo beim Hersteller bleiben Ihre Sache — " +
      "myNextDays ist nicht Vertragspartner von " +
      a.name +
      ". Ein laufendes myNextDays-Abo ist Voraussetzung.",
    vorteile: [
      {
        icon: "lucide:key-round",
        titel: "Kein Schlüssel mehr übergeben",
        text:
          "Der Gast bekommt seinen Code vor der Anreise. Keine " +
          "Schlüsselübergabe, keine Absprache zur Ankunftszeit.",
      },
      {
        icon: "lucide:clock",
        titel: "Automatisch mit der Buchung",
        text:
          "Der Code entsteht, verschiebt sich und endet mit der Buchung — " +
          "ohne dass Sie daran denken müssen.",
      },
      {
        icon: "lucide:shield-check",
        titel: "Ehrlich über die Grenzen",
        text: a.offline
          ? "Wo ein Code nicht vorzeitig entziehbar ist, sagt myNextDays das " +
            "an der Buchung — statt eine Sicherheit zu behaupten, die es " +
            "nicht gibt."
          : "Storniert der Gast, ist sein Code weg. Sie sehen an der " +
            "Buchung, ob das Schloss die Änderung bestätigt hat.",
      },
    ],
    links: [
      {
        href: hilfeUrl("konto-abo/abonnement-tarif"),
        text: "Abonnement, Tarif und Zusatzmodule",
      },
    ],
  };
}

export const SCHLOSS_ERWEITERUNGEN: readonly Erweiterung[] =
  SCHLOSS_ANBIETER.map(ausAnbieter);

export const ERWEITERUNGEN: readonly Erweiterung[] = [
  DYNAMISCHE_PREISE,
  ...SCHLOSS_ERWEITERUNGEN,
];

export function erweiterungFuerSlug(slug: string): Erweiterung | null {
  return ERWEITERUNGEN.find((e) => e.slug === slug) ?? null;
}

export function erweiterungFuerModul(moduleKey: string): Erweiterung | null {
  return ERWEITERUNGEN.find((e) => e.moduleKey === moduleKey) ?? null;
}

/** Preis eines Moduls als Text: `kurz` für den Kachel-Badge, `lang` für die
 *  Meta-Zeile der Detailseite.
 *
 *  Zwei Preisarten: nutzungsabhängig (Prozentsatz vom Buchungsumsatz, dann ist
 *  `unit_amount` 0) und monatlich (Betrag in Cent). Fehlt der Katalog-Eintrag
 *  oder trägt er beides nicht, gibt es KEINEN Text — die UI schreibt dann, dass
 *  der Preis nicht geladen werden konnte, statt einen zu erfinden (Wurzel 4). */
export function preisAnzeige(
  price: ModulePrice | null | undefined,
  currency: string,
  locale: string,
): { kurz: string; lang: string } | null {
  if (!price) return null;
  if (price.usage_percent != null) {
    const satz = `${price.usage_percent.toLocaleString(locale, {
      maximumFractionDigits: 2,
    })} %`;
    return { kurz: satz, lang: `${satz} vom Buchungsumsatz` };
  }
  if (price.unit_amount > 0) {
    const betrag = formatCurrency(price.unit_amount / 100, currency);
    return { kurz: betrag, lang: `${betrag} monatlich` };
  }
  return null;
}
