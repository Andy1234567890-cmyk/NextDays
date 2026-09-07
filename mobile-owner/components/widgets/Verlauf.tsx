// Verlaufsdiagramm der Finanzübersicht — Linie mit Fläche oder Balken, mit
// optionaler Vergleichsreihe (Vorjahr). Reines SVG (react-native-svg), keine
// Chart-Bibliothek: eine Kurve, vier Y-Marken, wenige X-Marken.
//
// LÜCKEN STATT NULLEN: ein Punkt ohne Wert (`null` = nicht ausweisbar oder
// keine Freigabe) unterbricht die Linie. Ihn als 0 zu zeichnen hieße, dem
// Eigentümer einen Einbruch zu zeigen, den es nicht gab (Wurzel 4).
//
// FARBEN: aktuelle Reihe im Marken-Akzent, Vergleich im gedeckten Ton der
// Palette (`soft`), gestrichelt. Kein zweiter Signalton — der wäre eine
// erfundene Markenfarbe (theme/marke.ts).
import { useState } from "react";
import { View } from "react-native";
import Svg, { Defs, LinearGradient, Line, Path, Rect, Stop, Text as SvgText } from "react-native-svg";

import { useTheme } from "@/theme/ThemeProvider";

export type VerlaufPunkt = { label: string; wert: number | null };

const HOEHE = 170;
const OBEN = 8;
const UNTEN = 22;
const LINKS_MIN = 34;

/** „Schöne" Obergrenze für die Y-Achse: 1/2/2,5/5 × 10^n über dem Maximum. */
export function schoeneObergrenze(max: number): number {
  if (max <= 0) return 1;
  const exp = Math.floor(Math.log10(max));
  const basis = Math.pow(10, exp);
  const rest = max / basis;
  const faktor = rest <= 1 ? 1 : rest <= 2 ? 2 : rest <= 2.5 ? 2.5 : rest <= 5 ? 5 : 10;
  return faktor * basis;
}

/** Zusammenhängende Teilstücke ohne Lücke (null trennt). */
export function teilstuecke(punkte: readonly VerlaufPunkt[]): number[][] {
  const out: number[][] = [];
  let cur: number[] = [];
  punkte.forEach((p, i) => {
    if (p.wert === null) {
      if (cur.length) out.push(cur);
      cur = [];
    } else cur.push(i);
  });
  if (cur.length) out.push(cur);
  return out;
}

/** Welche X-Indizes eine Beschriftung tragen: erste, letzte und ~3 dazwischen. */
export function xMarken(anzahl: number): number[] {
  if (anzahl <= 1) return [0];
  if (anzahl <= 7) return Array.from({ length: anzahl }, (_, i) => i);
  const schritte = anzahl <= 12 ? 3 : 3;
  const out = new Set<number>([0, anzahl - 1]);
  for (let k = 1; k <= schritte; k += 1) out.add(Math.round((k * (anzahl - 1)) / (schritte + 1)));
  return [...out].sort((a, b) => a - b);
}

/** Glatte Kurve (Catmull-Rom → kubische Bézier) durch die Punkte eines Teilstücks. */
function kurve(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M${pts[0].x} ${pts[0].y}`;
  let d = `M${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

export function Verlauf({
  punkte,
  vergleich,
  typ,
  formatY,
  formatX,
}: {
  punkte: readonly VerlaufPunkt[];
  vergleich?: readonly VerlaufPunkt[] | null;
  typ: "linie" | "balken";
  /** Achsenbeschriftung, z. B. „€800" oder „50 %". */
  formatY: (wert: number) => string;
  /** X-Beschriftung aus dem Punkt-Label, z. B. „11" oder „Nov". */
  formatX: (label: string, index: number) => string;
}) {
  const t = useTheme();
  const [breite, setBreite] = useState(0);

  const werte = [...punkte, ...(vergleich ?? [])].map((p) => p.wert).filter((w): w is number => w !== null);
  const max = schoeneObergrenze(Math.max(0, ...werte));
  const links = LINKS_MIN + Math.max(0, formatY(max).length - 4) * 6;
  const innenB = Math.max(0, breite - links - 8);
  const innenH = HOEHE - OBEN - UNTEN;
  const n = punkte.length;
  const xAn = (i: number) => (n <= 1 ? links + innenB / 2 : links + (i / (n - 1)) * innenB);
  const yAn = (w: number) => OBEN + innenH - (Math.min(w, max) / max) * innenH;

  const yMarken = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const marken = xMarken(n);

  const linie = (reihe: readonly VerlaufPunkt[]) =>
    teilstuecke(reihe).map((idx) => kurve(idx.map((i) => ({ x: xAn(i), y: yAn(reihe[i].wert as number) }))));

  const flaeche = (reihe: readonly VerlaufPunkt[]) =>
    teilstuecke(reihe).map((idx) => {
      const pts = idx.map((i) => ({ x: xAn(i), y: yAn(reihe[i].wert as number) }));
      const boden = OBEN + innenH;
      return `${kurve(pts)} L${pts[pts.length - 1].x} ${boden} L${pts[0].x} ${boden} Z`;
    });

  const balkenB = n > 0 ? Math.max(2, (innenB / n) * (vergleich ? 0.36 : 0.6)) : 0;

  return (
    <View
      onLayout={(e) => setBreite(e.nativeEvent.layout.width)}
      accessible
      accessibilityLabel={`Verlauf mit ${n} Punkten${vergleich ? " und Vergleichsreihe" : ""}`}
    >
      {breite > 0 ? (
        <Svg width={breite} height={HOEHE}>
          <Defs>
            <LinearGradient id="verlauf-flaeche" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={t.palette.accent} stopOpacity={0.22} />
              <Stop offset="1" stopColor={t.palette.accent} stopOpacity={0.02} />
            </LinearGradient>
          </Defs>

          {/* Y-Raster und -Marken */}
          {yMarken.map((w) => (
            <Line
              key={`g${w}`}
              x1={links}
              x2={links + innenB}
              y1={yAn(w)}
              y2={yAn(w)}
              stroke={t.palette.line}
              strokeWidth={1}
            />
          ))}
          {yMarken.map((w) => (
            <SvgText
              key={`y${w}`}
              x={links - 6}
              y={yAn(w) + 4}
              fontSize={10}
              fill={t.palette.soft}
              textAnchor="end"
              fontFamily={t.fonts.regular}
            >
              {formatY(w)}
            </SvgText>
          ))}

          {typ === "linie" ? (
            <>
              {vergleich
                ? linie(vergleich).map((d, i) => (
                    <Path
                      key={`v${i}`}
                      d={d}
                      stroke={t.palette.soft}
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      fill="none"
                    />
                  ))
                : null}
              {flaeche(punkte).map((d, i) => (
                <Path key={`f${i}`} d={d} fill="url(#verlauf-flaeche)" />
              ))}
              {linie(punkte).map((d, i) => (
                <Path key={`l${i}`} d={d} stroke={t.palette.accent} strokeWidth={2.4} fill="none" />
              ))}
            </>
          ) : (
            <>
              {punkte.map((p, i) => {
                if (p.wert === null) return null;
                const x = xAn(i) - (vergleich ? balkenB : balkenB / 2);
                return (
                  <Rect
                    key={`b${i}`}
                    x={x}
                    y={yAn(p.wert)}
                    width={balkenB}
                    height={OBEN + innenH - yAn(p.wert)}
                    rx={2}
                    fill={t.palette.accent}
                  />
                );
              })}
              {vergleich
                ? vergleich.map((p, i) => {
                    if (p.wert === null || i >= n) return null;
                    return (
                      <Rect
                        key={`vb${i}`}
                        x={xAn(i) + 1}
                        y={yAn(p.wert)}
                        width={balkenB}
                        height={OBEN + innenH - yAn(p.wert)}
                        rx={2}
                        fill={t.palette.soft}
                        opacity={0.6}
                      />
                    );
                  })
                : null}
            </>
          )}

          {/* X-Marken */}
          {marken.map((i) => (
            <SvgText
              key={`x${i}`}
              x={xAn(i)}
              y={HOEHE - 6}
              fontSize={10}
              fill={t.palette.soft}
              textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
              fontFamily={t.fonts.regular}
            >
              {punkte[i] ? formatX(punkte[i].label, i) : ""}
            </SvgText>
          ))}
        </Svg>
      ) : (
        <View style={{ height: HOEHE }} />
      )}
    </View>
  );
}
