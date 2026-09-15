// Der Vergleich zur Vorperiode — Pfeil und Prozent, in EINER Zeile.
//
// Die Zahl kommt fertig aus dem Backend; hier wird NICHTS gerechnet. Auch der
// Umsatz je Buchung wird nirgends aus Umsatz/Check-ins gebildet — der Nenner
// ist ein anderer (Eigentümer-Aufenthalte zählen als Check-in, aber nicht als
// Umsatzbuchung), die Division ergäbe einen zu kleinen Schnitt.
//
// ZWEI GESTALTUNGSFEHLER, die hier am 15.09.2026 behoben wurden — beide sahen
// einzeln harmlos aus und ergaben zusammen eine unruhige Übersicht:
//
//  1. „38 % zur Vorperiode" BRACH UM. In einer dreispaltigen Karte ist für
//     diesen Satz kein Platz; jede Spalte wurde unterschiedlich hoch, die
//     Karten bekamen ausgefranste Unterkanten und die Zahlen standen nicht
//     mehr auf einer Linie. Jetzt steht nur „38 %" neben dem Pfeil — WORAUF
//     sich der Vergleich bezieht, sagt der Zeitraum-Umschalter im Kartenkopf
//     („30 T"), und zwar einmal statt sechsmal.
//  2. Das Grün war ein fest verdrahtetes `#1F8A5B`, das in keiner Palette
//     stand — ein sattes Grün neben dem warmen Neutralton dieses Themes und
//     der Markenfarbe. Jede Zahl trug damit eine grelle Zeile, und die Karte
//     las sich wie eine Ampel. Die Töne kommen jetzt aus der Palette
//     (`positiv`/`negativ`, entsättigt und warm abgestimmt).
//
// Bewusst NICHT der Akzent für „abwärts": Der ist die Markenfarbe und markiert
// in dieser App Handlungsbedarf. Ein gesunkener Umsatz ist eine Information,
// kein Knopf — hätte er dieselbe Farbe wie „2 überfällige Aufgaben", wäre die
// Farbe als Signal wertlos.
import { View } from "react-native";

import { Icon } from "@/components/ui/Icon";
import { Row, Txt } from "@/components/ui/kit";
import { useTheme } from "@/theme/ThemeProvider";

/**
 * Vergleich zur Vorperiode.
 *
 * `null` heißt: es GIBT keine Vorperiode — dann steht hier nichts statt eines
 * erfundenen 0-%-Werts (Wurzel 4).
 */
export function Trend({ change }: { change: number | null }) {
  const t = useTheme();
  if (change === null) return null;
  const rauf = change >= 0;
  const farbe = rauf ? t.palette.positiv : t.palette.negativ;
  return (
    <Row gap={3} style={{ alignItems: "center" }}>
      {/* Icon kennt keine style-Prop — das Drehen für „abwärts" passiert im
          umschließenden View. */}
      <View style={rauf ? undefined : { transform: [{ rotate: "180deg" }] }}>
        <Icon n="arrowup" s={11} sw={2.4} c={farbe} />
      </View>
      {/* `numberOfLines={1}`: Die Zeile DARF nicht umbrechen — genau das war
          der Fehler. Lieber abgeschnitten als eine Karte mit ungleich hohen
          Spalten; abgeschnitten wird bei „999 %" ohnehin nie. */}
      <Txt v="xs" color={farbe} numberOfLines={1}>
        {Math.abs(Math.round(change))} %
      </Txt>
    </Row>
  );
}
