// Zeitraum-Auswahl im Such-Sheet: scrollende Monate, Anreise/Abreise als
// Spanne. Ersetzt die früheren Tipp-Felder (JJJJ-MM-TT) durch echte Auswahl —
// eintippbare Daten waren die häufigste Quelle für 422er beim Suchen.
//
// Vergangene Tage sind nicht wählbar. Wird auf einen bereits gesetzten
// Zeitraum erneut getippt, beginnt die Auswahl neu (Airbnb-Verhalten).
import { useMemo } from "react";
import { Pressable, View } from "react-native";

import { Col, Row, Txt } from "@/components/ui/kit";
import { heute, isoTag } from "@/lib/datum";
import { useTheme } from "@/theme/ThemeProvider";

const WOCHENTAGE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const MONATE = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

// Wie viele Monate im Voraus wählbar sind. Harte Obergrenze statt unbegrenzter
// Spanne (Wurzel 8) — der Server begrenzt zusätzlich.
const MONATE_VORAUS = 12;

type Monat = { jahr: number; monat: number; tage: (string | null)[] };

function monateAbHeute(anzahl: number): Monat[] {
  const start = new Date();
  const liste: Monat[] = [];
  for (let i = 0; i < anzahl; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const jahr = d.getFullYear();
    const monat = d.getMonth();
    // Montag als erster Wochentag: getDay() liefert 0=So → auf 0=Mo drehen.
    const ersterWochentag = (new Date(jahr, monat, 1).getDay() + 6) % 7;
    const anzahlTage = new Date(jahr, monat + 1, 0).getDate();
    const tage: (string | null)[] = Array(ersterWochentag).fill(null);
    for (let t = 1; t <= anzahlTage; t++) tage.push(isoTag(new Date(jahr, monat, t)));
    liste.push({ jahr, monat, tage });
  }
  return liste;
}

export function DateRangePicker({
  von,
  bis,
  onChange,
}: {
  von: string | null;
  bis: string | null;
  onChange: (von: string | null, bis: string | null) => void;
}) {
  const t = useTheme();
  const monate = useMemo(() => monateAbHeute(MONATE_VORAUS), []);
  const heuteIso = heute();

  const waehle = (tag: string) => {
    // Kein Zeitraum offen oder beide gesetzt → neue Anreise.
    if (!von || (von && bis)) return onChange(tag, null);
    // Rückwärts getippt → der frühere Tag wird die neue Anreise.
    if (tag <= von) return onChange(tag, null);
    onChange(von, tag);
  };

  return (
    <Col gap={26}>
      <Row gap={0} style={{ paddingHorizontal: 4 }}>
        {WOCHENTAGE.map((w) => (
          <Txt key={w} v="xs" soft style={{ flex: 1, textAlign: "center" }}>
            {w}
          </Txt>
        ))}
      </Row>

      {monate.map((m) => (
        <Col key={`${m.jahr}-${m.monat}`} gap={10}>
          <Txt v="title" style={{ paddingHorizontal: 4 }}>
            {MONATE[m.monat]} {m.jahr}
          </Txt>
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {m.tage.map((tag, i) => {
              if (!tag) return <View key={`leer-${i}`} style={{ width: `${100 / 7}%`, height: 46 }} />;
              const vergangen = tag < heuteIso;
              const istVon = tag === von;
              const istBis = tag === bis;
              const dazwischen = !!von && !!bis && tag > von && tag < bis;
              const markiert = istVon || istBis;
              return (
                <Pressable
                  key={tag}
                  disabled={vergangen}
                  accessibilityRole="button"
                  accessibilityState={{ selected: markiert, disabled: vergangen }}
                  onPress={() => waehle(tag)}
                  style={{
                    width: `${100 / 7}%`,
                    height: 46,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: dazwischen ? t.palette.surface2 : "transparent",
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: markiert ? t.palette.ink : "transparent",
                    }}
                  >
                    <Txt
                      v="sm"
                      color={markiert ? t.palette.bg : vergangen ? t.palette.faint : t.palette.ink}
                      style={{ fontFamily: markiert ? t.fonts.semibold : t.fonts.regular }}
                    >
                      {Number(tag.slice(8, 10))}
                    </Txt>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Col>
      ))}
    </Col>
  );
}
