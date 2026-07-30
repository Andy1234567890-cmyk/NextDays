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
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
  type BarSegment,
  type GridCell,
} from "@/lib/calendar-grid";
import {
  availIndex,
  buildMatrixDays,
  buildRowBars,
  type MatrixBar,
  type MatrixDay,
} from "@/lib/calendar-matrix";
import { currencySymbol, formatCurrency } from "@/lib/currency";
import { listProperties, propertyTypeLabel, type Property } from "@/lib/properties";
import { useRealtime } from "@/lib/realtime";
import { listReservations, type Reservation } from "@/lib/reservations";
import { useTheme } from "@/theme/ThemeProvider";

const WEEKDAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
// Kurz-Monatsnamen für das Jahr-Dropdown (3×4-Raster).
const MONTH_SHORT = [
  "Jan", "Feb", "Mär", "Apr", "Mai", "Jun",
  "Jul", "Aug", "Sep", "Okt", "Nov", "Dez",
];
// Wie viele Monate ab dem aktuellen untereinander gezeigt werden.
const MONTHS_AHEAD = 4;

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
  const insets = useSafeAreaInsets();

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
  // Sichtbarer Matrix-Monat (‹ › blättert monatsweise, wie das Mockup).
  const [matrixMonth, setMatrixMonth] = useState<MonthKey>(() => {
    const now = new Date();
    return { year: now.getFullYear(), month0: now.getMonth() };
  });

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

  // Matrix-Fenster = ganzer sichtbarer Monat (1. bis Monatsletzter), ‹ › blättert
  // monatsweise. Kein Hardcode — Monat kommt aus dem State (Start: heutiger).
  const matrixStart = useMemo(
    () => isoLocal(new Date(matrixMonth.year, matrixMonth.month0, 1)),
    [matrixMonth],
  );
  const matrixEnd = useMemo(
    () => isoLocal(new Date(matrixMonth.year, matrixMonth.month0 + 1, 0)),
    [matrixMonth],
  );

  const allIds = useMemo(() => (props ?? []).map((p) => p.id), [props]);

  const loadMatrix = useCallback(async () => {
    if (allIds.length === 0) return;
    setLoading(true);
    setDataErr(null);
    // Board end ist exklusiv → einen Tag nach dem letzten sichtbaren.
    const boardEnd = isoLocal(addDays(parseLocal(matrixEnd), 1));
    const [b, r] = await Promise.all([
      getBoard(allIds, matrixStart, boardEnd),
      listReservations(),
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
    const map = new Map<string, BoardProperty>();
    for (const it of b.data.items) map.set(it.property_id, it);
    setMatrixBoard(map);
    setMatrixRes(r.data.items);
    setLoading(false);
  }, [allIds, matrixStart, matrixEnd]);

  useEffect(() => {
    if (view === "matrix") loadMatrix();
  }, [loadMatrix, view]);

  // Realtime: Belegung (availability) und Buchungen (reservations) — bei jeder
  // Änderung neu laden (debounced), kein manuelles Reload nach eigenen Aktionen
  // durch fremde/OTA-Änderungen. Server-Filter auf das gewählte Objekt.
  // Monatsansicht: auf das gewählte Objekt gefiltert. Matrix: alle Objekte, kein
  // Filter → jede Änderung lädt die Matrix neu.
  const propFilter = selectedId ? `property_id=eq.${selectedId}` : undefined;
  const onRt = view === "matrix" ? loadMatrix : load;
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
          start={matrixStart}
          end={matrixEnd}
          onPrev={() => setMatrixMonth((m) => shiftMonth(m, -1))}
          onNext={() => setMatrixMonth((m) => shiftMonth(m, 1))}
          onToday={() => {
            const now = new Date();
            setMatrixMonth({ year: now.getFullYear(), month0: now.getMonth() });
          }}
          onPickMonth={(m) => setMatrixMonth(m)}
          bottomInset={insets.bottom}
        />
      ) : !selectedId ? (
        <StateBox tone="empty">Objekt auswählen, um den Kalender zu sehen.</StateBox>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 32, gap: 28 }}
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
            />
          ))}
          <Legend />
        </ScrollView>
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

function MatrixCalendar({
  properties,
  board,
  reservations,
  start,
  end,
  onPrev,
  onNext,
  onToday,
  onPickMonth,
  bottomInset,
}: {
  properties: Property[];
  board: Map<string, BoardProperty>;
  reservations: Reservation[];
  start: string;
  end: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onPickMonth: (m: MonthKey) => void;
  bottomInset: number;
}) {
  const t = useTheme();
  // Objektspalte ausklappbar: eingeklappt nur Fotos, ausgeklappt Foto + Name.
  const [expanded, setExpanded] = useState(false);
  // Monat-Dropdown offen?
  const [monthOpen, setMonthOpen] = useState(false);
  const nameCol = expanded ? NAME_COL_EXPANDED : NAME_COL_COLLAPSED;
  const todayIso = isoLocal(new Date());
  const days = useMemo(() => buildMatrixDays(start, end, todayIso), [start, end, todayIso]);
  const gridWidth = days.length * DAY_COL;
  const todayCol = days.findIndex((d) => d.isToday);

  // Kopf-Label „Monat Jahr" aus dem ersten sichtbaren Tag.
  const first = parseLocal(start);
  const curMonth: MonthKey = { year: first.getFullYear(), month0: first.getMonth() };
  const headLabel = monthLabel(curMonth.year, curMonth.month0);
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
                          onPickMonth({ year: pickerYear, month0: m0 });
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
            onPress={onPrev}
            style={{ padding: 6, borderRadius: t.radius.btn, borderWidth: 1, borderColor: t.palette.line }}
          >
            <Icon n="back" s={16} sw={2} c={t.palette.ink} />
          </Pressable>
          <Pressable
            onPress={onNext}
            style={{ padding: 6, borderRadius: t.radius.btn, borderWidth: 1, borderColor: t.palette.line }}
          >
            <Icon n="fwd" s={16} sw={2} c={t.palette.ink} />
          </Pressable>
          <Pressable
            onPress={onToday}
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

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingLeft: 20 }}
      >
        <Col>
          {/* Kopfzeile: Ausklapp-Toggle (>> / <<) über der Foto-Spalte, dann
              Wochentag/Datum je Spalte. */}
          <Row>
            <View style={{ width: nameCol, alignItems: "center", justifyContent: "center" }}>
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
            {days.map((d) => (
              <DayHead key={d.iso} day={d} />
            ))}
          </Row>

          {/* Objektzeilen */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: bottomInset + 32 }}
          >
            <View>
              {/* Durchgehender roter Heute-Streifen über ALLE Zeilen (Mockup). */}
              {todayCol >= 0 && (
                <View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    top: 0,
                    height: properties.length * ROW_H,
                    left: nameCol + todayCol * DAY_COL,
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
                  property={p}
                  bp={board.get(p.id)}
                  reservations={resByProp.get(p.id) ?? []}
                  days={days}
                  gridWidth={gridWidth}
                  nameCol={nameCol}
                  expanded={expanded}
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
  );
}

function DayHead({ day }: { day: MatrixDay }) {
  const t = useTheme();
  const wd = WEEKDAYS[day.dow];
  return (
    <View style={{ width: DAY_COL, alignItems: "center", paddingVertical: 6 }}>
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

function MatrixRow({
  property,
  bp,
  reservations,
  days,
  gridWidth,
  nameCol,
  expanded,
}: {
  property: Property;
  bp: BoardProperty | undefined;
  reservations: Reservation[];
  days: MatrixDay[];
  gridWidth: number;
  nameCol: number;
  expanded: boolean;
}) {
  const t = useTheme();
  const byIso = useMemo(() => availIndex(bp?.days ?? []), [bp]);
  const bars = useMemo(() => buildRowBars(reservations, days), [reservations, days]);
  const sym = currencySymbol(bp?.currency ?? null);

  return (
    <Row style={{ height: ROW_H, borderTopWidth: 1, borderTopColor: t.palette.line }}>
      {/* Objekt-Spalte: eingeklappt nur Foto (zentriert), ausgeklappt Foto +
          voller Name (2 Zeilen). Feste Breite → Grid rückt nach, kein Overlay. */}
      <Row
        style={{
          width: nameCol,
          paddingHorizontal: 8,
          alignItems: "center",
          justifyContent: expanded ? "flex-start" : "center",
          borderRightWidth: 1,
          borderRightColor: t.palette.line,
        }}
        gap={8}
      >
        <Photo src={property.photos?.[0]} h={32} w={32} r={7} />
        {expanded && (
          <Txt v="xs" numberOfLines={2} style={{ flex: 1 }}>
            {property.bfe_number ? `${property.bfe_number} · ` : ""}
            {property.title}
          </Txt>
        )}
      </Row>

      {/* Tages-Zellen mit Preis + darüber die Buchungsbalken. */}
      <View style={{ width: gridWidth }}>
        <Row>
          {days.map((d) => {
            const a = byIso.get(d.iso);
            const price = a?.price;
            return (
              <View
                key={d.iso}
                style={{
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
          <MatrixBarView key={`${b.reservationId}-${i}`} bar={b} />
        ))}
      </View>
    </Row>
  );
}

function MatrixBarView({ bar }: { bar: MatrixBar }) {
  const t = useTheme();
  const left = bar.startCol * DAY_COL + 2;
  const width = (bar.endCol - bar.startCol + 1) * DAY_COL - 4;
  return (
    <View
      style={{
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
      }}
    >
      <Txt
        v="xs"
        numberOfLines={1}
        color={bar.text}
        style={{ fontFamily: t.type.semibold.fontFamily, fontSize: 11 }}
      >
        {bar.label}
      </Txt>
    </View>
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
}: {
  month: MonthKey;
  availByIso: Map<string, DayAvailability>;
  reservations: Reservation[];
  currency: string | null;
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
}: {
  cells: GridCell[];
  segments: BarSegment[];
  currency: string | null;
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
        const leftPct = (s.startCol / 7) * 100;
        const widthPct = ((s.endCol - s.startCol + 1) / 7) * 100;
        return (
          <View
            key={`${s.reservationId}-${i}`}
            style={{
              position: "absolute",
              top: BAR_TOP + s.lane * (BAR_HEIGHT + BAR_GAP),
              left: `${leftPct}%`,
              width: `${widthPct}%`,
              height: BAR_HEIGHT,
              paddingHorizontal: 3,
            }}
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
          </View>
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

function Legend() {
  const items: { label: string; color: string }[] = [
    { label: "Direkt", color: "#2F6F4F" },
    { label: "myNextDays", color: "#8A5CF6" },
    { label: "Booking", color: "#1B4E9B" },
    { label: "Airbnb", color: "#E24E5B" },
    { label: "Vrbo", color: "#2E7DB5" },
  ];
  return (
    <Row style={{ flexWrap: "wrap", justifyContent: "center", gap: 14, paddingTop: 4 }}>
      {items.map((it) => (
        <Row key={it.label} gap={6}>
          <View style={{ width: 12, height: 12, borderRadius: 4, backgroundColor: it.color }} />
          <Txt v="xs" soft>{it.label}</Txt>
        </Row>
      ))}
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
