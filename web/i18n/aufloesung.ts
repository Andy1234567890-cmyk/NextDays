// Welche Sprache eine ANFRAGE bekommt — die eine Auflösungsstelle.
//
// Warum es diese Datei gibt (der Bruch, den sie schliesst): Die Einladungsmail
// geht bereits in der Sprache des Empfängers raus — `owners.language` bzw.
// `users.preferred_language`, aufgelöst in `core.mail_sprache`. Ein dänischer
// Eigentümer bekam also eine dänische Mail, klickte auf den Link und landete
// auf „Zugang einrichten — Vergib ein Passwort …" auf DEUTSCH. Der Grund war
// `i18n/request.ts`: es las ausschliesslich das Sprach-Cookie, und wer noch nie
// eingeloggt war, hat keins. Übrig blieb `DEFAULT_LOCALE` = "de".
//
// ABGRENZUNG ZU „KEINE FALLBACKS" (Wurzel 4): Eine Locale-Kette ist KEIN
// erfundener Ersatzwert. Jede Stufe unten ist eine ECHTE Auskunft über den
// Betrachter — seine gespeicherte Wahl, die am Token hängende Sprache des
// Empfängers, die Sprachliste seines Browsers. Verboten wäre, eine FEHLENDE
// Fachangabe durch einen plausibel aussehenden Wert zu ersetzen; hier wird
// dagegen eine vorhandene Auskunft benutzt und, wenn keine existiert, offen
// die Ausweichsprache genannt. Der Unterschied zum alten Zustand ist genau
// dieser: „de" war eine INHALTLICHE Aussage („diese Software ist deutsch"),
// die sich als technischer Default tarnte.
//
// DIE KETTE, in dieser Reihenfolge:
//   1. Cookie `nd_locale` — die ausdrückliche Wahl des Betrachters. Sie
//      gewinnt IMMER: wer umgeschaltet hat, will nicht bei jedem Aufruf
//      wieder überstimmt werden.
//   2. Die Sprache AM TOKEN (nur auf /einladung und /passwort-neu). Der Token
//      identifiziert den Empfänger, dessen Sprache am Datensatz steht — die
//      stärkste Auskunft, die es ohne Login gibt, und dieselbe, in der die
//      Mail verschickt wurde. Sie kommt aus dem Prüf-Endpunkt.
//   3. `Accept-Language` des Browsers — was der Betrachter in seinem System
//      eingestellt hat. Gilt für /login, /passwort-vergessen, /signup und für
//      Token-Seiten, deren Token keine Sprache liefert.
//   4. FALLBACK_LOCALE ("en"). Kein Deutsch-Rückfall.
//
// AUSDRÜCKLICH NICHT: IP-Geolokalisierung. Sie rät aus dem Aufenthaltsort auf
// die Sprache und liegt bei VPN, Reise oder Grenzregion falsch; dazu ist sie
// datenschutzrechtlich heikel. Ein geratener Wert ist genau das, was Wurzel 4
// verbietet — der Standort ist keine Auskunft über die Sprache.

import { LOCALES, type Locale, isLocale } from "./locales";

/**
 * Der letzte Rückfall der Oberfläche — bewusst Englisch, nicht Deutsch.
 *
 * Gleichlaut mit `apps/api/src/core/mail_sprache.FALLBACK`: Mail und Seite
 * eines Vorgangs müssen dieselbe Ausweichsprache wählen, sonst kommt die Mail
 * englisch und die verlinkte Seite deutsch. Die Begründung steht dort
 * ausführlich: Deutsch ist eine inhaltliche Wahl, die sich als technischer
 * Default tarnt; Englisch wird als Ausweichsprache erkannt.
 *
 * Bewusst NICHT `DEFAULT_LOCALE` aus `locales.ts` — das ist etwas anderes: die
 * QUELLSPRACHE, in der die Texte von Hand gepflegt werden. Dass beide heute
 * verschieden sind, ist Absicht, keine Unstimmigkeit.
 */
export const FALLBACK_LOCALE: Locale = "en";

/**
 * Ein roher Sprachwert → unterstützter Code, oder `null`.
 *
 * `null` heisst „diese Quelle weiss es nicht" — der Aufrufer geht dann zur
 * nächsten Stufe. Bewusst NICHT direkt der Fallback: sonst würde eine leere
 * Quelle alle weiteren Stufen überspringen und die Kette wäre nach der ersten
 * zu Ende.
 *
 * Regionsvarianten werden auf die Basissprache geschnitten (`da-DK` → `da`,
 * `de_AT` → `de`): wir pflegen keine regionalen Fassungen, und ein Österreicher
 * soll Deutsch bekommen und nicht Englisch. Unbekannte Sprachen (`zh`, `ru`,
 * Tippfehler) ergeben `null` — für sie gibt es keinen Katalog, und sie als
 * Sprache zu führen hiesse, eine leere Oberfläche auszuliefern.
 *
 * Spiegelt `core.mail_sprache.normalisieren` — dieselbe Regel auf beiden
 * Seiten, damit Mail und Seite denselben Code errechnen.
 */
export function normalisieren(wert: string | null | undefined): Locale | null {
  if (!wert) return null;
  const code = wert.trim().toLowerCase().replace(/_/g, "-").split("-")[0];
  return isLocale(code) ? code : null;
}

/**
 * `Accept-Language` → beste unterstützte Sprache, oder `null`.
 *
 * Der Header ist eine nach Gewicht sortierte Wunschliste
 * (`da-DK,da;q=0.9,en;q=0.8`). Wir werten sie in der Reihenfolge der Wünsche
 * aus und nehmen den ERSTEN Eintrag, für den wir einen Katalog haben — ein
 * Däne mit `da-DK,en;q=0.8` bekommt Dänisch, nicht Englisch.
 *
 * `q` wird explizit ausgewertet und nicht nur die Reihenfolge geglaubt:
 * Browser senden zwar meist absteigend sortiert, die Spezifikation verlangt es
 * aber nicht. Einträge ohne `q` haben laut RFC 9110 das Gewicht 1.
 *
 * `*` (jede Sprache) wird übergangen: das ist keine Auskunft über einen Wunsch,
 * sondern nur „mir egal" — daraus eine bestimmte Sprache zu machen wäre geraten.
 *
 * Robust gegen Müll (Wurzel 5): ein kaputter Header darf keine Ausnahme werfen,
 * sondern führt zu `null` und damit zur nächsten Stufe. Die Länge ist gedeckelt,
 * damit ein absichtlich riesiger Header keine Arbeit erzeugt.
 */
export function ausAcceptLanguage(header: string | null | undefined): Locale | null {
  if (!header) return null;
  const eintraege = header
    .slice(0, 512)
    .split(",")
    .map((teil) => {
      const [wunsch, ...parameter] = teil.split(";");
      const q = parameter
        .map((p) => /^\s*q=([0-9.]+)\s*$/i.exec(p))
        .find((treffer) => treffer !== null);
      const gewicht = q ? Number.parseFloat(q[1]) : 1;
      return {
        wunsch: wunsch.trim(),
        gewicht: Number.isFinite(gewicht) ? gewicht : 0,
      };
    })
    .filter((e) => e.wunsch.length > 0 && e.wunsch !== "*" && e.gewicht > 0)
    // Stabil nach Gewicht absteigend; bei Gleichstand bleibt die Reihenfolge
    // des Headers erhalten (Array.prototype.sort ist seit ES2019 stabil).
    .sort((a, b) => b.gewicht - a.gewicht);

  for (const eintrag of eintraege) {
    const code = normalisieren(eintrag.wunsch);
    if (code !== null) return code;
  }
  return null;
}

/**
 * Die erste brauchbare Sprache aus den übergebenen Quellen — sonst Englisch.
 *
 * Aufruf in der Reihenfolge der Kette, z. B.:
 *
 *     aufloesen(cookieWert, tokenSprache, acceptLanguageHeader)
 *
 * Der Rückgabewert ist IMMER ein unterstützter Code, nie `null`: ab hier ist
 * die Sprache entschieden und jede Stelle darunter darf sich darauf verlassen,
 * dass ein Katalog existiert. Spiegelt `core.mail_sprache.aufloesen`.
 */
export function aufloesen(...quellen: (string | null | undefined)[]): Locale {
  for (const quelle of quellen) {
    const code = normalisieren(quelle);
    if (code !== null) return code;
  }
  return FALLBACK_LOCALE;
}

/**
 * Request-Header, über den die Middleware die am Token hängende Sprache an das
 * Rendering weiterreicht (`middleware.ts` → `i18n/request.ts`).
 *
 * Warum ein Header und kein Cookie: ein Cookie würde die Sprache dieses einen
 * Links dauerhaft festschreiben. Wer eine dänische Einladung öffnet und sonst
 * auf Polnisch arbeitet, hätte danach überall Dänisch. Der Header lebt nur für
 * diesen einen Request — genau so lange, wie die Auskunft gilt.
 *
 * Der Header ist rein INTERN: die Middleware setzt ihn auf einer Kopie der
 * Request-Header, er wird nie zum Browser gesendet. Ein von aussen
 * mitgeschickter gleichnamiger Header ist deshalb harmlos — er könnte
 * höchstens die eigene Anzeigesprache des Absenders ändern und wird ohnehin
 * über `normalisieren` auf die 24 bekannten Codes eingegrenzt.
 */
export const SPRACHE_HEADER = "x-nd-token-sprache";

/** Alle unterstützten Codes — für Tests und Prüfskripte. */
export const UNTERSTUETZT: readonly Locale[] = LOCALES;
