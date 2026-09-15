// Eine Kennzahl und ihr Raster — der EINE Rhythmus aller Übersichts-Karten.
//
// WARUM ES DAS GIBT: Bis zum 15.09.2026 baute jede Karte ihre Zahlenreihe
// selbst. Die Kennzahlen-Karte setzte drei Spalten mit je drei Zeilen, die
// Nachrichten-Karte drei Spalten mit je vier, die Aufgaben-Karte vier Spalten
// mit je zwei — dazu Trend-Zeilen, die umbrachen. Untereinander gelegt ergab
// das eine Übersicht, in der keine Zahl auf der Höhe der nächsten stand und
// jede Karte anders atmete. Ein gemeinsamer Baustein ist hier nicht Kosmetik:
// Die Ausrichtung IST die Lesbarkeit einer Zahlenseite.
//
// Die Regeln, die er durchsetzt:
//   * Jede Zahl hat dieselbe Struktur: Beschriftung, Wert, optionale
//     Nebenangabe, optionaler Trend — jede davon EINZEILIG.
//   * Höchstens drei Spalten je Reihe. Auf 400 px Gerätebreite bleiben nach
//     Bildschirm- und Kartenrand rund 310 px; vier Spalten sind 77 px, und
//     „Zur Abnahme" passt dort nicht — genau deshalb war es abgeschnitten.
//   * Vier Zahlen brechen auf 2 × 2 statt auf 3 + 1. Eine einzelne Zahl unter
//     dreien sieht aus wie ein Nachtrag.
import { View } from "react-native";

import { Trend } from "@/components/dashboard/Trend";
import { Col, Txt } from "@/components/ui/kit";
import { useTheme } from "@/theme/ThemeProvider";

export type Stat = {
  label: string;
  /** Fertig formatiert — hier wird nicht gerechnet und nicht gerundet. */
  wert: string;
  /** Nebenangabe unter dem Wert, etwa „11,4 Ø/Tag". */
  neben?: string | null;
  /** Veränderung zur Vorperiode; null = es gibt keine (kein erfundenes 0 %). */
  trend?: number | null;
  /** Hebt den Wert hervor — nur für das, was wirklich Handlung verlangt. */
  betont?: boolean;
  /** Konnte nicht geladen werden: „—" statt einer Zahl, die niemand kennt. */
  fehler?: boolean;
};

/**
 * Eine Zahl in der Spalte.
 *
 * `betont` färbt den WERT im Akzent — sparsam einsetzen. Die Markenfarbe
 * markiert in dieser App Handlungsbedarf; trägt sie jede zweite Zahl, sagt sie
 * nichts mehr.
 */
export function Statzahl({ stat }: { stat: Stat }) {
  const t = useTheme();
  return (
    <Col gap={2}>
      <Txt v="xs" soft numberOfLines={1}>
        {stat.label}
      </Txt>
      {stat.fehler ? (
        <Txt v="h2" color={t.palette.faint}>
          —
        </Txt>
      ) : (
        <Txt
          v="h2"
          numberOfLines={1}
          color={stat.betont ? t.palette.accent : undefined}
        >
          {stat.wert}
        </Txt>
      )}
      {stat.neben && (
        <Txt v="xs" soft numberOfLines={1}>
          {stat.neben}
        </Txt>
      )}
      {!stat.fehler && <Trend change={stat.trend ?? null} />}
    </Col>
  );
}

/**
 * Das Raster darüber: höchstens drei Spalten je Reihe, vier brechen auf 2 × 2.
 *
 * Umgesetzt mit `flexBasis` statt mit einer Spaltenzahl im Style, damit eine
 * schmalere Schrifteinstellung oder ein kleineres Gerät die Spalten umbrechen
 * lassen kann, statt sie zu stauchen.
 */
export function StatGitter({ stats }: { stats: Stat[] }) {
  // Vier Zahlen → zwei Reihen à zwei. Sonst so viele nebeneinander, wie da
  // sind (höchstens drei).
  const zweispaltig = stats.length === 4;
  const basis = zweispaltig ? "46%" : stats.length >= 3 ? "30%" : "46%";
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        // Der Zeilenabstand gilt nur, wenn wirklich umgebrochen wird — bei
        // drei Zahlen entsteht dadurch kein zusätzlicher Leerraum.
        rowGap: 14,
        columnGap: 12,
      }}
    >
      {stats.map((s) => (
        <View key={s.label} style={{ flexBasis: basis, flexGrow: 1, minWidth: 82 }}>
          <Statzahl stat={s} />
        </View>
      ))}
    </View>
  );
}
