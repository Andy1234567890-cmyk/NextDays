// Die Kurve unter der Leitzahl — der Verlauf, den ein Pfeil nicht zeigen kann.
//
// WOZU: „Umsatz 209.868 kr, ↓ 43 %" beantwortet nicht, ob der Rückgang
// gleichmäßig war oder an drei stillen Tagen hängt. Genau das ist die Frage,
// die ein Betrieb an eine Übersicht stellt, und sie war bis zum 15.09.2026
// nicht beantwortbar: Die Endpunkte lieferten je Kennzahl einen einzigen Wert.
// Die Reihe kommt jetzt aus `/reservations/dashboard/verlauf`.
//
// MIT `react-native-svg` GEZEICHNET und ohne Diagramm-Bibliothek: Die App
// bindet svg für die Symbole ohnehin ein. Eine Chart-Bibliothek brächte für
// eine Fläche mit einer Linie ein paar hundert Kilobyte, eine eigene
// Theme-Welt und einen zweiten Ort, an dem Farben stehen.
//
// WAS SIE NICHT TUT:
//   * Keine Glättung. Zwischen zwei Punkten läuft eine GERADE. Eine
//     Bézier-Kurve sähe gefälliger aus und würde Werte zeigen, die es nicht
//     gibt — bei einer Umsatzkurve ist das keine Kosmetik (Wurzel 4).
//   * Keine Achsen und kein Gitter. Auf Telefonbreite kosten sie mehr Fläche,
//     als sie erklären; der Zeitraum steht im Kartenkopf, die Leitzahl
//     darüber. Beschriftet werden nur Anfang und Ende der Reihe.
//   * Kein Auffüllen fehlender Punkte — das macht der Server, lückenlos.
import { useMemo } from "react";
import { View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";

import { Txt } from "@/components/ui/kit";
import type { Koernung, VerlaufPunkt } from "@/lib/dashboard";
import { MONATE } from "@/lib/kalendertag";
import { useTheme } from "@/theme/ThemeProvider";

const HOEHE = 64;
// Damit die Linie an den Rändern nicht halb abgeschnitten wird.
const RAND = 2;

/**
 * Beschriftung eines Punktes, passend zur Körnung.
 *
 * Die Körnung kommt vom SERVER (`koernung`), sie wird hier nicht aus der Zahl
 * der Punkte erraten: Sonst stünde dieselbe Regel an zwei Stellen und beide
 * liefen auseinander, sobald der Server anders bündelt.
 */
export function punktLabel(iso: string, koernung: Koernung): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  if (koernung === "monat") return MONATE[d.getMonth()]?.slice(0, 3) ?? "";
  return `${d.getDate()}. ${MONATE[d.getMonth()]?.slice(0, 3) ?? ""}`;
}

/** Punkte → SVG-Pfade (Linie und Fläche darunter) in einem Kasten b×h. */
export function pfadeBauen(
  werte: number[],
  breite: number,
  hoehe: number,
): { linie: string; flaeche: string } | null {
  if (werte.length < 2 || breite <= 0) return null;
  const max = Math.max(...werte);
  // Alles null → eine Linie am Boden, keine Division durch 0. Sie ist die
  // richtige Aussage: In diesem Fenster ist nichts passiert.
  const spanne = max > 0 ? max : 1;
  const nutzHoehe = hoehe - RAND * 2;
  const schritt = (breite - RAND * 2) / (werte.length - 1);
  const punkte = werte.map((w, i) => {
    const x = RAND + i * schritt;
    const y = RAND + nutzHoehe - (w / spanne) * nutzHoehe;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const linie = `M${punkte.join("L")}`;
  const flaeche =
    `${linie}L${(breite - RAND).toFixed(2)},${hoehe}L${RAND.toFixed(2)},${hoehe}Z`;
  return { linie, flaeche };
}

export function Verlaufskurve({
  punkte,
  koernung,
  breite,
}: {
  punkte: VerlaufPunkt[];
  koernung: Koernung;
  /** Verfügbare Breite in Punkten — vom Aufrufer gemessen (`onLayout`). */
  breite: number;
}) {
  const t = useTheme();
  const pfade = useMemo(
    () => pfadeBauen(punkte.map((p) => p.wert), breite, HOEHE),
    [punkte, breite],
  );

  // Weniger als zwei Punkte sind keine Kurve. Statt eines einzelnen Punktes
  // im Leeren steht dann nichts — die Zahl darüber sagt ohnehin alles.
  if (!pfade) return null;

  return (
    <View>
      <Svg width={breite} height={HOEHE}>
        <Defs>
          {/* Die Fläche verläuft nach unten ins Nichts: Ein Block in voller
              Deckkraft zöge mehr Aufmerksamkeit als die Leitzahl darüber. */}
          <LinearGradient id="verlaufFlaeche" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={t.palette.accent} stopOpacity={0.18} />
            <Stop offset="1" stopColor={t.palette.accent} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Path d={pfade.flaeche} fill="url(#verlaufFlaeche)" />
        <Path
          d={pfade.linie}
          stroke={t.palette.accent}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
      {/* Nur Anfang und Ende: Dazwischen wäre jede Beschriftung auf
          Telefonbreite entweder gedrängt oder willkürlich ausgewählt. */}
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Txt v="xs" soft>
          {punktLabel(punkte[0].am, koernung)}
        </Txt>
        <Txt v="xs" soft>
          {punktLabel(punkte[punkte.length - 1].am, koernung)}
        </Txt>
      </View>
    </View>
  );
}
