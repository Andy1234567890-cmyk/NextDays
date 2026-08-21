// Gastgeber · Kalender — Monats-Grid wie das verbindliche Referenz-Mockup:
// Objekt-Auswahl oben (Dropdown), pro Monat ein 7-Spalten-Raster (So–Sa) mit
// Tageszahl + Tagespreis je Zelle, farbige Gäste-Namensbalken der Buchungen,
// mehrere Monate untereinander. ALLE Daten echt: Tagespreis/Belegung aus
// GET /calendar/availability, Namensbalken aus GET /reservations. Realtime auf
// die speisenden Tabellen (kein Polling/Reload, Wurzel/Regel Realtime-Pflicht).
//
// Wurzel 4: Preis symbollos aus den Tagesdaten (Währung aus property.
// type_attributes.currency); fehlt der Preis → leere Zelle, kein Fantasiewert.
// §4.3: staff/cleaner haben kein VIEW_CALENDAR → HostTabs zeigt den Tab gar
// nicht; das Backend maskiert zusätzlich.
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BuchungsPanel } from "@/components/buchung/BuchungsPanel";
import { Icon } from "@/components/ui/Icon";
import { Card, Col, Photo, Row, Spinner, Txt } from "@/components/ui/kit";
import { getBoard, type BoardProperty, type DayAvailability } from "@/lib/calendar";
import {
  addDays,
  buildBarSegments,
  buildMonthCells,
  isoLocal,
  monthLabel,
  parseLocal,
  HALBER_TAG as HALBER_TAG_GRID,
  type BarSegment,
  type GridCell,
} from "@/lib/calendar-grid";
import {
  availIndex,
  buildMatrixDays,
  buildRowBars,
  HALBER_TAG,
  type MatrixBar,
  type MatrixDay,
} from "@/lib/calendar-matrix";
import { KANAELE, channelMeta } from "@/lib/calendar-channels";
import { currencySymbol, formatCurrency } from "@/lib/currency";
import { heuteIso } from "@/lib/kalendertag";
import { listProperties, propertyTypeLabel, type Property } from "@/lib/properties";
import { useRealtime } from "@/lib/realtime";
import { listReservations, type Reservation } from "@/lib/reservations";
import type { HostTabParamList } from "@/navigation/types";
import { useUnterkante } from "@/lib/unterkante";
import { useTheme } from "@/theme/ThemeProvider";

const WEEKDAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
// Kurz-Monatsnamen für das Jahr-Dropdown (3×4-Raster).
const MONTH_SHORT = [
  "Jan", "Feb", "Mär", "Apr", "Mai", "Jun",
  "Jul", "Aug", "Sep", "Okt", "Nov", "Dez",
];
// Wie viele Monate ab dem aktuellen untereinander gezeigt werden.
const MONTHS_AHEAD = 4;

// --- Zeitachse der Matrix (endloses Scrollen wie im Web) -------------------
// Die Matrix zeigte genau EINEN Monat; am rechten Rand war Schluss und man
// musste ‹ › drücken. Der Web-Kalender (`calendar-board.tsx`) hat stattdessen
// EINE lange Achse und rendert nur das Sichtfenster (`OVERSCAN`), Daten holt er
// in Blöcken (`CHUNK_DAYS`). Genau das steht hier — dieselben drei Größen, nur
// kleiner gewählt, weil ein Telefon weniger Spalten zeigt und weniger Speicher
// hat.
const ACHSE_ZURUECK_MONATE = 2;
const ACHSE_VOR_MONATE = 14;
// Puffer links/rechts des sichtbaren Fensters gegen Leerflächen beim Wischen.
const SPALTEN_PUFFER = 12;
// Blockgröße (Tage) für das Nachladen der Tagesdaten. Der ganze Zeitraum in
// einem Zug wären ~480 Tage × N Objekte — der Request ist der Grund für Blöcke,
// nicht die Renderleistung.
const BLOCK_TAGE = 45;

type MonthKey = { year: number; month0: number };

// Monat um n verschieben (Überlauf normalisiert via Date-Konstruktor).
function shiftMonth(m: MonthKey, n: number): MonthKey {
  const d = new Date(m.year, m.month0 + n, 1);
  return { year: d.getFullYear(), month0: d.getMonth() };
}

function propertyLabel(p: Property): string {
  // Format wie das Referenz-Mockup: „<Nr> - <Titel>, <Ort>". Objektnummer =
  // BFE-Nummer (Objektkartei §6). Fehlt sie, ohne Nummer: „<Titel>, <Ort>"
  // (kein erfundener Ersatzwert, Wurzel 4). Ort statt Typ, näher an Bild 2.
  const place = [p.city, p.country].filter(Boolean).join(", ");
  const name = p.title || propertyTypeLabel(p.property_type);
  const head = p.bfe_number ? `${p.bfe_number} - ${name}` : name;
  return place ? `${head}, ${place}` : head;
}

export default function HostCalendar() {
  const t = useTheme();
  // Unten frei bleiben MUSS die Tab-Leiste, nicht nur die Systemleiste
  // (lib/unterkante) — sonst liegt die letzte Objektzeile dahinter.
  const unterkante = useUnterkante();
  const insets = useSafeAreaInsets();

  // Angetippte Buchung → Panel von rechts. Bis August 2026 waren die
  // Belegungsbalken reine Flächen ohne `onPress`: der Kalender zeigte, WER
  // wann da ist, und es gab von dort keinen Weg in die Buchung — man musste
  // sie in der Liste erneut suchen.
  const [offeneBuchung, setOffeneBuchung] = useState<string | null>(null);
  const navigation = useNavigation<NativeStackNavigationProp<HostTabParamList>>();

  const [props, setProps] = useState<Property[] | null>(null);
  const [propErr, setPropErr] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  // Ansicht: "month" = vertikales Monats-Grid (1 Objekt), "matrix" = Objekte×Tage.
  const [view, setView] = useState<"month" | "matrix">("month");

  const [avail, setAvail] = useState<DayAvailability[]>([]);
  const [currency, setCurrency] = useState<string | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(false);
  const [dataErr, setDataErr] = useState<string | null>(null);

  // Matrix-Ansicht: Board + Reservierungen für ALLE Objekte (property_id → …).
  const [matrixBoard, setMatrixBoard] = useState<Map<string, BoardProperty>>(new Map());
  const [matrixRes, setMatrixRes] = useState<Reservation[]>([]);
  // Unendlich scrollbar: Anzahl sichtbarer Monate wächst beim Scroll-Ende.
  const [monthCount, setMonthCount] = useState(MONTHS_AHEAD);
  const months = useMemo<MonthKey[]>(() => {
    const now = new Date();
    const list: MonthKey[] = [];
    for (let i = 0; i < monthCount; i += 1) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      list.push({ year: d.getFullYear(), month0: d.getMonth() });
    }
    return list;
  }, [monthCount]);

  // Lade-Zeitraum: erster Tag des ersten Monats bis erster Tag NACH dem letzten
  // (end exklusiv, wie der Backend-Contract).
  const rangeStart = useMemo(() => isoLocal(new Date(months[0].year, months[0].month0, 1)), [months]);
  const rangeEnd = useMemo(() => {
    const last = months[months.length - 1];
    return isoLocal(new Date(last.year, last.month0 + 1, 1));
  }, [months]);

  // Objekte laden.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await listProperties();
      if (cancelled) return;
      if (!res.ok) {
        setPropErr(res.error);
        return;
      }
      setProps(res.data.items);
      setSelectedId((prev) => prev ?? res.data.items[0]?.id ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async () => {
    if (!selectedId) return;
    setLoading(true);
    setDataErr(null);
    const [b, r] = await Promise.all([
      getBoard([selectedId], rangeStart, rangeEnd),
      listReservations(selectedId),
    ]);
    if (!b.ok) {
      setDataErr(b.error);
      setLoading(false);
      return;
    }
    if (!r.ok) {
      setDataErr(r.error);
      setLoading(false);
      return;
    }
    const board = b.data.items.find((it) => it.property_id === selectedId);
    setAvail(board?.days ?? []);
    // Währung aus dem Rate-Plan des Objekts (Board-Contract), nicht aus
    // type_attributes/Reservierungen — Objekte ohne Buchung haben sonst keine.
    setCurrency(board?.currency ?? null);
    setReservations(r.data.items);
    setLoading(false);
  }, [selectedId, rangeStart, rangeEnd]);

  useEffect(() => {
    if (view === "month") load();
  }, [load, view]);

  // Die Zeitachse der Matrix: EINE durchgehende Spanne, in der gescrollt wird —
  // kein Monatsfenster mehr. Sie hängt am heutigen Tag und nicht am gewählten
  // Monat: ‹ ›, „Heute" und das Dropdown SCROLLEN darin (siehe `scrollToTag`),
  // statt einen neuen Bereich zu laden. Genau daran scheiterte das endlose
  // Scrollen vorher — am rechten Rand des Monats war die Achse zu Ende.
  const achseStart = useMemo(() => {
    const h = new Date();
    return isoLocal(new Date(h.getFullYear(), h.getMonth() - ACHSE_ZURUECK_MONATE, 1));
  }, []);
  const achseEnde = useMemo(() => {
    const h = new Date();
    // Letzter Tag des letzten Monats der Achse (Tag 0 des Folgemonats).
    return isoLocal(new Date(h.getFullYear(), h.getMonth() + ACHSE_VOR_MONATE + 1, 0));
  }, []);

  const allIds = useMemo(() => (props ?? []).map((p) => p.id), [props]);

  // Welche Tagesblöcke schon geholt sind. Als Ref und nicht als State: die
  // Merkliste darf kein Neuzeichnen auslösen, sie verhindert nur doppelte
  // Anfragen (Wurzel 2 — beim Wischen feuert `onScroll` viele Male).
  const geholteBloecke = useRef(new Set<number>());

  /**
   * Die Tagesdaten für einen Spaltenbereich sicherstellen.
   *
   * Lädt NUR fehlende Blöcke und MERGED sie in die vorhandene Karte — ein
   * Ersetzen würde beim Weiterscrollen die Preise der Monate löschen, die man
   * gerade verlassen hat, und sie beim Zurückscrollen erneut holen.
   */
  const bloeckeSichern = useCallback(
    async (vonTag: number, bisTag: number) => {
      if (allIds.length === 0) return;
      const ersterBlock = Math.floor(Math.max(0, vonTag) / BLOCK_TAGE);
      const letzterBlock = Math.floor(Math.max(0, bisTag) / BLOCK_TAGE);
      const offen: number[] = [];
      for (let b = ersterBlock; b <= letzterBlock; b += 1) {
        if (!geholteBloecke.current.has(b)) {
          geholteBloecke.current.add(b);
          offen.push(b);
        }
      }
      if (offen.length === 0) return;
      setLoading(true);
      const anker = parseLocal(achseStart);
      const antworten = await Promise.all(
        offen.map((b) =>
          getBoard(
            allIds,
            isoLocal(addDays(anker, b * BLOCK_TAGE)),
            // `end` ist exklusiv (Board-Contract).
            isoLocal(addDays(anker, (b + 1) * BLOCK_TAGE)),
          ),
        ),
      );
      const fehler = antworten.find((r) => !r.ok);
      if (fehler && !fehler.ok) {
        // Fehlgeschlagene Blöcke wieder freigeben, sonst bleibt die Lücke für
        // immer leer (Wurzel 5: kein stilles „ist geladen").
        for (const b of offen) geholteBloecke.current.delete(b);
        setDataErr(fehler.error);
        setLoading(false);
        return;
      }
      setMatrixBoard((vorher) => {
        const naechste = new Map(vorher);
        for (const r of antworten) {
          if (!r.ok) continue;
          for (const it of r.data.items) {
            const bestehend = naechste.get(it.property_id);
            naechste.set(
              it.property_id,
              bestehend
                ? { ...it, days: [...bestehend.days, ...it.days] }
                : it,
            );
          }
        }
        return naechste;
      });
      setDataErr(null);
      setLoading(false);
    },
    [allIds, achseStart],
  );

  // Buchungen: EIN Abruf für alle Objekte, ohne Zeitraum — der Endpunkt liefert
  // sie am Stück, und ein Balken darf nicht fehlen, nur weil sein Block noch
  // nicht geholt wurde.
  const buchungenLaden = useCallback(async () => {
    if (allIds.length === 0) return;
    const r = await listReservations();
    if (!r.ok) {
      setDataErr(r.error);
      return;
    }
    setMatrixRes(r.data.items);
  }, [allIds]);

  const matrixNeuLaden = useCallback(() => {
    // Alles verwerfen und den sichtbaren Bereich neu holen: eine fremde
    // Änderung kann jeden Block betreffen, und welcher gerade sichtbar ist,
    // weiß die Matrix selbst (sie ruft `bloeckeSichern` beim nächsten Scroll
    // bzw. beim Aufbau erneut).
    geholteBloecke.current.clear();
    setMatrixBoard(new Map());
    buchungenLaden();
  }, [buchungenLaden]);

  useEffect(() => {
    if (view === "matrix") buchungenLaden();
  }, [buchungenLaden, view]);

  // Realtime: Belegung (availability) und Buchungen (reservations) — bei jeder
  // Änderung neu laden (debounced), kein manuelles Reload nach eigenen Aktionen
  // durch fremde/OTA-Änderungen. Server-Filter auf das gewählte Objekt.
  // Monatsansicht: auf das gewählte Objekt gefiltert. Matrix: alle Objekte, kein
  // Filter → jede Änderung lädt die Matrix neu.
  const propFilter = selectedId ? `property_id=eq.${selectedId}` : undefined;
  const onRt = view === "matrix" ? matrixNeuLaden : load;
  const rtFilter = view === "matrix" ? undefined : propFilter;
  const rtEnabled = view === "matrix" ? allIds.length > 0 : !!selectedId;
  useRealtime({ table: "reservations", filter: rtFilter, onChange: onRt, enabled: rtEnabled });
  useRealtime({ table: "availability", filter: rtFilter, onChange: onRt, enabled: rtEnabled });

  const availByIso = useMemo(() => {
    const m = new Map<string, DayAvailability>();
    for (const d of avail) m.set(d.date, d);
    return m;
  }, [avail]);

  const selectedProp = props?.find((p) => p.id === selectedId);

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}>
      <Col style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 14, gap: 16 }}>
        <Row style={{ justifyContent: "space-between", alignItems: "center" }}>
          <Txt v="display">Kalender</Txt>
          <Row gap={10}>
            {loading && <Spinner />}
            {/* Ansicht umschalten: Grid-Icon = Matrix (Objekte×Tage), List = Monat. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={view === "matrix" ? "Monatsansicht" : "Objektübersicht"}
              onPress={() => setView((v) => (v === "matrix" ? "month" : "matrix"))}
              hitSlop={10}
              style={({ pressed }) => ({ padding: 6, opacity: pressed ? 0.6 : 1 })}
            >
              <Icon n={view === "matrix" ? "list" : "grid"} s={22} sw={1.8} c={t.palette.ink} />
            </Pressable>
          </Row>
        </Row>

        {/* Objekt-Auswahl nur in der Monatsansicht (die Matrix zeigt alle). */}
        {view === "month" && (
          <PropertyPicker
            properties={props}
            selected={selectedProp}
            open={pickerOpen}
            onToggle={() => setPickerOpen((v) => !v)}
            onSelect={(id) => {
              setSelectedId(id);
              setPickerOpen(false);
            }}
          />
        )}
      </Col>

      {propErr ? (
        <StateBox tone="err">Objekte konnten nicht geladen werden: {propErr}</StateBox>
      ) : dataErr ? (
        <StateBox tone="err">Kalender konnte nicht geladen werden: {dataErr}</StateBox>
      ) : props && props.length === 0 ? (
        <StateBox tone="empty">Noch keine Objekte angelegt.</StateBox>
      ) : view === "matrix" ? (
        <MatrixCalendar
          properties={props ?? []}
          board={matrixBoard}
          reservations={matrixRes}
          onBuchung={setOffeneBuchung}
          start={achseStart}
          end={achseEnde}
          onSichtbar={bloeckeSichern}
          bottomInset={unterkante}
        />
      ) : !selectedId ? (
        <StateBox tone="empty">Objekt auswählen, um den Kalender zu sehen.</StateBox>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: unterkante + 24,
            gap: 28,
          }}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={(e) => {
            // Unendliches Nachladen: nahe am Ende weitere Monate anhängen.
            const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
            const nearEnd =
              contentOffset.y + layoutMeasurement.height >= contentSize.height - 600;
            if (nearEnd) setMonthCount((c) => c + MONTHS_AHEAD);
          }}
        >
          {months.map((mk) => (
            <MonthGrid
              key={`${mk.year}-${mk.month0}`}
              month={mk}
              availByIso={availByIso}
              reservations={reservations}
              currency={currency}
              onBuchung={setOffeneBuchung}
            />
          ))}
          <Legend />
        </ScrollView>
      )}

      {/* Das Panel liegt ÜBER dem Kalender, nicht an seiner Stelle: nach dem
          Schließen steht derselbe Monat mit derselben Scrollposition da.
          `onGeaendert` lädt den sichtbaren Blick neu — ein Check-in oder Storno
          verändert Balken und Verfügbarkeit (Wurzel 1). */}
      {offeneBuchung && (
        <BuchungsPanel
          reservationId={offeneBuchung}
          heuteIso={heuteIso()}
          onClose={() => setOffeneBuchung(null)}
          onGeaendert={view === "matrix" ? matrixNeuLaden : load}
          onNachrichtOeffnen={(threadId) => {
            setOffeneBuchung(null);
            navigation.navigate("HostInbox", { threadId });
          }}
        />
      )}
    </View>
  );
}

// --- Matrix-Ansicht (Objekte × Tage, Referenz-Mockup) -----------------------

// Objektspalte links: eingeklappt schmal (nur Foto), ausgeklappt breit genug
// für zweizeilige Namen. Das Grid rückt entsprechend nach — kein Overlay.
const NAME_COL_COLLAPSED = 52; // nur Foto
const NAME_COL_EXPANDED = 176; // Foto + voller Name (2 Zeilen)
const DAY_COL = 62; // Breite je Tages-Spalte
const ROW_H = 62; // Höhe je Objektzeile
// Höhe der Datumsleiste. Als Konstante, weil links (Ecke mit Ausklapp-Knopf)
// und rechts (Wochentag + Tageszahl) auf dieselbe Höhe MÜSSEN: die beiden
// Spalten scrollen getrennt, und schon ein Pixel Unterschied verschiebt die
// Fotos dauerhaft gegen ihre Zeilen.
const HEAD_H = 52;

function MatrixCalendar({
  properties,
  board,
  reservations,
  start,
  end,
  onSichtbar,
  onBuchung,
  bottomInset,
}: {
  properties: Property[];
  board: Map<string, BoardProperty>;
  reservations: Reservation[];
  start: string;
  end: string;
  /** Meldet den sichtbaren Spaltenbereich, damit die Daten nachgeladen werden. */
  onSichtbar: (vonTag: number, bisTag: number) => void;
  onBuchung: (reservationId: string) => void;
  bottomInset: number;
}) {
  const t = useTheme();
  // Die feste linke Spalte folgt dem Raster (siehe `onScroll` unten).
  const objektSpalte = useRef<ScrollView | null>(null);
  // Das Raster: wird auch zum Springen benutzt (‹ › · Heute · Monatswahl
  // scrollen, statt einen neuen Bereich zu laden).
  const raster = useRef<ScrollView | null>(null);
  // Objektspalte ausklappbar: eingeklappt nur Fotos, ausgeklappt Foto + Name.
  const [expanded, setExpanded] = useState(false);
  // Monat-Dropdown offen?
  const [monthOpen, setMonthOpen] = useState(false);
  const nameCol = expanded ? NAME_COL_EXPANDED : NAME_COL_COLLAPSED;
  const todayIso = isoLocal(new Date());
  const days = useMemo(() => buildMatrixDays(start, end, todayIso), [start, end, todayIso]);
  const gridWidth = days.length * DAY_COL;
  const todayCol = days.findIndex((d) => d.isToday);

  // --- Sichtfenster ---------------------------------------------------------
  // Gerendert wird NUR das Fenster plus Puffer. Ohne das entstünden bei 16
  // Monaten Achse und 20 Objekten über 9 000 Zellen — die Ansicht wäre beim
  // ersten Wischen eingefroren. Der Web-Kalender macht es genauso
  // (`visFrom`/`visTo` + OVERSCAN in `calendar-board.tsx`).
  // Startfenster um HEUTE, nicht um den Achsenanfang: die Achse reicht zwei
  // Monate zurück (damit man nach links blättern kann), aufgehen soll die
  // Ansicht aber am heutigen Tag. Ohne diesen Startwert zeigte sie den
  // Vormonat, und der Nutzer musste erst nach rechts wischen.
  const [fenster, setFenster] = useState(() => ({
    von: Math.max(0, ACHSE_ZURUECK_MONATE * 31 - SPALTEN_PUFFER),
    bis: ACHSE_ZURUECK_MONATE * 31 + SPALTEN_PUFFER * 2,
  }));
  // Der Sprung auf heute passiert genau EINMAL. Bei jedem Layout (Drehen,
  // Tastatur, Ausklappen der Objektspalte) erneut zu springen würde den Nutzer
  // aus dem Monat werfen, den er gerade ansieht.
  const startGesetzt = useRef(false);
  // Letzte horizontale Scrollposition — gebraucht, wenn sich nur das Layout
  // ändert (Objektspalte aus-/einklappen) und das Fenster neu gerechnet wird.
  const letzteX = useRef(0);
  const sichtbareTage = useMemo(
    () => days.slice(fenster.von, fenster.bis),
    [days, fenster],
  );

  const fensterSetzen = useCallback(
    (scrollX: number, breite: number) => {
      const ersteSpalte = Math.max(0, Math.floor(scrollX / DAY_COL));
      const spaltenImBild = Math.max(1, Math.ceil(breite / DAY_COL));
      const von = Math.max(0, ersteSpalte - SPALTEN_PUFFER);
      const bis = Math.min(days.length, ersteSpalte + spaltenImBild + SPALTEN_PUFFER);
      setFenster((vorher) =>
        vorher.von === von && vorher.bis === bis ? vorher : { von, bis },
      );
      onSichtbar(von, bis);
    },
    [days.length, onSichtbar],
  );

  // Zum Tag scrollen (Monatssprung). `animated: false`, weil ein Sprung über
  // Monate sonst sekundenlang durch alle Spalten fährt.
  const zuSpalteScrollen = useCallback((spalte: number) => {
    raster.current?.scrollTo({ x: Math.max(0, spalte) * DAY_COL, animated: false });
  }, []);

  // Kopf-Label „Monat Jahr" aus dem ersten SICHTBAREN Tag — beim Scrollen zieht
  // der Titel mit, statt an einem gewählten Monat zu kleben.
  const linkerTag = days[Math.min(days.length - 1, fenster.von + SPALTEN_PUFFER)];
  const first = linkerTag ? parseLocal(linkerTag.iso) : parseLocal(start);
  const curMonth: MonthKey = { year: first.getFullYear(), month0: first.getMonth() };
  const headLabel = monthLabel(curMonth.year, curMonth.month0);

  /** Erste Spalte eines Monats auf der Achse — oder die nächstgelegene. */
  const spalteVonMonat = useCallback(
    (m: MonthKey) => {
      const ziel = isoLocal(new Date(m.year, m.month0, 1));
      const treffer = days.findIndex((d) => d.iso >= ziel);
      return treffer >= 0 ? treffer : days.length - 1;
    },
    [days],
  );
  // Im Dropdown gewähltes Jahr (frei per ‹ Jahr › wählbar, kein Limit).
  const [pickerYear, setPickerYear] = useState(curMonth.year);
  // Beim Öffnen aufs aktuelle Jahr springen.
  useEffect(() => {
    if (monthOpen) setPickerYear(curMonth.year);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthOpen]);

  // Reservierungen nach Objekt gruppieren (Balkenbau je Zeile).
  const resByProp = useMemo(() => {
    const m = new Map<string, Reservation[]>();
    for (const r of reservations) {
      const list = m.get(r.property_id);
      if (list) list.push(r);
      else m.set(r.property_id, [r]);
    }
    return m;
  }, [reservations]);

  return (
    <Col style={{ flex: 1 }}>
      {/* Steuerleiste: Monat-Dropdown + ‹ › + Today (Mockup-Kopf). */}
      <Row style={{ justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 10, zIndex: 20 }}>
        <View>
          <Pressable onPress={() => setMonthOpen((v) => !v)}>
            <Row gap={4} style={{ alignItems: "center" }}>
              <Txt v="title">{headLabel}</Txt>
              <Icon n={monthOpen ? "arrowup" : "caretdown"} s={16} sw={2} c={t.palette.soft} />
            </Row>
          </Pressable>
          {monthOpen && (
            <>
              {/* Backdrop zum Schließen */}
              <Pressable
                onPress={() => setMonthOpen(false)}
                style={{ position: "absolute", top: -1000, left: -1000, right: -1000, bottom: -1000 }}
              />
              <Card
                style={{
                  position: "absolute",
                  top: 30,
                  left: 0,
                  width: 240,
                  padding: 12,
                  zIndex: 30,
                }}
              >
                {/* Jahr frei wählbar (‹ Jahr ›), kein festes Limit. */}
                <Row style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <Pressable
                    onPress={() => setPickerYear((y) => y - 1)}
                    style={{ padding: 6, borderRadius: t.radius.btn, borderWidth: 1, borderColor: t.palette.line }}
                  >
                    <Icon n="back" s={15} sw={2} c={t.palette.ink} />
                  </Pressable>
                  <Txt v="title">{pickerYear}</Txt>
                  <Pressable
                    onPress={() => setPickerYear((y) => y + 1)}
                    style={{ padding: 6, borderRadius: t.radius.btn, borderWidth: 1, borderColor: t.palette.line }}
                  >
                    <Icon n="fwd" s={15} sw={2} c={t.palette.ink} />
                  </Pressable>
                </Row>
                {/* 12 Monate als 3×4-Raster. */}
                <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                  {MONTH_SHORT.map((mLabel, m0) => {
                    const on = pickerYear === curMonth.year && m0 === curMonth.month0;
                    return (
                      <Pressable
                        key={m0}
                        onPress={() => {
                          zuSpalteScrollen(
                            spalteVonMonat({ year: pickerYear, month0: m0 }),
                          );
                          setMonthOpen(false);
                        }}
                        style={{
                          width: "33.33%",
                          paddingVertical: 9,
                          alignItems: "center",
                          borderRadius: t.radius.btn,
                          backgroundColor: on ? t.palette.accent : undefined,
                        }}
                      >
                        <Txt v="sm" color={on ? t.palette.accentInk : undefined}>
                          {mLabel}
                        </Txt>
                      </Pressable>
                    );
                  })}
                </View>
              </Card>
            </>
          )}
        </View>
        <Row gap={8}>
          <Pressable
            // ‹ › SCROLLEN auf der Achse, statt einen Monat neu zu laden —
            // sonst wäre die Achse wieder an ihren Rändern zu Ende.
            onPress={() =>
              zuSpalteScrollen(spalteVonMonat(shiftMonth(curMonth, -1)))
            }
            style={{ padding: 6, borderRadius: t.radius.btn, borderWidth: 1, borderColor: t.palette.line }}
          >
            <Icon n="back" s={16} sw={2} c={t.palette.ink} />
          </Pressable>
          <Pressable
            onPress={() =>
              zuSpalteScrollen(spalteVonMonat(shiftMonth(curMonth, 1)))
            }
            style={{ padding: 6, borderRadius: t.radius.btn, borderWidth: 1, borderColor: t.palette.line }}
          >
            <Icon n="fwd" s={16} sw={2} c={t.palette.ink} />
          </Pressable>
          <Pressable
            onPress={() => zuSpalteScrollen(Math.max(0, todayCol))}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: t.radius.btn,
              borderWidth: 1,
              borderColor: t.palette.line,
            }}
          >
            <Txt v="sm">Heute</Txt>
          </Pressable>
        </Row>
      </Row>

      {/* ZWEI Spalten, damit beide Leisten stehenbleiben, wo sie gebraucht
          werden: die OBJEKTSPALTE fest am linken Rand (sie scrollt vertikal mit
          den Zeilen, aber NICHT horizontal mit den Tagen), die DATUMSLEISTE fest
          oben (sie scrollt horizontal mit den Tagen, aber nicht vertikal).
          Vorher lag die Objektspalte innerhalb des horizontalen ScrollViews und
          wanderte beim Wischen nach links aus dem Bild — man sah Preise und
          Namensbalken, aber nicht mehr, zu welchem Haus sie gehören. Genau das
          macht die Ansicht unbrauchbar, und genau so hält es die Referenz
          (Lodgify/Hostaway: eingefrorene erste Spalte). */}
      <Row gap={0} style={{ flex: 1, alignItems: "stretch" }}>
        {/* --- Feste linke Spalte: Ecke + Objektzellen --- */}
        <Col style={{ width: nameCol + 20, paddingLeft: 20 }}>
          <View
            style={{
              width: nameCol,
              height: HEAD_H,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Pressable
              onPress={() => setExpanded((v) => !v)}
              style={{
                padding: 6,
                borderRadius: t.radius.btn,
                borderWidth: 1,
                borderColor: t.palette.line,
              }}
            >
              <Icon n={expanded ? "back" : "fwd"} s={16} sw={2.4} c={t.palette.ink} />
            </Pressable>
          </View>
          {/* Folgt dem rechten ScrollView. `scrollEnabled={false}`, weil genau
              EINE Seite führen muss: scrollten beide, schöbe jede die andere
              per `scrollTo`, und das Ergebnis ist ein Ruckeln, das nie zur Ruhe
              kommt. Gewischt wird also im Raster — dort ist ohnehin die Fläche. */}
          <ScrollView
            ref={objektSpalte}
            scrollEnabled={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: bottomInset + 32 }}
          >
            {properties.map((p) => (
              <ObjektZelle
                key={p.id}
                property={p}
                nameCol={nameCol}
                expanded={expanded}
              />
            ))}
          </ScrollView>
        </Col>

        {/* --- Raster: horizontal scrollend, mit fester Datumsleiste oben --- */}
        <Col style={{ flex: 1 }}>
          <ScrollView
            ref={raster}
            horizontal
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={(e) => {
              letzteX.current = e.nativeEvent.contentOffset.x;
              fensterSetzen(
                e.nativeEvent.contentOffset.x,
                e.nativeEvent.layoutMeasurement.width,
              );
            }}
            // Beim Aufbau einmal auf HEUTE springen und das Fenster rechnen:
            // die Breite steht erst nach dem Layout fest, und ohne diesen
            // Aufruf bliebe das Startfenster bei seinem Schätzwert stehen.
            onLayout={(e) => {
              const breite = e.nativeEvent.layout.width;
              const x = Math.max(0, todayCol) * DAY_COL;
              if (!startGesetzt.current && todayCol >= 0) {
                startGesetzt.current = true;
                letzteX.current = x;
                raster.current?.scrollTo({ x, animated: false });
                fensterSetzen(x, breite);
                return;
              }
              // Sonst: das Fenster aus der AKTUELLEN Position neu rechnen.
              // `onLayout` kennt sie nicht, deshalb wird sie beim Scrollen
              // mitgeschrieben — sonst spränge das Fenster beim Ausklappen der
              // Objektspalte zurück auf heute.
              fensterSetzen(letzteX.current, breite);
            }}
          >
            <Col>
              {/* gap={0}: `Row` setzt sonst 12 dp Abstand (kit.tsx) — die absolut
                  positionierten Balken rechnen mit DAY_COL und liefen dadurch pro
                  Spalte 12 dp aus dem Raster (gemessen: 74 statt 62 dp Schritt,
                  nach drei Spalten eine ganze Spaltenbreite Versatz). */}
              {/* Nur das Fenster wird gezeichnet; `marginLeft` hält die Spalten
                  an ihrer Stelle auf der langen Achse, `width` reserviert die
                  Gesamtbreite (sonst hätte die Achse kein Ende zum Scrollen). */}
              <Row gap={0} style={{ height: HEAD_H, width: gridWidth }}>
                <View style={{ width: fenster.von * DAY_COL }} />
                {sichtbareTage.map((d) => (
                  <DayHead key={d.iso} day={d} />
                ))}
              </Row>

              <ScrollView
                showsVerticalScrollIndicator={false}
                // Führt die linke Spalte mit. 16 ms ≈ ein Bild bei 60 Hz —
                // seltener zu melden lässt die Fotos hinter den Zeilen
                // herhinken, häufiger bringt nichts mehr.
                scrollEventThrottle={16}
                onScroll={(e) =>
                  objektSpalte.current?.scrollTo({
                    y: e.nativeEvent.contentOffset.y,
                    animated: false,
                  })
                }
                contentContainerStyle={{ paddingBottom: bottomInset + 32 }}
              >
                <View>
                  {/* Durchgehender roter Heute-Streifen über ALLE Zeilen (Mockup).
                      Ohne die Namensspalte im Raster zählt der Versatz nur noch
                      die Tage — `nameCol` gehört hier NICHT mehr dazu. */}
                  {todayCol >= fenster.von && todayCol < fenster.bis && (
                    <View
                      pointerEvents="none"
                      style={{
                        position: "absolute",
                        top: 0,
                        height: properties.length * ROW_H,
                        left: todayCol * DAY_COL,
                        width: DAY_COL,
                        backgroundColor: t.palette.accentSoft,
                        borderLeftWidth: 2,
                        borderRightWidth: 2,
                        borderColor: t.palette.accent,
                      }}
                    />
                  )}
                  {properties.map((p) => (
                    <MatrixRow
                      key={p.id}
                      bp={board.get(p.id)}
                      reservations={resByProp.get(p.id) ?? []}
                      // Nur die sichtbaren Spalten. Die Balken werden gegen
                      // DIESE Tage gerechnet (`buildRowBars`) und liegen damit
                      // im verschobenen Fenster richtig; was außerhalb liegt,
                      // schneidet die Balkenrechnung ohnehin ab.
                      days={sichtbareTage}
                      versatz={fenster.von}
                      gridWidth={gridWidth}
                      onBuchung={onBuchung}
                    />
                  ))}
                </View>
                <View style={{ paddingTop: 12, paddingLeft: 4 }}>
                  <Legend />
                </View>
              </ScrollView>
            </Col>
          </ScrollView>
        </Col>
      </Row>
    </Col>
  );
}

function DayHead({ day }: { day: MatrixDay }) {
  const t = useTheme();
  const wd = WEEKDAYS[day.dow];
  return (
    // Feste Höhe (HEAD_H) statt `paddingVertical`: die Datumsleiste und die
    // Ecke über der Objektspalte stehen in GETRENNTEN Spalten, die eigenständig
    // scrollen. Wächst eine der beiden mit ihrem Inhalt, laufen die Fotos
    // dauerhaft gegen ihre Zeilen versetzt.
    <View
      style={{
        width: DAY_COL,
        height: HEAD_H,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Txt v="xs" faint>{wd}</Txt>
      {day.isToday ? (
        <View
          style={{
            marginTop: 2,
            width: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: t.palette.accent,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Txt v="sm" color={t.palette.accentInk} style={{ fontFamily: t.type.semibold.fontFamily }}>
            {day.dom}
          </Txt>
        </View>
      ) : (
        <Txt v="sm" style={{ marginTop: 2, fontFamily: t.type.semibold.fontFamily }}>
          {day.dom}
        </Txt>
      )}
    </View>
  );
}

/** Eine Zelle der FESTEN linken Spalte: Foto, ausgeklappt mit Namen.
 *
 * Eigene Komponente, seit die Spalte aus dem scrollenden Raster gelöst ist.
 * Ihre Höhe MUSS `ROW_H` sein — sie ist das Gegenstück zur Rasterzeile, und ein
 * Unterschied summiert sich über die Objekte zu einem sichtbaren Versatz. */
function ObjektZelle({
  property,
  nameCol,
  expanded,
}: {
  property: Property;
  nameCol: number;
  expanded: boolean;
}) {
  const t = useTheme();
  return (
    <Row
      gap={8}
      style={{
        width: nameCol,
        height: ROW_H,
        paddingHorizontal: 8,
        alignItems: "center",
        justifyContent: expanded ? "flex-start" : "center",
        borderTopWidth: 1,
        borderTopColor: t.palette.line,
        borderRightWidth: 1,
        borderRightColor: t.palette.line,
      }}
    >
      <Photo src={property.photos?.[0]} h={32} w={32} r={7} />
      {expanded && (
        <Txt v="xs" numberOfLines={2} style={{ flex: 1 }}>
          {property.bfe_number ? `${property.bfe_number} · ` : ""}
          {property.title}
        </Txt>
      )}
    </Row>
  );
}

function MatrixRow({
  bp,
  reservations,
  days,
  versatz,
  gridWidth,
  onBuchung,
}: {
  // `property` steht NICHT mehr hier: Foto und Name liegen in der festen
  // linken Spalte (`ObjektZelle`). Die Zeile trägt nur noch das Raster.
  bp: BoardProperty | undefined;
  reservations: Reservation[];
  /** NUR die sichtbaren Tage (Fenster), nicht die ganze Achse. */
  days: MatrixDay[];
  /** Index der ersten sichtbaren Spalte auf der Achse. */
  versatz: number;
  gridWidth: number;
  onBuchung: (reservationId: string) => void;
}) {
  const t = useTheme();
  const byIso = useMemo(() => availIndex(bp?.days ?? []), [bp]);
  const bars = useMemo(() => buildRowBars(reservations, days), [reservations, days]);
  const sym = currencySymbol(bp?.currency ?? null);

  return (
    <Row gap={0} style={{ height: ROW_H, borderTopWidth: 1, borderTopColor: t.palette.line }}>
      {/* Tages-Zellen mit Preis + darüber die Buchungsbalken. Die Objektspalte
          liegt NICHT mehr hier, sondern fest links (`ObjektZelle`). Gezeichnet
          wird nur das Fenster; der linke Abstandhalter hält es an seiner Stelle
          auf der Achse. */}
      <View style={{ width: gridWidth, height: ROW_H }}>
        {/* EIN verschobener Container für Zellen UND Balken: die Balken rechnen
            ihre Position gegen die sichtbaren Tage (`buildRowBars`), also müssen
            sie denselben Versatz erben wie die Zellen. Lägen sie daneben,
            stünde jeder Namensbalken um das Fenster versetzt im Raster. */}
        <View style={{ position: "absolute", left: versatz * DAY_COL, top: 0 }}>
          <Row gap={0}>
          {days.map((d) => {
            const a = byIso.get(d.iso);
            const price = a?.price;
            return (
              <View
                key={d.iso}
                style={{
                  // Zelle und Balken MUESSEN dasselbe Rastermass benutzen:
                  // beide DAY_COL, wie im Web beide `COL`. Der Rahmen zaehlt
                  // NICHT zur Breite dazu — Yoga rechnet border-box
                  // (ReactCommon/yoga/style/Style.h: BoxSizing::BorderBox ist
                  // der Default), die Zelle bleibt also 62 dp breit.
                  width: DAY_COL,
                  height: ROW_H,
                  borderLeftWidth: 1,
                  borderLeftColor: t.palette.line,
                  alignItems: "center",
                  justifyContent: "flex-start",
                  paddingTop: 5,
                }}
              >
                {typeof price === "number" ? (
                  <Txt v="xs" soft>
                    {sym ? `${sym} ${formatCurrency(price, null)}` : formatCurrency(price, null)}
                  </Txt>
                ) : null}
              </View>
            );
            })}
          </Row>

          {/* Balken-Overlay: absolute Positionierung über den Zellen. */}
          {bars.map((b, i) => (
            <MatrixBarView
              key={`${b.reservationId}-${i}`}
              bar={b}
              onPress={() => onBuchung(b.reservationId)}
            />
          ))}
        </View>
      </View>
    </Row>
  );
}

function MatrixBarView({
  bar,
  onPress,
}: {
  bar: MatrixBar;
  onPress: () => void;
}) {
  const t = useTheme();
  // Halbtags-Versatz wie im Web (`calendar-board.tsx`, HALF_DAY): Anreise ab
  // der Spaltenmitte, Auslauf bis zur Mitte des Abreisetags. Sonst belegt eine
  // Buchung den Wechseltag ganz und der Nachmieter sieht aus wie eine
  // Doppelbelegung. Am Fensterrand (clip) bleibt der Balken bündig.
  const linksVersatz = bar.halbStart ? HALBER_TAG : 0;
  const spalten =
    bar.endCol - bar.startCol + 1 - linksVersatz + (bar.halbEnde ? HALBER_TAG : 0);
  const left = (bar.startCol + linksVersatz) * DAY_COL + 2;
  const width = spalten * DAY_COL - 4;
  return (
    // Wie im Monatsgitter: der Balken IST der Weg in die Buchung. `hitSlop`
    // vergrößert die Trefferfläche des 22 Punkte hohen Streifens.
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Buchung ${bar.label} öffnen`}
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8 }}
      style={({ pressed }) => ({
        position: "absolute",
        top: 26,
        left,
        width,
        height: 22,
        backgroundColor: bar.bar,
        borderRadius: 6,
        borderTopLeftRadius: bar.clipStart ? 0 : 6,
        borderBottomLeftRadius: bar.clipStart ? 0 : 6,
        borderTopRightRadius: bar.clipEnd ? 0 : 6,
        borderBottomRightRadius: bar.clipEnd ? 0 : 6,
        justifyContent: "center",
        paddingHorizontal: 6,
        opacity: pressed ? 0.65 : 1,
      })}
    >
      <Txt
        v="xs"
        numberOfLines={1}
        color={bar.text}
        style={{ fontFamily: t.type.semibold.fontFamily, fontSize: 11 }}
      >
        {bar.label}
      </Txt>
    </Pressable>
  );
}

// --- Objekt-Dropdown --------------------------------------------------------

function PropertyPicker({
  properties,
  selected,
  open,
  onToggle,
  onSelect,
}: {
  properties: Property[] | null;
  selected: Property | undefined;
  open: boolean;
  onToggle: () => void;
  onSelect: (id: string) => void;
}) {
  const t = useTheme();
  if (!properties) return <Card style={{ padding: 14 }}><Txt v="sm" soft>Objekte werden geladen …</Txt></Card>;

  return (
    <View>
      <Pressable onPress={onToggle}>
        {/* Kompakte, umrandete Umschalter-Pille (Referenz-Mockup Bild 2):
            kleines Thumbnail, kleiner Text „<Nr> - <Titel>, <Ort>", Chevron. */}
        <Row
          style={{
            justifyContent: "space-between",
            borderWidth: 1,
            borderColor: t.palette.line,
            borderRadius: t.radius.btn,
            backgroundColor: t.palette.surface,
            paddingVertical: 11,
            paddingHorizontal: 12,
          }}
        >
          <Row style={{ flex: 1, marginRight: 8 }} gap={10}>
            <Photo src={selected?.photos?.[0]} h={34} w={34} r={8} />
            <Txt v="sm" numberOfLines={1} style={{ flex: 1 }}>
              {selected ? propertyLabel(selected) : "Objekt wählen"}
            </Txt>
          </Row>
          <Icon n={open ? "arrowup" : "caretdown"} s={16} sw={2} c={t.palette.soft} />
        </Row>
      </Pressable>

      {open && (
        <Card style={{ marginTop: 8, paddingVertical: 6, maxHeight: 340 }}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {properties.map((p) => {
              const on = p.id === selected?.id;
              return (
                <Pressable key={p.id} onPress={() => onSelect(p.id)}>
                  <Row style={{ paddingVertical: 9, paddingHorizontal: 12, justifyContent: "space-between" }} gap={10}>
                    <Photo src={p.photos?.[0]} h={30} w={30} r={8} />
                    <Txt v="sm" numberOfLines={1} accent={on} style={{ flex: 1 }}>
                      {propertyLabel(p)}
                    </Txt>
                    {on && <Icon n="check" s={16} sw={2.2} c={t.palette.accent} />}
                  </Row>
                </Pressable>
              );
            })}
          </ScrollView>
        </Card>
      )}
    </View>
  );
}

// --- Monats-Grid ------------------------------------------------------------

function MonthGrid({
  month,
  availByIso,
  reservations,
  currency,
  onBuchung,
}: {
  month: MonthKey;
  availByIso: Map<string, DayAvailability>;
  reservations: Reservation[];
  currency: string | null;
  onBuchung: (reservationId: string) => void;
}) {
  const cells = useMemo(() => buildMonthCells(month.year, month.month0, availByIso), [month, availByIso]);
  const segments = useMemo(() => buildBarSegments(cells, reservations), [cells, reservations]);
  const rows = cells.length / 7;

  return (
    <Col gap={10}>
      <Txt v="h2" style={{ textAlign: "center" }}>
        {monthLabel(month.year, month.month0)}
      </Txt>

      {/* Wochentagsköpfe */}
      <Row>
        {WEEKDAYS.map((w) => (
          <View key={w} style={{ flex: 1, alignItems: "center" }}>
            <Txt v="xs" faint>{w}</Txt>
          </View>
        ))}
      </Row>

      {/* Grid: pro Woche eine Zeile mit 7 Zellen; darüber die Balkensegmente */}
      <Col gap={0}>
        {Array.from({ length: rows }, (_, r) => {
          const rowCells = cells.slice(r * 7, r * 7 + 7);
          const rowSegs = segments.filter((s) => s.row === r);
          return (
            <WeekRow
              key={r}
              cells={rowCells}
              segments={rowSegs}
              currency={currency}
              onBuchung={onBuchung}
            />
          );
        })}
      </Col>
    </Col>
  );
}

// Zell-Höhe wie im Mockup (Tageszahl + Preiszeile, kompakt). Balkenband liegt
// UNTER dieser Grundzelle; die Zeilenhöhe wächst um die belegten Bahnen.
const CELL_BASE = 52;
const BAR_HEIGHT = 22;
const BAR_GAP = 4;
const BAR_TOP = CELL_BASE - 2; // Balken beginnen knapp unter der Preiszeile

// Preis-Override-Markierung (lila) wie im Referenz-Mockup. Feste UI-Farbe, kein
// Währungs-/Geldwert (Wurzel 4 betrifft Geld, nicht Statusfarben).
const OVERRIDE_COLOR = "#8A5CF6";
const OVERRIDE_FILL = "rgba(138,92,246,0.08)";

// Zusammenhängende Läufe von Override-Tagen (price_source === "override") in
// einer Grid-Woche → je eine umrahmte Gruppe.
function overrideRuns(cells: GridCell[]): { start: number; end: number }[] {
  const runs: { start: number; end: number }[] = [];
  let start = -1;
  cells.forEach((c, i) => {
    const on = c.inMonth && c.avail?.price_source === "override";
    if (on && start === -1) start = i;
    if (!on && start !== -1) {
      runs.push({ start, end: i - 1 });
      start = -1;
    }
  });
  if (start !== -1) runs.push({ start, end: cells.length - 1 });
  return runs;
}

function WeekRow({
  cells,
  segments,
  currency,
  onBuchung,
}: {
  cells: GridCell[];
  segments: BarSegment[];
  currency: string | null;
  onBuchung: (reservationId: string) => void;
}) {
  const t = useTheme();
  const sym = currencySymbol(currency);
  // Mehrere überlappende Balken → vertikal stapeln (Bahn pro Slot).
  const laidOut = layoutBars(segments);
  const bandHeight = laidOut.lanes > 0 && segments.length > 0
    ? laidOut.lanes * (BAR_HEIGHT + BAR_GAP) + BAR_GAP
    : 0;
  const rowHeight = CELL_BASE + bandHeight;
  // Zusammenhängende Preis-Override-Spannen (price_source === "override") in
  // dieser Woche → lila umrahmte Gruppe wie im Referenz-Mockup.
  const overrideSpans = overrideRuns(cells);

  return (
    <View style={{ position: "relative", height: rowHeight, flexDirection: "row" }}>
      {/* Tageszellen als Gitternetz-Kästchen (Rahmen rundum) */}
      {cells.map((c) => {
        const price = c.avail?.price;
        const blocked = c.avail?.status === "blocked";
        const isOverride = c.inMonth && c.avail?.price_source === "override";
        return (
          <View
            key={c.iso}
            style={{
              flex: 1,
              height: rowHeight,
              borderTopWidth: 1,
              borderLeftWidth: 1,
              borderColor: t.palette.line,
              paddingTop: 5,
              alignItems: "center",
              backgroundColor: !c.inMonth ? t.palette.surface2 : undefined,
            }}
          >
            <Txt
              v="sm"
              faint={!c.inMonth}
              style={{ fontFamily: t.type.bold.fontFamily, fontSize: 14 }}
            >
              {c.day}
            </Txt>
            {c.inMonth && typeof price === "number" ? (
              <Txt
                v="xs"
                faint={blocked}
                soft={!blocked && !isOverride}
                color={isOverride ? OVERRIDE_COLOR : undefined}
                style={{ marginTop: 1, fontSize: 10.5, fontFamily: isOverride ? t.type.bold.fontFamily : undefined }}
              >
                {sym ? `${sym} ${formatCurrency(price, null)}` : formatCurrency(price, null)}
              </Txt>
            ) : null}
          </View>
        );
      })}

      {/* Override-Rahmen (lila) über den betroffenen Zellen */}
      {overrideSpans.map((span) => {
        const leftPct = (span.start / 7) * 100;
        const widthPct = ((span.end - span.start + 1) / 7) * 100;
        return (
          <View
            key={`ov-${span.start}`}
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 3,
              left: `${leftPct}%`,
              width: `${widthPct}%`,
              height: CELL_BASE - 4,
              borderWidth: 1.5,
              borderColor: OVERRIDE_COLOR,
              backgroundColor: OVERRIDE_FILL,
              borderRadius: 9,
            }}
          />
        );
      })}

      {/* Belegungsbalken (absolut über den Zellen) */}
      {laidOut.bars.map((s, i) => {
        // Halbtags-Versatz wie im Web (`calendar-board.tsx`, HALF_DAY): der
        // Balken beginnt in der MITTE des Anreisetags und laeuft bis zur Mitte
        // des Abreisetags, damit Vor- und Nachmieter den Wechseltag sichtbar
        // teilen. Ohne das belegte die Anreise die ganze Zelle und ein
        // Wechseltag sah aus wie eine Doppelbelegung.
        const linksVersatz = s.halbStart ? HALBER_TAG_GRID : 0;
        const spalten =
          s.endCol - s.startCol + 1 - linksVersatz + (s.halbEnde ? HALBER_TAG_GRID : 0);
        const leftPct = ((s.startCol + linksVersatz) / 7) * 100;
        const widthPct = (spalten / 7) * 100;
        return (
          // Antippen öffnet die Buchung. `hitSlop` nach oben/unten, weil ein
          // 22 Punkte hoher Balken unter der Fingerkuppe sonst schwer zu
          // treffen ist (Apple nennt 44 Punkte als Mindestmaß).
          <Pressable
            key={`${s.reservationId}-${i}`}
            accessibilityRole="button"
            accessibilityLabel={`Buchung ${s.label} öffnen`}
            onPress={() => onBuchung(s.reservationId)}
            hitSlop={{ top: 8, bottom: 8 }}
            style={({ pressed }) => ({
              position: "absolute",
              top: BAR_TOP + s.lane * (BAR_HEIGHT + BAR_GAP),
              left: `${leftPct}%`,
              width: `${widthPct}%`,
              height: BAR_HEIGHT,
              paddingHorizontal: 3,
              opacity: pressed ? 0.65 : 1,
            })}
          >
            <View
              style={{
                flex: 1,
                backgroundColor: s.bar,
                borderTopLeftRadius: s.clipStart ? 0 : 7,
                borderBottomLeftRadius: s.clipStart ? 0 : 7,
                borderTopRightRadius: s.clipEnd ? 0 : 7,
                borderBottomRightRadius: s.clipEnd ? 0 : 7,
                justifyContent: "center",
                paddingHorizontal: 7,
              }}
            >
              <Txt v="xs" numberOfLines={1} color={s.text} style={{ fontFamily: t.type.semibold.fontFamily, fontSize: 11 }}>
                {s.label}
              </Txt>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

// Überlappende Segmente in vertikale Bahnen (lanes) packen, damit sich Balken
// nicht überdecken.
function layoutBars(segments: BarSegment[]): {
  bars: (BarSegment & { lane: number })[];
  lanes: number;
} {
  const sorted = [...segments].sort((a, b) => a.startCol - b.startCol);
  const laneEnds: number[] = []; // letzte belegte Spalte je Bahn
  const bars = sorted.map((s) => {
    let lane = laneEnds.findIndex((end) => s.startCol > end);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(s.endCol);
    } else {
      laneEnds[lane] = s.endCol;
    }
    return { ...s, lane };
  });
  return { bars, lanes: Math.max(1, laneEnds.length) };
}

// --- Legende / Zustände -----------------------------------------------------

// Legende der Balkenfarben. Quelle ist die Kanal-Meta, NICHT eine eigene Liste:
// vorher standen hier fünf Kanäle mit ihren Hex-Werten abgeschrieben — `website`
// und „Anderes Portal" fehlten, und ihre Balken erschienen im Kalender in einer
// Farbe, die die Legende nicht erklärte.
function Legend() {
  return (
    <Row style={{ flexWrap: "wrap", justifyContent: "center", gap: 14, paddingTop: 4 }}>
      {KANAELE.map((k) => {
        const meta = channelMeta(k);
        return (
          <Row key={k} gap={6}>
            <View
              style={{ width: 12, height: 12, borderRadius: 4, backgroundColor: meta.bar }}
            />
            <Txt v="xs" soft>
              {meta.label}
            </Txt>
          </Row>
        );
      })}
    </Row>
  );
}

function StateBox({ tone, children }: { tone: "err" | "empty"; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <Col style={{ paddingHorizontal: 20, paddingTop: 40, alignItems: "center", gap: 8 }}>
      <Icon n={tone === "err" ? "x" : "cal"} s={28} sw={1.8} c={t.palette.faint} />
      <Txt v="sm" soft style={{ textAlign: "center" }}>
        {children}
      </Txt>
    </Col>
  );
}
