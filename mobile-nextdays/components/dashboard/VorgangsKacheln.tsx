// Zwei Kacheln der Übersicht, die im Web schon stehen und hier bis zum
// 15.09.2026 fehlten: Eigentümer-Vorgänge (`vorgaenge:eigentuemer`) und der
// Stand der Teamaufgaben (`aufgaben:team`).
//
// Beide zeigen einen BESTAND, keinen Verlauf — deshalb kein Zeitraum-Umschalter
// und kein Trend: „+30 % offene Anträge gegenüber letzter Woche" wäre eine
// Zahl, die der Server für diese Endpunkte gar nicht liefert (Wurzel 4).
//
// Beide sind rollen-gebunden, und die Prüfung steht beim Aufrufer:
//   * Eigentümer-Vorgänge → `approve_block` (wer nicht entscheiden darf, dem
//     sagt die Zahl nichts, was er tun könnte)
//   * Teamaufgaben        → `manage_tasks` (die Kachel zählt FREMDE Aufgaben;
//     wer die Liste nicht öffnen darf, darf auch ihre Summe nicht sehen —
//     Wurzel 9, gleicher Scope wie der List-Pfad)
// Beide Regeln sind aus `web/lib/dashboard-katalog.ts` übernommen, damit App
// und Web dieselbe Kachel derselben Rolle zeigen.
import { Pressable } from "react-native";

import { StatGitter, type Stat } from "@/components/dashboard/Statzahl";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Card, Col, Row, Txt } from "@/components/ui/kit";
import type { EigentuemerVorgaenge } from "@/lib/calendar";
import type { TeamaufgabenStand } from "@/lib/tasks";
import { useTheme } from "@/theme/ThemeProvider";

/**
 * Ganze Tage seit einem ISO-Datum; null, wenn es keines gibt.
 *
 * Die Zahl beantwortet „wie lange wartet das schon" — die Frage, die aus einer
 * Bestandszahl einen Handlungsdruck macht. Negative Werte (Datum in der
 * Zukunft) gäbe es nur bei kaputten Daten; sie werden zu 0, statt „vor -3
 * Tagen" zu schreiben.
 */
export function tageSeit(iso: string | null): number | null {
  if (!iso) return null;
  const dann = new Date(iso).getTime();
  if (Number.isNaN(dann)) return null;
  return Math.max(0, Math.floor((Date.now() - dann) / 86_400_000));
}

/** Bestandszahl mit Tausenderpunkt — 101 offene Aufgaben sind keine „101.0". */
function zahl(wert: number): string {
  return wert.toLocaleString("de-DE");
}

/** Gerüst beider Kacheln: Kopfzeile, Zahlenreihe, optionale Fußnote. */
function Kachel({
  icon,
  titel,
  onPress,
  stats,
  fussnote,
}: {
  icon: IconName;
  titel: string;
  onPress?: () => void;
  stats: Stat[];
  fussnote?: string | null;
}) {
  const t = useTheme();
  const inhalt = (
    // `Card` bringt KEINE Polsterung mit (components/ui/kit.tsx) — die setzt
    // jeder Aufrufer selbst, wie `KennzahlenAbschnitt`. Ohne sie klebt der
    // Inhalt am Rahmen und die letzte Spalte wird angeschnitten.
    <Card style={{ padding: 16 }}>
      <Col gap={12}>
        <Row gap={8} style={{ alignItems: "center" }}>
          <Icon n={icon} s={16} sw={2} c={t.palette.faint} />
          <Txt v="eyebrow" soft style={{ flex: 1 }}>
            {titel}
          </Txt>
          {onPress && <Icon n="fwd" s={15} sw={2} c={t.palette.faint} />}
        </Row>
        <StatGitter stats={stats} />
        {fussnote && (
          <Txt v="xs" color={t.palette.accent}>
            {fussnote}
          </Txt>
        )}
      </Col>
    </Card>
  );
  if (!onPress) return inhalt;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={titel}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      {inhalt}
    </Pressable>
  );
}

export function EigentuemerKachel({
  daten,
  onPress,
}: {
  daten: EigentuemerVorgaenge;
  onPress?: () => void;
}) {
  const tage = tageSeit(daten.aeltester_offen_am);
  return (
    <Kachel
      icon="key"
      titel="EIGENTÜMER-VORGÄNGE"
      onPress={onPress}
      fussnote={
        daten.offen > 0 && tage !== null
          ? `Der älteste Antrag wartet seit ${tage} ${tage === 1 ? "Tag" : "Tagen"}.`
          : null
      }
      stats={[
        { label: "Zu entscheiden", wert: zahl(daten.offen), betont: daten.offen > 0 },
        {
          label: "Aufhebungen",
          wert: zahl(daten.aufhebung_offen),
          betont: daten.aufhebung_offen > 0,
        },
        { label: "Kündigungen", wert: zahl(daten.kuendigungen) },
      ]}
    />
  );
}

export function TeamaufgabenKachel({
  daten,
  onPress,
}: {
  daten: TeamaufgabenStand;
  onPress?: () => void;
}) {
  return (
    <Kachel
      icon="list"
      titel="TEAMAUFGABEN"
      onPress={onPress}
      fussnote={
        // „Ohne Zuständige" ist der stille Ausfall: niemand bekommt eine
        // Benachrichtigung, niemand fühlt sich zuständig. Deshalb als Satz und
        // nicht als vierte Zahl, die man überliest.
        daten.ohne_zustaendige > 0
          ? `${daten.ohne_zustaendige} ${daten.ohne_zustaendige === 1 ? "Aufgabe hat" : "Aufgaben haben"} niemanden zugewiesen.`
          : null
      }
      stats={[
        { label: "Offen", wert: zahl(daten.offen) },
        {
          label: "Überfällig",
          wert: zahl(daten.ueberfaellig),
          betont: daten.ueberfaellig > 0,
        },
        { label: "Heute fällig", wert: zahl(daten.heute) },
        { label: "Zur Abnahme", wert: zahl(daten.zur_abnahme) },
      ]}
    />
  );
}
