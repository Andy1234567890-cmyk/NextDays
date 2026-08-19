// Filter und Sortierung des Posteingangs in EINEM Sheet.
//
// WARUM NICHT ALS CHIP-REIHE: Vorher standen hier bis zu zehn Pillen in zwei
// Zeilen — drei für die Ansicht, zwei für den Lesestand, eine je Kanal, dazu
// Zuweisung, Favoriten und die Sortierung. Das hatte drei Fehler:
//   * Alles trug dieselbe Optik, obwohl es drei verschiedene Dinge sind:
//     Ansicht (getrennte Mengen), Filter (Teilmenge) und Sortierung (Reihenfolge).
//   * Die Sortier-Pille war dauerhaft „aktiv" eingefärbt, weil immer eine
//     Sortierung gilt — sie sah aus wie ein gesetzter Filter.
//   * Zwei Zeilen Pillen kosteten den Platz, auf dem Konversationen stehen.
//
// Jetzt: die Ansicht als Auswahl neben dem Titel (`ZeitWahl`, dasselbe Muster
// wie der Zeitraum der Übersicht), alles andere hier — und im Kopf steht nur
// noch ein Knopf, der die Zahl der gesetzten Filter trägt.
import { Pressable, View } from "react-native";

import { Icon } from "@/components/ui/Icon";
import { Btn, Col, Divider, Row, Txt } from "@/components/ui/kit";
import { Sheet } from "@/components/ui/patterns";
import { portalLabel } from "@/lib/portal-logos";
import { useTheme } from "@/theme/ThemeProvider";

export type InboxFilter = {
  kanal: string | "all";
  lesestand: "all" | "unread";
  nurZugewiesen: boolean;
  nurFavoriten: boolean;
  sortierung: "neueste" | "anreise" | "name";
};

export const LEER_FILTER: InboxFilter = {
  kanal: "all",
  lesestand: "all",
  nurZugewiesen: false,
  nurFavoriten: false,
  sortierung: "neueste",
};

/**
 * Wie viele Filter sind gesetzt? Die SORTIERUNG zählt nicht mit — es gilt immer
 * eine, und sie schränkt die Liste nicht ein. Sie als Filter zu zählen war
 * genau der Denkfehler der alten Pillen-Leiste.
 */
export function aktiveFilter(f: InboxFilter): number {
  let n = 0;
  if (f.kanal !== "all") n += 1;
  if (f.lesestand !== "all") n += 1;
  if (f.nurZugewiesen) n += 1;
  if (f.nurFavoriten) n += 1;
  return n;
}

const SORTIER_TEXT: Record<InboxFilter["sortierung"], string> = {
  neueste: "Neueste Aktivität",
  anreise: "Anreise",
  name: "Name des Gastes",
};

export function FilterSheet({
  open,
  onClose,
  filter,
  onFilter,
  kanaele,
}: {
  open: boolean;
  onClose: () => void;
  filter: InboxFilter;
  onFilter: (f: InboxFilter) => void;
  /** Die Kanäle, die in der geladenen Liste wirklich vorkommen. */
  kanaele: string[];
}) {
  const t = useTheme();

  const zeile = (
    label: string,
    gewaehlt: boolean,
    onPress: () => void,
    hinweis?: string,
  ) => (
    <Pressable
      key={label}
      onPress={onPress}
      style={({ pressed }) => ({ paddingVertical: 13, opacity: pressed ? 0.6 : 1 })}
    >
      <Row style={{ justifyContent: "space-between", gap: 12 }}>
        <Col style={{ flex: 1 }}>
          <Txt v="body">{label}</Txt>
          {hinweis && (
            <Txt v="xs" soft>
              {hinweis}
            </Txt>
          )}
        </Col>
        {/* Häkchen statt Füllung: eine Liste mit Auswahl liest sich schneller
            als eine Wand aus eingefärbten Pillen. */}
        {gewaehlt && <Icon n="check" s={18} sw={2.4} c={t.palette.ink} />}
      </Row>
      <Divider style={{ marginTop: 11 }} />
    </Pressable>
  );

  const abschnitt = (titel: string) => (
    <Txt v="xs" soft style={{ marginTop: 14, fontFamily: t.fonts.semibold }}>
      {titel.toUpperCase()}
    </Txt>
  );

  return (
    <Sheet
      open={open}
      onClose={onClose}
      full
      header={<Txt v="title">Filter</Txt>}
    >
      <Col>
        {abschnitt("Kanal")}
        {zeile("Alle Kanäle", filter.kanal === "all", () =>
          onFilter({ ...filter, kanal: "all" }),
        )}
        {kanaele.map((k) =>
          zeile(portalLabel(k), filter.kanal === k, () =>
            onFilter({ ...filter, kanal: k }),
          ),
        )}

        {abschnitt("Gelesen")}
        {zeile("Alle", filter.lesestand === "all", () =>
          onFilter({ ...filter, lesestand: "all" }),
        )}
        {zeile("Nur ungelesene", filter.lesestand === "unread", () =>
          onFilter({ ...filter, lesestand: "unread" }),
        )}

        {abschnitt("Eingrenzen")}
        {zeile(
          "Nur zugewiesene",
          filter.nurZugewiesen,
          () => onFilter({ ...filter, nurZugewiesen: !filter.nurZugewiesen }),
          "Konversationen mit einem Bearbeiter",
        )}
        {zeile("Nur Favoriten", filter.nurFavoriten, () =>
          onFilter({ ...filter, nurFavoriten: !filter.nurFavoriten }),
        )}

        {abschnitt("Sortierung")}
        {(Object.keys(SORTIER_TEXT) as InboxFilter["sortierung"][]).map((s) =>
          zeile(SORTIER_TEXT[s], filter.sortierung === s, () =>
            onFilter({ ...filter, sortierung: s }),
          ),
        )}

        <View style={{ height: 16 }} />
        <Row style={{ gap: 8 }}>
          <Btn variant="ghost" onPress={() => onFilter(LEER_FILTER)}>
            Zurücksetzen
          </Btn>
          <View style={{ flex: 1 }}>
            <Btn variant="dark" block onPress={onClose}>
              Fertig
            </Btn>
          </View>
        </Row>
      </Col>
    </Sheet>
  );
}
