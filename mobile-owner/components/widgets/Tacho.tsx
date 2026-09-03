// Halbkreis-Anzeige für eine Quote — das „Occupancy"-Widget der Vorlage
// (docs/SMOOBU-UI-ANALYSE.md, Abschnitt „geschätzt": Halbkreis, Skala 0–100 %,
// Wert groß in der Mitte).
//
// Warum ein eigener Bogen und keine Bibliothek: es sind zwei SVG-Pfade. Ein
// Chart-Paket dafür wäre ein natives/JS-Abhängigkeit mehr in einer App, die
// sonst mit `react-native-svg` auskommt.
//
// WICHTIG (Wurzel 4): `wert` darf null sein — „nicht berechenbar" (keine
// Kapazität im Zeitraum). Dann steht „—" in der Mitte und der Bogen bleibt
// leer. Es wird NIE 0 % gezeichnet, denn 0 % Auslastung und „keine Kapazität"
// sind zwei verschiedene Aussagen.
import { View } from "react-native";
import Svg, { Circle, G, Path } from "react-native-svg";

import { Txt } from "@/components/ui/kit";
import { useTheme } from "@/theme/ThemeProvider";

type Props = {
  /** Prozent 0…100 (wie `PortalStatistics.occupancy_rate`) oder null. */
  wert: number | null;
  /** Kantenlänge des Widgets; der Halbkreis füllt die Breite. */
  groesse?: number;
  /** Beschriftung unter dem Wert, z. B. „Auslastung". */
  label?: string;
};

const STRICH = 14;

// Punkt auf dem Bogen. 0° = links (9 Uhr), 180° = rechts (3 Uhr) — der
// Halbkreis läuft also oben herum.
function punkt(cx: number, cy: number, r: number, grad: number) {
  const rad = (Math.PI * (180 - grad)) / 180;
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
}

function bogen(cx: number, cy: number, r: number, vonGrad: number, bisGrad: number) {
  const a = punkt(cx, cy, r, vonGrad);
  const b = punkt(cx, cy, r, bisGrad);
  const gross = bisGrad - vonGrad > 180 ? 1 : 0;
  return `M ${a.x} ${a.y} A ${r} ${r} 0 ${gross} 1 ${b.x} ${b.y}`;
}

export function Tacho({ wert, groesse = 200, label }: Props) {
  const t = useTheme();
  const cx = groesse / 2;
  const r = (groesse - STRICH) / 2;
  // Der Halbkreis braucht nur die obere Hälfte plus Strichstärke.
  const hoehe = cx + STRICH / 2;
  const cy = hoehe - STRICH / 2;

  // Anzeigewert auf 0…100 begrenzen: ein Server-Wert über 100 (Überbuchung
  // mehrerer Einheiten) würde den Bogen sonst über den Halbkreis hinaus
  // zeichnen. Die ZAHL bleibt ungekürzt — gekappt wird nur die Grafik.
  const anteil = wert === null ? 0 : Math.max(0, Math.min(100, wert)) / 100;

  return (
    <View style={{ alignItems: "center" }}>
      <Svg width={groesse} height={hoehe}>
        <G>
          <Path
            d={bogen(cx, cy, r, 0, 180)}
            stroke={t.palette.surface2}
            strokeWidth={STRICH}
            strokeLinecap="round"
            fill="none"
          />
          {wert !== null && anteil > 0 && (
            <Path
              d={bogen(cx, cy, r, 0, anteil * 180)}
              stroke={t.palette.accent}
              strokeWidth={STRICH}
              strokeLinecap="round"
              fill="none"
            />
          )}
          {/* Zeigerpunkt am Ende des gefüllten Bogens. */}
          {wert !== null && (
            <Circle
              cx={punkt(cx, cy, r, anteil * 180).x}
              cy={punkt(cx, cy, r, anteil * 180).y}
              r={STRICH / 2 - 2}
              fill={t.palette.surface}
              stroke={t.palette.accent}
              strokeWidth={3}
            />
          )}
        </G>
      </Svg>
      <View style={{ alignItems: "center", marginTop: -groesse * 0.22 }}>
        <Txt v="display">
          {wert === null ? "—" : `${wert.toFixed(2).replace(".", ",")} %`}
        </Txt>
        {label ? (
          <Txt v="xs" soft style={{ marginTop: 2 }}>
            {label}
          </Txt>
        ) : null}
      </View>
    </View>
  );
}
