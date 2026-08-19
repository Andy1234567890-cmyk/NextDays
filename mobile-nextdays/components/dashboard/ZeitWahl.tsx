// Der Umschalter der Übersicht — einmal für Auswertungs-ZEITRÄUME (Kennzahlen)
// und einmal für Zeit-FENSTER (Listen). Beides sind geschlossene Mengen aus dem
// Backend (`core.zeitraum.ZEITRAEUME` bzw. `DashboardFenster`); hier steht nur
// die Reihenfolge und die Beschriftung. Ein hier erfundener fünfter Wert würde
// vom Server mit 422 abgewiesen (Wurzel 8).
//
// Aufklappmenü wie im Web (dort ein `<select>` im Pill-Kleid), nicht vier
// Pillen nebeneinander: die Kurzform („7 T") ist auf der geschlossenen Pille
// nötig, damit sie in eine Kopfzeile passt — in der offenen Liste steht der
// ausgeschriebene Zeitraum, weil „7 T" allein nicht sagt, ob vorwärts oder
// rückwärts gezählt wird.
//
// Eigenes Menü statt eines RN-`Picker`: das Rad öffnet für vier Werte einen
// halben Bildschirm und zeigt die Wahl erst nach dem Scrollen. Dieses Menü hängt
// direkt unter seinem Auslöser (bei Platzmangel darüber) — dieselbe Geste, aber
// die Liste ist auf einen Blick lesbar.
import { useCallback, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { Icon } from "@/components/ui/Icon";
import { Row, Txt } from "@/components/ui/kit";
import type { DashboardFenster, Zeitraum } from "@/lib/dashboard";
import { useTheme } from "@/theme/ThemeProvider";

// `label` steht auf der geschlossenen Pille, `lang` in der offenen Liste.
export type ZeitOption<T extends string> = { wert: T; label: string; lang: string };

export const ZEITRAEUME: ZeitOption<Zeitraum>[] = [
  { wert: "7d", label: "7 T", lang: "Letzte 7 Tage" },
  { wert: "30d", label: "30 T", lang: "Letzte 30 Tage" },
  { wert: "3m", label: "3 M", lang: "Letzte 3 Monate" },
  { wert: "12m", label: "12 M", lang: "Letzte 12 Monate" },
];

// Die Fenster zählen AB HEUTE vorwärts (Backend: „gerechnet ab heute") — die
// ausgeschriebene Form sagt das, die Kurzform kann es nicht.
export const FENSTER: ZeitOption<DashboardFenster>[] = [
  { wert: "heute", label: "Heute", lang: "Nur heute" },
  { wert: "7d", label: "7 T", lang: "Nächste 7 Tage" },
  { wert: "30d", label: "30 T", lang: "Nächste 30 Tage" },
  { wert: "alle", label: "Alle", lang: "Alle" },
];

// Der ausgeschriebene Zeitraum für die Kopfzeile über den Kennzahlen.
export const ZEITRAUM_TEXT: Record<Zeitraum, string> = {
  "7d": "Letzte 7 Tage",
  "30d": "Letzte 30 Tage",
  "3m": "Letzte 3 Monate",
  "12m": "Letzte 12 Monate",
};

// Höhe einer Menüzeile — gebraucht, um vor dem Öffnen zu entscheiden, ob das
// Menü nach unten passt oder nach oben klappen muss.
const ZEILE = 42;
const RAND = 12;

/**
 * Aufklapp-Umschalter für eine geschlossene Wertemenge.
 *
 * `laedt` sperrt die Wahl während des Nachladens: zwei Wechsel in Folge würden
 * sonst zwei Antworten erzeugen, deren Reihenfolge nicht garantiert ist — die
 * langsamere überschriebe die neuere (Wurzel 2).
 */
export function ZeitWahl<T extends string>({
  optionen,
  wert,
  onWechsel,
  laedt = false,
  label,
  style,
}: {
  optionen: ZeitOption<T>[];
  wert: T;
  onWechsel: (neu: T) => void;
  laedt?: boolean;
  // Was umgeschaltet wird — für Screenreader, denen die Kurzform allein nichts
  // sagt.
  label: string;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const { height, width } = useWindowDimensions();
  const ausloeser = useRef<View>(null);
  const [offen, setOffen] = useState(false);
  // Position des Menüs im Fenster. Erst nach dem Messen des Auslösers bekannt —
  // solange null, wird nichts gezeigt (ein Menü in der linken oberen Ecke
  // aufblitzen zu lassen ist schlechter als ein Frame Verzögerung).
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  const aktuell = optionen.find((o) => o.wert === wert);

  const oeffnen = useCallback(() => {
    ausloeser.current?.measureInWindow((x, y, w, h) => {
      const hoehe = optionen.length * ZEILE + 8;
      const passtUnten = y + h + 6 + hoehe + RAND <= height;
      setPos({
        // Klappt nach oben, wenn unten kein Platz ist — sonst hängt die Liste
        // halb unter dem Bildschirmrand und die letzte Option ist unerreichbar.
        top: passtUnten ? y + h + 6 : Math.max(RAND, y - hoehe - 6),
        // Rechtsbündig zum Auslöser: er sitzt am rechten Rand der Kopfzeile,
        // linksbündig würde das Menü aus dem Bild laufen.
        right: Math.max(RAND, width - (x + w)),
      });
      setOffen(true);
    });
  }, [height, width, optionen.length]);

  const waehlen = useCallback(
    (neu: T) => {
      setOffen(false);
      if (neu !== wert) onWechsel(neu);
    },
    [onWechsel, wert],
  );

  return (
    <>
      <View ref={ausloeser} collapsable={false} style={style}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${aktuell?.lang ?? wert}`}
          accessibilityState={{ expanded: offen, disabled: laedt }}
          disabled={laedt}
          onPress={oeffnen}
          hitSlop={6}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            paddingLeft: 12,
            paddingRight: 8,
            paddingVertical: 6,
            borderRadius: t.radius.pill,
            backgroundColor: t.palette.surface2,
            opacity: laedt ? 0.6 : pressed ? 0.7 : 1,
          })}
        >
          <Txt v="xs" soft style={{ fontFamily: t.fonts.semibold, fontSize: 12 }}>
            {aktuell?.label ?? wert}
          </Txt>
          {/* Während des Nachladens zeigt der Pfeil nach unten wie sonst — ein
              Drehkreis hier wäre ein zweiter Ladeanzeiger neben dem der Kachel. */}
          <Icon n="caretdown" s={11} sw={2.2} c={t.palette.soft} />
        </Pressable>
      </View>

      <Modal
        visible={offen && pos !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setOffen(false)}
        statusBarTranslucent
      >
        {/* Die ganze Fläche schließt: ein Menü, das nur über einen kleinen
            Knopf zu schließen ist, fühlt sich auf dem Telefon geklemmt an. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Auswahl schließen"
          onPress={() => setOffen(false)}
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.18)" }}
        />
        {pos && (
          <View
            accessibilityRole="menu"
            accessibilityLabel={label}
            style={[
              {
                position: "absolute",
                top: pos.top,
                right: pos.right,
                minWidth: 190,
                paddingVertical: 4,
                borderRadius: 14,
                backgroundColor: t.palette.surface,
                borderWidth: 1,
                borderColor: t.palette.line,
              },
              t.shadow.sm,
            ]}
          >
            {optionen.map((o) => {
              const an = o.wert === wert;
              return (
                <Pressable
                  key={o.wert}
                  accessibilityRole="menuitem"
                  accessibilityState={{ selected: an }}
                  onPress={() => waehlen(o.wert)}
                  style={({ pressed }) => ({
                    height: ZEILE,
                    justifyContent: "center",
                    paddingHorizontal: 14,
                    backgroundColor: pressed ? t.palette.surface2 : "transparent",
                  })}
                >
                  <Row gap={10} style={{ alignItems: "center" }}>
                    <Txt
                      v="sm"
                      numberOfLines={1}
                      style={{
                        flex: 1,
                        fontFamily: an ? t.fonts.semibold : t.fonts.regular,
                      }}
                    >
                      {o.lang}
                    </Txt>
                    {an && <Icon n="check" s={15} sw={2.2} c={t.palette.accent} />}
                  </Row>
                </Pressable>
              );
            })}
          </View>
        )}
      </Modal>
    </>
  );
}
