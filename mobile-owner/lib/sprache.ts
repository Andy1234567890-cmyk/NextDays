// Mehrsprachigkeit der Eigentümer-App — EINE Stelle.
//
// WARUM ES DAS GIBT (08.09.2026): Die App war hart deutsch. Jeder Text stand
// als Literal im Screen, und ein dänischer oder polnischer Eigentümer las
// „Auszahlung" und „Ihre Objekte". Dabei kennt der Server seine Sprache längst
// (`users.preferred_language`, `owners.language`), und Beleg und E-Mails
// kommen bereits in ihr — nur die App nicht.
//
// WIE SIE GEWÄHLT WIRD, in dieser Reihenfolge:
//   1. Was der Eigentümer im Menü eingestellt hat (Keychain, überlebt Neustart)
//   2. `preferred_language` aus `/auth/account` — die Wahrheit des Servers
//   3. Die Gerätesprache
//   4. `de`
// Ein Wert, den wir nicht führen, fällt auf die nächste Stufe zurück statt auf
// eine leere Oberfläche.
//
// KEINE Bibliothek: `Intl` ist in der vorgebauten Hermes-Engine unvollständig
// (siehe `lib/currency.ts`), und i18next zöge 200 KB für eine flache Map.
// Hier reicht ein Katalog je Sprache plus Platzhalter-Ersetzung.
import { NativeModules, Platform } from "react-native";

import { bg } from "@/locales/bg";
import { cs } from "@/locales/cs";
import { da } from "@/locales/da";
import { de } from "@/locales/de";
import { el } from "@/locales/el";
import { en } from "@/locales/en";
import { es } from "@/locales/es";
import { et } from "@/locales/et";
import { fi } from "@/locales/fi";
import { fr } from "@/locales/fr";
import { ga } from "@/locales/ga";
import { hr } from "@/locales/hr";
import { hu } from "@/locales/hu";
import { it } from "@/locales/it";
import { lt } from "@/locales/lt";
import { lv } from "@/locales/lv";
import { mt } from "@/locales/mt";
import { nl } from "@/locales/nl";
import { pl } from "@/locales/pl";
import { pt } from "@/locales/pt";
import { ro } from "@/locales/ro";
import { sk } from "@/locales/sk";
import { sl } from "@/locales/sl";
import { sv } from "@/locales/sv";

/**
 * Die 24 Sprachen der Plattform — dieselbe Liste wie `web/i18n/locales.ts`.
 * Wer hier eine ergänzt, ergänzt sie dort ebenso (und umgekehrt).
 */
export const SPRACHEN = [
  "bg", "cs", "da", "de", "el", "en", "es", "et", "fi", "fr", "ga", "hr",
  "hu", "it", "lt", "lv", "mt", "nl", "pl", "pt", "ro", "sk", "sl", "sv",
] as const;
export type Sprache = (typeof SPRACHEN)[number];

/**
 * Anzeigename je Sprache — IN DER SPRACHE SELBST (Endonym). Wortgleich mit
 * `LOCALE_LABELS` im Web: derselbe Eigentümer soll seine Sprache in Portal und
 * App gleich benannt finden.
 */
export const SPRACH_NAMEN: Record<Sprache, string> = {
  bg: "Български",
  cs: "Čeština",
  da: "Dansk",
  de: "Deutsch",
  el: "Ελληνικά",
  en: "English",
  es: "Español",
  et: "Eesti",
  fi: "Suomi",
  fr: "Français",
  ga: "Gaeilge",
  hr: "Hrvatski",
  hu: "Magyar",
  it: "Italiano",
  lt: "Lietuvių",
  lv: "Latviešu",
  mt: "Malti",
  nl: "Nederlands",
  pl: "Polski",
  pt: "Português",
  ro: "Română",
  sk: "Slovenčina",
  sl: "Slovenščina",
  sv: "Svenska",
};

/**
 * Flagge je Sprache als EMOJI — im Web sind es Iconify-Namen, nativ wäre das
 * ein zusätzliches Icon-Set für 24 Bilder. Gewählt ist dasselbe Land wie dort:
 * jenes, nach dem der ISO-639-1-Code gebildet ist.
 *
 * Eine Sprache ist kein Land (Deutsch: DE/AT/CH). Die Flagge ist die schnelle
 * Wiedererkennung, das Endonym daneben die verbindliche Angabe — deshalb steht
 * in der Auswahl immer beides.
 */
export const SPRACH_FLAGGEN: Record<Sprache, string> = {
  bg: "🇧🇬",
  cs: "🇨🇿",
  da: "🇩🇰",
  de: "🇩🇪",
  el: "🇬🇷",
  en: "🇬🇧",
  es: "🇪🇸",
  et: "🇪🇪",
  fi: "🇫🇮",
  fr: "🇫🇷",
  ga: "🇮🇪",
  hr: "🇭🇷",
  hu: "🇭🇺",
  it: "🇮🇹",
  lt: "🇱🇹",
  lv: "🇱🇻",
  mt: "🇲🇹",
  nl: "🇳🇱",
  pl: "🇵🇱",
  pt: "🇵🇹",
  ro: "🇷🇴",
  sk: "🇸🇰",
  sl: "🇸🇮",
  sv: "🇸🇪",
};

/**
 * Der Katalog ist der DEUTSCHE: er ist die Quelle, jede andere Sprache muss
 * dieselben Schlüssel tragen. Der Typ erzwingt das — eine fehlende Zeile in
 * `en.ts` ist ein Typfehler, kein stiller deutscher Rest zur Laufzeit (die
 * Lehre aus `scripts/i18n/deutsche-restwerte-pruefen.mjs`, wo 4881 solcher
 * Reste erst nach Monaten auffielen).
 */
export type Katalog = Record<keyof typeof de, string>;
export type TextSchluessel = keyof Katalog;

/**
 * Die vorhandenen Kataloge. Eine Sprache OHNE Katalog ist trotzdem wählbar —
 * `uebersetzen` fällt Zeile für Zeile auf Deutsch zurück, und die Oberfläche
 * bleibt bedienbar. Das ist besser als eine Sprache zu verschweigen, die das
 * Web dem Eigentümer anbietet; die fehlenden Kataloge kommen über
 * `scripts/i18n/uebersetzen.py` nach.
 */
/**
 * Alle 24 Kataloge. Deutsch ist die Quelle, Englisch von Hand geschrieben, die
 * übrigen 22 aus `scripts/i18n/uebersetzen.py` (Gemini) erzeugt — dasselbe
 * Werkzeug, mit dem Web und Marketing übersetzt werden.
 */
const KATALOGE: Record<Sprache, Katalog> = {
  bg, cs, da, de, el, en, es, et, fi, fr, ga, hr, hu, it, lt, lv, mt, nl, pl, pt, ro, sk, sl, sv,
};

/** Ist das eine Sprache, für die wir einen Katalog haben? */
export function istSprache(wert: string | null | undefined): wert is Sprache {
  return typeof wert === "string" && (SPRACHEN as readonly string[]).includes(wert);
}

/**
 * Sprachwunsch auf eine geführte Sprache abbilden.
 *
 * Akzeptiert auch Regionalformen: `de-AT`, `de_AT` und `DE` ergeben alle `de`.
 * Ein Eigentümer in Österreich trägt `de-AT` im Profil, und ihn deshalb auf
 * Englisch zu setzen wäre absurd.
 */
export function spracheAus(wert: string | null | undefined): Sprache | null {
  if (typeof wert !== "string") return null;
  const basis = wert.trim().toLowerCase().replace("_", "-").split("-")[0];
  return istSprache(basis) ? basis : null;
}

/** Die am Gerät eingestellte Sprache (iOS und Android verschieden abgelegt). */
export function geraeteSprache(): Sprache | null {
  try {
    const roh =
      Platform.OS === "ios"
        ? (NativeModules.SettingsManager?.settings?.AppleLocale as string | undefined) ??
          (NativeModules.SettingsManager?.settings?.AppleLanguages?.[0] as string | undefined)
        : (NativeModules.I18nManager?.localeIdentifier as string | undefined);
    return spracheAus(roh);
  } catch {
    // Ein fehlendes natives Modul darf die App nicht aufhalten.
    return null;
  }
}

/**
 * Die Sprache aus den drei Quellen wählen. Reine Funktion, damit sie prüfbar
 * ist — der Zusammenbau steht im Provider.
 */
export function spracheWaehlen(
  gewaehlt: string | null | undefined,
  ausProfil: string | null | undefined,
  vomGeraet: string | null | undefined,
): Sprache {
  return spracheAus(gewaehlt) ?? spracheAus(ausProfil) ?? spracheAus(vomGeraet) ?? "de";
}

/**
 * Einen Text holen und Platzhalter ersetzen.
 *
 * Platzhalter heißen `{name}` und werden NUR ersetzt, wenn der Wert übergeben
 * wurde. Ein unbekannter Platzhalter bleibt stehen statt zu „undefined" zu
 * werden — sichtbar falsch ist besser als plausibel falsch (Wurzel 4).
 *
 * Der Rückfall auf den deutschen Katalog fängt den Fall ab, dass eine neue
 * Zeile in einer Sprache noch fehlt: der Nutzer liest dann einen deutschen
 * Satz statt eines rohen Schlüssels wie `payouts.title`.
 */
export function uebersetzen(
  sprache: Sprache,
  schluessel: TextSchluessel,
  werte?: Record<string, string | number>,
): string {
  const katalog = KATALOGE[sprache] ?? de;
  const roh = katalog[schluessel] ?? de[schluessel];
  if (typeof roh !== "string") return String(schluessel);
  if (!werte) return roh;
  return roh.replace(/\{(\w+)\}/g, (treffer, name: string) =>
    name in werte ? String(werte[name]) : treffer,
  );
}
