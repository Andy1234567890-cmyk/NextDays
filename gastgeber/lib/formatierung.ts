// Datums- und Zahlenformatierung nach der Sprache des Nutzers.
//
// Warum es das gibt: Überall im Dashboard stand `toLocaleString("de-DE")`.
// Das ist derselbe Fehler wie ein hartkodiertes „€" — nur bei Zahlen und
// Daten. In 45 Sprachen zeigte es deutsche Formate: Ein Japaner sähe
// „27. Juli 2026" statt „2026年7月27日", ein Inder „0,1 %" statt „0.1%".
//
// Die Locale kommt aus next-intl, also aus der tatsächlichen Sprachwahl.
// Diese Datei formatiert NUR Datum, Zeit und Zahlen — Beträge laufen weiter
// über `formatCurrency`, weil dort zusätzlich die Objektwährung aus den Daten
// kommt und NIE geraten werden darf (Wurzel 4).
import { useLocale } from "next-intl";

/** Datum, Zeit und Zahlen in der aktiven Sprache. */
export function useFormatierung() {
  const locale = useLocale();

  return {
    /** „27. Juli 2026" bzw. das Äquivalent der aktiven Sprache. */
    datum(wert: string | number | Date, optionen?: Intl.DateTimeFormatOptions) {
      return new Date(wert).toLocaleDateString(locale, optionen);
    },

    /** Datum mit Uhrzeit. */
    datumZeit(
      wert: string | number | Date,
      optionen?: Intl.DateTimeFormatOptions,
    ) {
      return new Date(wert).toLocaleString(locale, optionen);
    },

    /** Nur die Uhrzeit. */
    zeit(wert: string | number | Date, optionen?: Intl.DateTimeFormatOptions) {
      return new Date(wert).toLocaleTimeString(locale, optionen);
    },

    /** Zahl mit den Trennzeichen der aktiven Sprache. */
    zahl(wert: number, optionen?: Intl.NumberFormatOptions) {
      return wert.toLocaleString(locale, optionen);
    },

    /** Prozentwert aus Basispunkten: 25 bps → „0,25 %" bzw. „0.25%".
     *
     *  Basispunkte, weil Prozent als Integer bei kleinen Sätzen zu 0 würde
     *  (Indien: 0,1 %). Die Formatierung übernimmt Intl, inklusive
     *  Prozentzeichen und dessen Position — im Türkischen steht es vorn. */
    prozentAusBps(bps: number, maximaleNachkommastellen = 2) {
      return (bps / 10000).toLocaleString(locale, {
        style: "percent",
        maximumFractionDigits: maximaleNachkommastellen,
      });
    },
  };
}
