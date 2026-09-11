// Ländernamen für die Oberfläche — ISO-3166-1 alpha-2 bleibt der Datenwert.
//
// Gespeichert und übertragen wird AUSSCHLIESSLICH der ISO-Code („DE", „NZ").
// Der ausgeschriebene Name entsteht erst beim Rendern und wird nie persistiert.
//
// Warum keine gepflegte Liste mehr: Die Auswahl der Steuerländer kommt aus
// `tax_country_rules` in der DB. Eine zweite, handgepflegte Namensliste im
// Frontend lief zwangsläufig auseinander — sie hatte 32 Einträge, die DB 42,
// und für die Differenz erschien im Wizard das rohe Kürzel („CA", „NZ").
// `Intl.DisplayNames` kennt jeden gültigen ISO-Code und kann deshalb nicht
// unvollständig sein: Neue Länder in der Regeltabelle wirken sofort, ohne dass
// hier etwas nachgezogen werden muss.
//
// Die Sprache war bis zum 10.09.2026 fest „de" — mit dem Kommentar, sie werde
// zum Parameter, „sobald eine zweite Sprache kommt". Die 45 Sprachen sind
// längst da: ein japanischer Gastgeber las „Dänemark" statt „デンマーク", ein
// polnischer „Deutschland" statt „Niemcy". Deshalb ist die Sprache jetzt
// überall Pflicht-Parameter; die Aufrufer holen sie über `useLaender()` aus
// next-intl, also aus der tatsächlichen Sprachwahl (wie `lib/formatierung.ts`).
import { useLocale } from "next-intl";
import { useMemo } from "react";

export interface Land {
  /** ISO-3166-1 alpha-2 — der einzige Wert, der gespeichert wird. */
  code: string;
  name: string;
}

/** `Intl.DisplayNames` ist pro Aufruf teuer und die Länderauswahl rendert
 *  Dutzende Optionen — je Sprache genau einmal bauen. */
const ANZEIGE_CACHE = new Map<string, Intl.DisplayNames>();

function anzeige(locale: string): Intl.DisplayNames {
  const vorhanden = ANZEIGE_CACHE.get(locale);
  if (vorhanden) return vorhanden;
  const neu = new Intl.DisplayNames([locale], {
    type: "region",
    // Unbekannte Codes liefern den Code zurück statt zu werfen. Ein erfundener
    // Name wäre hier schlimmer als das Kürzel (Wurzel 4).
    fallback: "code",
  });
  ANZEIGE_CACHE.set(locale, neu);
  return neu;
}

/** Ländername zum ISO-Code in der angegebenen Sprache.
 *  Unbekannte Codes kommen unverändert zurück. */
export function landName(code: string, locale: string): string {
  const iso = code.trim().toUpperCase();
  if (iso.length !== 2) return iso;
  try {
    return anzeige(locale).of(iso) ?? iso;
  } catch {
    // Ungültige Codes (z. B. Ziffern) lässt `of` werfen — dann ist der Code
    // selbst die ehrlichste Anzeige.
    return iso;
  }
}

/** Alle ISO-3166-1-alpha-2-Codes, nach dem Namen IN DIESER SPRACHE sortiert.
 *
 *  Für Felder, die JEDES Land zulassen müssen — etwa das Geburtsland: wer in
 *  Brasilien geboren ist und in Spanien vermietet, muss beides angeben können.
 *  Für die Steuerländer NICHT verwenden; deren Auswahl kommt aus der DB.
 *
 *  ISO-3166-1 alpha-2: A..Z × A..Z durchgehen und behalten, was `Intl` als
 *  echtes Land kennt. Reservierte und unbelegte Kombinationen liefern mit
 *  `fallback: "code"` den Code selbst zurück und fallen so heraus. */
export function alleLaender(locale: string): readonly Land[] {
  const vorhanden = ALLE_CACHE.get(locale);
  if (vorhanden) return vorhanden;
  const A = 65;
  const namen = anzeige(locale);
  const laender: Land[] = [];
  for (let i = 0; i < 26; i += 1) {
    for (let j = 0; j < 26; j += 1) {
      const code = String.fromCharCode(A + i, A + j);
      const name = namen.of(code);
      if (name && name !== code) laender.push({ code, name });
    }
  }
  laender.sort((a, b) => a.name.localeCompare(b.name, locale));
  ALLE_CACHE.set(locale, laender);
  return laender;
}

const ALLE_CACHE = new Map<string, readonly Land[]>();

/** Ländernamen in der aktiven Sprache — der Weg für Komponenten.
 *
 *  Muster wie `useFormatierung`: die Locale kommt aus next-intl, damit keine
 *  Aufrufstelle sie vergessen oder eine eigene raten kann. */
export function useLaender() {
  const locale = useLocale();
  return useMemo(
    () => ({
      /** Ländername zum ISO-Code in der aktiven Sprache. */
      name: (code: string) => landName(code, locale),
      /** Alle Länder, nach dem Namen der aktiven Sprache sortiert. */
      alle: () => alleLaender(locale),
    }),
    [locale],
  );
}
