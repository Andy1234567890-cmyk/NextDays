// Der Vergleich zur Vorperiode — Pfeil, Prozent, Farbe.
//
// Die Zahl kommt fertig aus dem Backend; hier wird NICHTS gerechnet. Auch der
// Umsatz je Buchung wird nirgends aus Umsatz/Check-ins gebildet — der Nenner
// ist ein anderer (Eigentümer-Aufenthalte zählen als Check-in, aber nicht als
// Umsatzbuchung), die Division ergäbe einen zu kleinen Schnitt.
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
  return (
    <Row gap={4} style={{ alignItems: "center" }}>
      {/* Icon kennt keine style-Prop — das Drehen für „abwärts" passiert im
          umschließenden View. */}
      <View style={rauf ? undefined : { transform: [{ rotate: "180deg" }] }}>
        <Icon n="arrowup" s={12} sw={2.2} c={rauf ? "#1F8A5B" : t.palette.accent} />
      </View>
      <Txt v="xs" color={rauf ? "#1F8A5B" : t.palette.accent}>
        {Math.abs(Math.round(change))} % zur Vorperiode
      </Txt>
    </Row>
  );
}
