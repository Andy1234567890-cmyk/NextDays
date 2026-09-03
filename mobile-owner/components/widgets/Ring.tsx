// Ring-Anzeige einer Verteilung — das „Revenues / Portal"-Widget der Vorlage.
//
// EIN UNTERSCHIED ZUR VORLAGE, DER KEINE GESCHMACKSFRAGE IST: Smoobu zeigt dort
// UMSATZ je Portal. Diese App darf das nicht — der Eigentümer-Contract
// (`PortalStatistics.by_channel`, apps/api/.../public_portal) liefert
// ausschließlich ANZAHLEN (`reservations`, `nights`), bewusst kein Geld
// (§4.2/§4.3, Rollen-Datensplit). Der Ring zeigt deshalb Buchungen bzw. Nächte
// je Kanal. Wer hier später Beträge hineinrechnet, bricht die Maske.
//
// Farben: die Segmente stufen den MARKEN-Akzent ab, statt eine eigene
// Kanalpalette zu erfinden (Wurzel 4). Die echten Portal-Logos liegen in
// `lib/portal-logos.ts` und gehören in die Legende, nicht in den Ring.
import { View } from "react-native";
import Svg, { Circle, G } from "react-native-svg";

import { Txt } from "@/components/ui/kit";
import { useTheme } from "@/theme/ThemeProvider";

export type RingTeil = {
  /** Anzeigename des Kanals (echter Portalname, sonst „Direkt"). */
  name: string;
  wert: number;
};

type Props = {
  teile: RingTeil[];
  groesse?: number;
  /** Große Zahl in der Mitte; fehlt sie, wird die Summe gezeigt. */
  mitte?: string;
  mitteLabel?: string;
};

const STRICH = 18;

/**
 * Deckkraft je Segment: das erste (größte) Segment volldeckend, danach
 * absteigend bis 0,3. Bei einem einzigen Kanal bleibt es bei 1 — eine Division
 * durch `laenge - 1` wäre dort NaN und das Segment unsichtbar.
 */
export function deckkraft(index: number, laenge: number): number {
  if (laenge <= 1) return 1;
  return 1 - (index / (laenge - 1)) * 0.7;
}

export function Ring({ teile, groesse = 160, mitte, mitteLabel }: Props) {
  const t = useTheme();
  const summe = teile.reduce((s, x) => s + x.wert, 0);
  const r = (groesse - STRICH) / 2;
  const umfang = 2 * Math.PI * r;
  const c = groesse / 2;

  let versatz = 0;

  return (
    <View style={{ alignItems: "center", justifyContent: "center" }}>
      <Svg width={groesse} height={groesse}>
        {/* Grundring: bleibt sichtbar, wenn es nichts zu zeigen gibt. */}
        <Circle
          cx={c}
          cy={c}
          r={r}
          stroke={t.palette.surface2}
          strokeWidth={STRICH}
          fill="none"
        />
        {/* −90° dreht den Anfang nach oben (12 Uhr). */}
        <G rotation={-90} origin={`${c}, ${c}`}>
          {summe > 0 &&
            teile.map((teil, i) => {
              const anteil = teil.wert / summe;
              const laenge = anteil * umfang;
              const el = (
                <Circle
                  key={teil.name}
                  cx={c}
                  cy={c}
                  r={r}
                  stroke={t.palette.accent}
                  strokeOpacity={deckkraft(i, teile.length)}
                  strokeWidth={STRICH}
                  strokeLinecap="butt"
                  fill="none"
                  strokeDasharray={`${laenge} ${umfang - laenge}`}
                  strokeDashoffset={-versatz}
                />
              );
              versatz += laenge;
              return el;
            })}
        </G>
      </Svg>
      <View style={{ position: "absolute", alignItems: "center" }}>
        <Txt v="h2">
          {mitte ?? (summe > 0 ? String(summe) : "—")}
        </Txt>
        {mitteLabel ? (
          <Txt v="xs" soft>
            {mitteLabel}
          </Txt>
        ) : null}
      </View>
    </View>
  );
}
