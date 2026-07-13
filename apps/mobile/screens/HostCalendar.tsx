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
import { Card, Col, IconBtn, Photo, Row, Spinner, Txt } from "@/components/ui/kit";
import { getBoard, type DayAvailability } from "@/lib/calendar";
import {
  buildBarSegments,
  buildMonthCells,
  isoLocal,
  monthLabel,
  type BarSegment,
  type GridCell,
} from "@/lib/calendar-grid";
import { currencySymbol, formatCurrency } from "@/lib/currency";
import { listProperties, propertyTypeLabel, type Property } from "@/lib/properties";
import { useRealtime } from "@/lib/realtime";
import { listReservations, type Reservation } from "@/lib/reservations";
import { useTheme } from "@/theme/ThemeProvider";

const WEEKDAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
// Wie viele Monate ab dem aktuellen untereinander gezeigt werden.
const MONTHS_AHEAD = 4;

type MonthKey = { year: number; month0: number };

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

  const [avail, setAvail] = useState<DayAvailability[]>([]);
  const [currency, setCurrency] = useState<string | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(false);
  const [dataErr, setDataErr] = useState<string | null>(null);

  // Sichtbare Monate ab dem aktuellen (real: heutiger Monat, kein Hardcode).
  const months = useMemo<MonthKey[]>(() => {
    const now = new Date();
    const list: MonthKey[] = [];
    for (let i = 0; i < MONTHS_AHEAD; i += 1) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      list.push({ year: d.getFullYear(), month0: d.getMonth() });
    }
    return list;
  }, []);

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
    load();
  }, [load]);

  // Realtime: Belegung (availability) und Buchungen (reservations) — bei jeder
  // Änderung neu laden (debounced), kein manuelles Reload nach eigenen Aktionen
  // durch fremde/OTA-Änderungen. Server-Filter auf das gewählte Objekt.
  const propFilter = selectedId ? `property_id=eq.${selectedId}` : undefined;
  useRealtime({ table: "reservations", filter: propFilter, onChange: load, enabled: !!selectedId });
  useRealtime({ table: "availability", filter: propFilter, onChange: load, enabled: !!selectedId });

  const availByIso = useMemo(() => {
    const m = new Map<string, DayAvailability>();
    for (const d of avail) m.set(d.date, d);
    return m;
  }, [avail]);

  const selectedProp = props?.find((p) => p.id === selectedId);

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}>
      <Col style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12, gap: 14 }}>
        <Row style={{ justifyContent: "space-between" }}>
          <Txt v="h1">Kalender</Txt>
          {loading ? <Spinner /> : <IconBtn icon="list" flat />}
        </Row>

        {/* Objekt-Auswahl (Dropdown wie im Mockup) */}
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
      </Col>

      {propErr ? (
        <StateBox tone="err">Objekte konnten nicht geladen werden: {propErr}</StateBox>
      ) : dataErr ? (
        <StateBox tone="err">Kalender konnte nicht geladen werden: {dataErr}</StateBox>
      ) : props && props.length === 0 ? (
        <StateBox tone="empty">Noch keine Objekte angelegt.</StateBox>
      ) : !selectedId ? (
        <StateBox tone="empty">Objekt auswählen, um den Kalender zu sehen.</StateBox>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 32, gap: 28 }}
          showsVerticalScrollIndicator={false}
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
