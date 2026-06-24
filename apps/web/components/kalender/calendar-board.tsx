"use client";

// Lodgify-artiges Kalender-Raster (Timeline): rollierend ab HEUTE, links
// Objektzeilen (Foto/Name/Adresse), rechts scrollende Tagespalten mit
// Wochentag+Datum. Zellen zeigen Gäste + Preis-Platzhalter; belegte/gesperrte
// Zeiträume als Balken. Scrollt INNERHALB des Containers (kein Seiten-Overflow).
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  type ViewOptions,
  CalendarHeader,
  DEFAULT_VIEW,
} from "@/components/kalender/calendar-header";
import { CalendarActionMenu } from "@/components/kalender/calendar-action-menu";
import { BulkEditDialog } from "@/components/kalender/bulk-edit-dialog";
import { ReservationDetailSlider } from "@/components/kalender/reservation-detail-slider";
import { PropertyLabel } from "@/components/kalender/property-label";
import { ReservationWizard } from "@/components/kalender/reservation-wizard";
import {
  type AvailabilitySource,
  type AvailabilityStatus,
  type DayAvailability,
  blockRange,
  getAvailability,
} from "@/lib/calendar";
import { CHANNEL_META, CHANNEL_SOURCES, channelMeta } from "@/lib/calendar-channels";
import {
  type DisplayStatus,
  STATUS_META,
  reservationStatus,
} from "@/lib/calendar-status";
import type { PropertyType } from "@/lib/properties";
import { TYPE_LABELS } from "@/lib/property-meta";
import { Input } from "@/components/ui/input";
import {
  type Reservation,
  listReservations,
  moveReservation,
} from "@/lib/reservations";
import { toast } from "sonner";
import { useRealtime } from "@/lib/use-realtime";

type Prop = {
  id: string;
  title: string;
  type: PropertyType;
  photo: string | null;
  address: string;
  city: string;
  maxGuests: number;
};

const WEEKDAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const MONTHS = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

const COL = 5.5; // rem pro Tagesspalte (breit wie Lodgify)
const LABEL = 17; // rem für die Objektspalte
const ROW_H = 5.5; // rem Zeilenhöhe

const SEG_STYLE: Record<AvailabilityStatus, string> = {
  open: "",
  booked: "bg-accent/85 text-white",
  blocked: "bg-neutral-700 text-white",
};
const STATUS_LABEL: Record<AvailabilityStatus, string> = {
  open: "Frei",
  booked: "Gebucht",
  blocked: "Gesperrt",
};

function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}
function key(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
// Aus einem laufenden Bar-Drag den Ziel-Zeitraum (YYYY-MM-DD, end exklusiv)
// ableiten. Verschieben/Resize verändern check_in/out gemäß mode + dayOffset;
// min. 1 Nacht bleibt erhalten.
function barDragTarget(d: BarDrag): { ci: string; co: string; pid: string } {
  const ci0 = new Date(`${d.res.check_in}T00:00:00`);
  const co0 = new Date(`${d.res.check_out}T00:00:00`);
  if (d.mode === "move") {
    return {
      ci: key(addDays(ci0, d.dayOffset)),
      co: key(addDays(co0, d.dayOffset)),
      pid: d.targetPid,
    };
  }
  if (d.mode === "start") {
    // Check-in verschieben, aber nie auf/über Check-out.
    let ci = addDays(ci0, d.dayOffset);
    const lastNight = addDays(co0, -1);
    if (ci > lastNight) ci = lastNight;
    return { ci: key(ci), co: key(co0), pid: d.res.property_id };
  }
  // "end": Check-out verschieben, aber nie auf/vor Check-in (min. 1 Nacht).
  let co = addDays(co0, d.dayOffset);
  const firstCheckout = addDays(ci0, 1);
  if (co < firstCheckout) co = firstCheckout;
  return { ci: key(ci0), co: key(co), pid: d.res.property_id };
}

// Kompakter Tagespreis fürs Raster. null (kein Rate-Plan) → „–" statt erfundener 0.
function fmtPrice(price: number | null | undefined): string {
  if (price == null) return "–";
  return price.toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

// Deutsche Labels für die Dynamic-Pricing-Faktoren („Warum dieser Preis?").
const FACTOR_LABELS: Record<string, string> = {
  season: "Saison",
  event: "Event",
  weekend: "Wochenende",
  occupancy: "Auslastung",
  last_minute: "Last-Minute",
  orphan: "Lückenfüllung",
  market: "Markt",
};

// factors (Multiplikatoren, 1.0 = neutral) → lesbare Erklärzeilen mit %-Beitrag.
// Nur Faktoren ≠ neutral werden gezeigt; leere Erklärung, wenn alles neutral.
function explainFactors(factors: Record<string, number> | undefined): string {
  if (!factors) return "";
  const lines: string[] = [];
  for (const [key, mult] of Object.entries(factors)) {
    if (mult == null || Math.abs(mult - 1) < 0.001) continue;
    const pct = Math.round((mult - 1) * 100);
    const label = FACTOR_LABELS[key] ?? key;
    lines.push(`${label} ${pct >= 0 ? "+" : ""}${pct} %`);
  }
  return lines.length ? `Warum dieser Preis?\n${lines.join("\n")}` : "";
}

type Segment = {
  start: number;
  span: number;
  status: AvailabilityStatus;
  source: AvailabilitySource;
  reservation?: Reservation; // verknüpfte Buchung (falls gefunden)
};

// Laufendes Verschieben/Resizen eines bestehenden Buchungsbalkens.
// mode: "move" = ganzer Balken (Tag- + Objektwechsel), "start"/"end" = Kante.
type BarDrag = {
  res: Reservation;
  mode: "move" | "start" | "end";
  startPid: string; // Objekt, in dem der Zug begann
  startDi: number; // Tag-Index unter dem Cursor beim Drücken
  dayOffset: number; // Verschiebung in Tagen (move/Kante)
  targetPid: string; // aktuelles Ziel-Objekt (nur move)
};

// Herkunftslabel (zentral): echter OTA/Direkt-Kanal aus CHANNEL_META.
function sourceLabel(source: AvailabilitySource): string {
  return channelMeta(source).label;
}

// Kanal-Logo eines Balkens (Iconify-Brand-Icon ODER lokales SVG).
function ChannelLogo({
  source,
  className = "size-3",
}: {
  source: AvailabilitySource;
  className?: string;
}) {
  const logo = channelMeta(source).logo;
  if (logo.kind === "img") {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={logo.src}
        alt={channelMeta(source).label}
        className={`${className} shrink-0 rounded-[0.125rem]`}
      />
    );
  }
  return <Icon icon={logo.icon} className={`${className} shrink-0`} />;
}

// Aufeinanderfolgende Tage gleichen (nicht-offenen) Status+Quelle bündeln.
// resByDay ordnet jedem belegten Tag die zugehörige Buchung zu (für Gastname +
// Detail-Popover); ein Segmentwechsel erfolgt auch bei einem Buchungswechsel.
function toSegments(
  statusByDay: Record<string, AvailabilityStatus>,
  sourceByDay: Record<string, AvailabilitySource>,
  resByDay: Record<string, Reservation>,
  dates: Date[],
): Segment[] {
  const segs: Segment[] = [];
  let cur: Segment | null = null;
  dates.forEach((d, i) => {
    const s = statusByDay[key(d)] ?? "open";
    const src = sourceByDay[key(d)] ?? "manual";
    const res = resByDay[key(d)];
    if (s === "open") {
      cur = null;
      return;
    }
    if (
      cur &&
      cur.status === s &&
      cur.source === src &&
      cur.reservation?.id === res?.id &&
      cur.start + cur.span === i
    ) {
      cur.span += 1;
    } else {
      cur = { start: i, span: 1, status: s, source: src, reservation: res };
      segs.push(cur);
    }
  });
  return segs;
}

// Buchungen eines Objekts auf Tages-Keys abbilden: jeder Übernachtungstag
// [check_in, check_out) → Reservierung. So findet ein belegtes Segment seinen Gast.
function reservationsByDay(reservations: Reservation[]): Record<string, Reservation> {
  const map: Record<string, Reservation> = {};
  for (const r of reservations) {
    if (r.status === "cancelled") continue;
    const ci = new Date(`${r.check_in}T00:00:00`);
    const co = new Date(`${r.check_out}T00:00:00`);
    for (let d = new Date(ci); d < co; d = addDays(d, 1)) {
      map[key(d)] = r;
    }
  }
  return map;
}

// Menschliches Herkunfts-/Gastlabel für einen Buchungsbalken.
function segmentLabel(seg: Segment): string {
  if (seg.status !== "booked") return STATUS_LABEL[seg.status];
  const guest = seg.reservation?.guest_name?.trim();
  return guest || seg.reservation?.ota_name || sourceLabel(seg.source);
}

export function CalendarBoard({ properties }: { properties: Prop[] }) {
  // Startdatum (rollierend). null bis der Client das heutige Datum kennt.
  const [start, setStart] = useState<Date | null>(null);
  const [todayKey, setTodayKey] = useState("");
  const [avail, setAvail] = useState<Record<string, Record<string, AvailabilityStatus>>>({});
  const [sources, setSources] = useState<Record<string, Record<string, AvailabilitySource>>>({});
  // Tagespreis + Min-Stay je Objekt/Tag (aus get_availability) für die Anzeige.
  const [prices, setPrices] = useState<Record<string, Record<string, number | null>>>({});
  const [priceSources, setPriceSources] = useState<Record<string, Record<string, string>>>({});
  const [priceFactors, setPriceFactors] = useState<Record<string, Record<string, Record<string, number>>>>({});
  const [minStays, setMinStays] = useState<Record<string, Record<string, number | null>>>({});
  // Buchungen je Objekt → Tages-Map (Gastname im Balken + Detail-Popover).
  const [resByProp, setResByProp] = useState<Record<string, Record<string, Reservation>>>({});
  // Aktuell geöffnetes Buchungsdetail (per Klick auf einen Balken).
  // Geöffnetes Buchungsdetail: nur die Reservierungs-ID (Slider lädt die Daten).
  const [detail, setDetail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<ViewOptions>(DEFAULT_VIEW);
  // Filter & Suche (Paket 4b). Leerer Filter = alles sichtbar.
  const [query, setQuery] = useState("");
  const [channelFilter, setChannelFilter] = useState<AvailabilitySource | "all">("all");
  const [statusFilter, setStatusFilter] = useState<DisplayStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<PropertyType | "all">("all");

  // Interaktion wie Lodgify: Anfangstag drücken → bis Endtag ziehen → loslassen.
  // `drag` ist nur die Vorschau WÄHREND des Ziehens; `sel` wird ERST beim
  // Loslassen gesetzt und löst dann die Bestätigungsleiste aus.
  const [drag, setDrag] = useState<{ pid: string; from: number; to: number } | null>(null);
  const [sel, setSel] = useState<{ pid: string; from: number; to: number } | null>(null);
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null);
  // Reservierungs-Assistent: Zeitraum (YYYY-MM-DD) + Objekt, wenn offen.
  const [wizard, setWizard] = useState<{ pid: string; checkIn: string; checkOut: string } | null>(null);
  // Bulk-Edit-Dialog: Objekt + Zeitraum der aufgezogenen Selektion.
  const [bulk, setBulk] = useState<{ pid: string; checkIn: string; checkOut: string } | null>(null);
  const [saving, setSaving] = useState(false);

  // Balken-Interaktion: bestehende Buchung verschieben (move) ODER an den
  // Kanten resizen (Check-in/out). `barDrag` hält den laufenden Zug; `dayOffset`
  // bzw. `rowOffset` werden während der Mausbewegung über den Listener gesetzt.
  const [barDrag, setBarDrag] = useState<BarDrag | null>(null);
  const barDragRef = useRef<BarDrag | null>(null);
  barDragRef.current = barDrag;
  // Maus-Startposition beim Balken-mousedown + ob seither nennenswert bewegt
  // wurde. So unterscheiden wir einen reinen KLICK (→ Detail-Slider öffnen) von
  // einem echten DRAG (→ verschieben/resizen). Ohne das schluckt der sofort
  // gesetzte barDrag den onClick und der Slider ging nie auf.
  const barDownPos = useRef<{ x: number; y: number } | null>(null);
  const barMoved = useRef(false);
  // Ref auf den Tagesbereich (Zeilen-Container) für die Geometrie-Berechnung
  // beim Ziehen — robuster als onMouseEnter (unabhängig von überdeckenden Balken).
  const gridRef = useRef<HTMLDivElement | null>(null);

  // Ausstehende Verschiebung/Resize, die der Nutzer ERST bestätigen muss
  // (Schutz vor versehentlichem Verschieben per Drag).
  const [pendingMove, setPendingMove] = useState<{
    res: Reservation;
    mode: BarDrag["mode"];
    targetPid: string;
    ci: string;
    co: string;
  } | null>(null);

  // Drag-Ende: keine echte Änderung → verwerfen; sonst Bestätigung anfordern.
  const commitBarDrag = useCallback(
    (d: BarDrag, targetPid: string, ci: string, co: string) => {
      if (targetPid === d.res.property_id && ci === d.res.check_in && co === d.res.check_out) {
        return;
      }
      setPendingMove({ res: d.res, mode: d.mode, targetPid, ci, co });
    },
    [],
  );

  // Bestätigte Verschiebung an den Server schicken (optimistisch mit Rollback
  // über Neuladen). Konflikt (409) wird klar zurückgemeldet.
  const confirmMove = useCallback(async () => {
    const m = pendingMove;
    if (!m) return;
    setPendingMove(null);
    setSaving(true);
    const res = await moveReservation(m.res.id, m.targetPid, m.ci, m.co);
    setSaving(false);
    if (res.ok) {
      toast.success("Reservierung verschoben.");
    } else {
      toast.error(res.error || "Verschieben nicht möglich.");
    }
    await load();
  }, [pendingMove]);

  // Hervorhebung: während des Ziehens die Vorschau, sonst die fertige Auswahl.
  const isSelected = useCallback(
    (pid: string, di: number) => {
      const active = drag ?? sel;
      if (!active || active.pid !== pid) return false;
      const lo = Math.min(active.from, active.to);
      const hi = Math.max(active.from, active.to);
      return di >= lo && di <= hi;
    },
    [drag, sel],
  );

  const onCellDown = useCallback((pid: string, di: number) => {
    // Neuer Zug startet: alte Auswahl/Leiste verwerfen.
    setSel(null);
    setDrag({ pid, from: di, to: di });
  }, []);

  const onCellEnter = useCallback(
    (pid: string, di: number) => {
      // Während eines Balken-Zugs: Offset + Ziel-Objekt aus der überfahrenen
      // Zelle ableiten (Move folgt dem Objekt, Resize bleibt im selben Objekt).
      setBarDrag((cur) => {
        if (!cur) return cur;
        const dayOffset = di - cur.startDi;
        return {
          ...cur,
          dayOffset,
          targetPid: cur.mode === "move" ? pid : cur.res.property_id,
        };
      });
      setDrag((cur) => (cur && cur.pid === pid ? { ...cur, to: di } : cur));
    },
    [],
  );

  // Balken-Zug starten (auf einem belegten Buchungsbalken). mode unterscheidet
  // Verschieben vs. Resizen an den Kanten. di = Tag-Index unter dem Cursor.
  const onBarDown = useCallback(
    (
      res: Reservation,
      pid: string,
      di: number,
      mode: BarDrag["mode"],
      ev: React.MouseEvent,
    ) => {
      setSel(null);
      setDrag(null);
      // Klick-vs-Drag-Erkennung: Startposition merken, "bewegt" zurücksetzen.
      barDownPos.current = { x: ev.clientX, y: ev.clientY };
      barMoved.current = false;
      setBarDrag({
        res,
        mode,
        startPid: pid,
        startDi: di,
        dayOffset: 0,
        targetPid: pid,
      });
    },
    [],
  );

  // Während eines Balken-Zugs die Mausposition global tracken und daraus —
  // rein geometrisch — Tag-Spalte + Ziel-Objektzeile bestimmen. Robuster als
  // onMouseEnter der Zellen (das von überdeckenden Balken verschluckt würde).
  const shownRef = useRef<Prop[]>([]);
  useEffect(() => {
    if (!barDrag) return;
    const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const colPx = COL * remPx;
    const rowPx = ROW_H * remPx;
    const onMove = (e: MouseEvent) => {
      const grid = gridRef.current;
      const bd = barDragRef.current;
      if (!grid || !bd) return;
      // Ab ~4px Bewegung gilt es als echtes Ziehen (nicht mehr als Klick).
      const down = barDownPos.current;
      if (down && (Math.abs(e.clientX - down.x) > 4 || Math.abs(e.clientY - down.y) > 4)) {
        barMoved.current = true;
      }
      const rect = grid.getBoundingClientRect();
      // Jede Zeile beginnt mit der (sticky) LABEL-Spalte → diese Breite abziehen.
      const di = Math.floor((e.clientX - rect.left - LABEL * remPx) / colPx);
      const rows = shownRef.current;
      const rowIdx = Math.min(
        rows.length - 1,
        Math.max(0, Math.floor((e.clientY - rect.top) / rowPx)),
      );
      const overPid = rows[rowIdx]?.id ?? bd.startPid;
      setBarDrag((cur) =>
        cur
          ? {
              ...cur,
              dayOffset: di - cur.startDi,
              targetPid: cur.mode === "move" ? overPid : cur.res.property_id,
            }
          : cur,
      );
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [barDrag]);

  // Maus loslassen beendet das Ziehen. Ein laufender BALKEN-Zug (move/resize)
  // hat Vorrang und wird an den Server geschickt; sonst Vorschau→Auswahl und
  // das Aktionsmenü am Cursor (Block/Reservierung).
  useEffect(() => {
    const up = (e: MouseEvent) => {
      const bd = barDragRef.current;
      if (bd) {
        setBarDrag(null);
        // Reiner Klick (keine nennenswerte Bewegung) → Buchungsdetail öffnen,
        // NICHT als Null-Verschiebung an den Server schicken.
        if (!barMoved.current) {
          barDownPos.current = null;
          setDetail(bd.res.id);
          return;
        }
        barDownPos.current = null;
        const { ci, co, pid } = barDragTarget(bd);
        void commitBarDrag(bd, pid, ci, co);
        return;
      }
      setDrag((cur) => {
        if (cur) {
          setSel(cur);
          setMenuAt({ x: e.clientX, y: e.clientY });
        }
        return null;
      });
    };
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, [commitBarDrag]);

  useEffect(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    setStart(now);
    setTodayKey(key(now));
  }, []);

  const range = view.rangeDays;
  const dates = useMemo(
    () => (start ? Array.from({ length: range }, (_, i) => addDays(start, i)) : []),
    [start, range],
  );

  // Objekt-Filter: Freitext (Titel/Adresse/Stadt/Gastname) + Objekttyp. Ein
  // Objekt bleibt sichtbar, wenn es selbst passt ODER eine seiner Buchungen
  // den Suchtext im Gastnamen trägt.
  const q = query.trim().toLowerCase();
  const shown = useMemo(() => {
    return properties.filter((p) => {
      if (typeFilter !== "all" && p.type !== typeFilter) return false;
      if (!q) return true;
      const inProp =
        p.title.toLowerCase().includes(q) ||
        p.address.toLowerCase().includes(q) ||
        p.city.toLowerCase().includes(q);
      if (inProp) return true;
      const guests = Object.values(resByProp[p.id] ?? {});
      return guests.some((r) => r.guest_name?.toLowerCase().includes(q));
    });
  }, [properties, typeFilter, q, resByProp]);
  // Aktuelle sichtbare Objektliste für den Drag-Geometrie-Effect bereitstellen.
  shownRef.current = shown;

  // Sichtbarkeit eines Segments unter Kanal-/Status-Filter (gefilterte Balken
  // werden gedimmt statt entfernt, damit Belegung erkennbar bleibt).
  const segMatchesFilters = useCallback(
    (seg: Segment): boolean => {
      if (channelFilter !== "all" && seg.source !== channelFilter) return false;
      if (statusFilter !== "all") {
        if (!seg.reservation) return false;
        if (reservationStatus(seg.reservation, todayKey) !== statusFilter) return false;
      }
      return true;
    },
    [channelFilter, statusFilter, todayKey],
  );
  const filtersActive = channelFilter !== "all" || statusFilter !== "all";

  // Kennzahlenleiste (sichtbarer Zeitraum × sichtbare Objekte):
  //  - Belegung %: gebuchte Objekt-Tage / (Objekte × Tage)
  //  - Umsatz/ADR: nur aus Buchungen mit sichtbarem Betrag (maskierungskonform;
  //    total_amount === null = keine Berechtigung → fließt NICHT ein)
  const metrics = useMemo(() => {
    if (!start || shown.length === 0 || dates.length === 0) {
      return { occupancy: 0, bookedNights: 0, totalNights: 0, revenue: 0, adr: null as number | null, amountsHidden: false };
    }
    const dayKeys = dates.map((d) => key(d));
    let bookedNights = 0;
    for (const p of shown) {
      const statusMap = avail[p.id] ?? {};
      for (const dk of dayKeys) if (statusMap[dk] === "booked") bookedNights += 1;
    }
    const totalNights = shown.length * dates.length;

    // Umsatz: Buchungen der sichtbaren Objekte, deren Nächte in den sichtbaren
    // Zeitraum fallen — anteilig (Nacht-Anteil im Fenster / Gesamtnächte).
    const winStart = dayKeys[0];
    const winEnd = key(addDays(start, dates.length)); // exklusiv
    const seen = new Set<string>();
    let revenue = 0;
    let revenueNights = 0;
    let amountsHidden = false;
    for (const p of shown) {
      for (const r of Object.values(resByProp[p.id] ?? {})) {
        if (seen.has(r.id) || r.status === "cancelled") continue;
        seen.add(r.id);
        if (r.total_amount == null) {
          amountsHidden = true;
          continue;
        }
        const ci = r.check_in < winStart ? winStart : r.check_in;
        const co = r.check_out > winEnd ? winEnd : r.check_out;
        const nightsInWin = Math.max(
          0,
          Math.round((new Date(`${co}T00:00:00`).getTime() - new Date(`${ci}T00:00:00`).getTime()) / 86400000),
        );
        const totalResNights = Math.max(
          1,
          Math.round((new Date(`${r.check_out}T00:00:00`).getTime() - new Date(`${r.check_in}T00:00:00`).getTime()) / 86400000),
        );
        revenue += (r.total_amount * nightsInWin) / totalResNights;
        revenueNights += nightsInWin;
      }
    }
    return {
      occupancy: totalNights ? bookedNights / totalNights : 0,
      bookedNights,
      totalNights,
      revenue,
      adr: revenueNights > 0 ? revenue / revenueNights : null,
      amountsHidden,
    };
  }, [start, shown, dates, avail, resByProp]);

  const load = useCallback(async () => {
    if (!start || properties.length === 0) return;
    setLoading(true);
    const s = key(start);
    const e = key(addDays(start, range));
    const [results, resAll] = await Promise.all([
      Promise.all(
        properties.map(async (p) => {
          const res = await getAvailability(p.id, s, e);
          const map: Record<string, AvailabilityStatus> = {};
          const srcMap: Record<string, AvailabilitySource> = {};
          const priceMap: Record<string, number | null> = {};
          const priceSrcMap: Record<string, string> = {};
          const factorsMap: Record<string, Record<string, number>> = {};
          const minStayMap: Record<string, number | null> = {};
          if (res.ok)
            for (const d of res.data as DayAvailability[]) {
              map[d.date] = d.status;
              srcMap[d.date] = d.source;
              priceMap[d.date] = d.price;
              priceSrcMap[d.date] = d.price_source ?? "none";
              if (d.price_factors) factorsMap[d.date] = d.price_factors;
              minStayMap[d.date] = d.min_stay;
            }
          return [p.id, map, srcMap, priceMap, minStayMap, priceSrcMap, factorsMap] as const;
        }),
      ),
      // Alle Buchungen (OTA + direkt, vereint aus reservations) in einem Call.
      listReservations(),
    ]);
    setAvail(Object.fromEntries(results.map((r) => [r[0], r[1]])));
    setSources(Object.fromEntries(results.map((r) => [r[0], r[2]])));
    setPrices(Object.fromEntries(results.map((r) => [r[0], r[3]])));
    setMinStays(Object.fromEntries(results.map((r) => [r[0], r[4]])));
    setPriceFactors(Object.fromEntries(results.map((r) => [r[0], r[6]])));
    setPriceSources(Object.fromEntries(results.map((r) => [r[0], r[5]])));
    // Buchungen je Objekt gruppieren und auf Tages-Maps abbilden.
    const byProp: Record<string, Reservation[]> = {};
    if (resAll.ok)
      for (const r of resAll.data.items) {
        (byProp[r.property_id] ??= []).push(r);
      }
    setResByProp(
      Object.fromEntries(
        Object.entries(byProp).map(([pid, list]) => [pid, reservationsByDay(list)]),
      ),
    );
    setLoading(false);
  }, [start, properties, range]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime: Kalender live aktualisieren, sobald sich Buchungen, Belegung,
  // Preise oder Verkaufsstopps ändern (eigene Aktionen, andere Nutzer oder
  // OTA-Importe). RLS liefert nur Tenant-Zeilen. Während eines aktiven Zugs
  // (Drag/Resize/Selektion) pausieren wir, damit kein Reload die Interaktion
  // unterbricht.
  const interacting = !!barDrag || !!drag || !!sel;
  useRealtime({ table: "reservations", onChange: load, enabled: !interacting });
  useRealtime({ table: "availability", onChange: load, enabled: !interacting });
  useRealtime({ table: "price_overrides", onChange: load, enabled: !interacting });
  useRealtime({ table: "stop_sell", onChange: load, enabled: !interacting });
  // Preisänderungen live: Basispreis (rate_plans) + Pricing-Konfig
  // (property_pricing_config) fließen über den Resolver in die Tagespreise →
  // im Objekt geänderte Preise erscheinen sofort im Kalender (kein Reload).
  useRealtime({ table: "rate_plans", onChange: load, enabled: !interacting });
  useRealtime({ table: "property_pricing_config", onChange: load, enabled: !interacting });

  // Ausgewählten Zeitraum sperren (blockRange, end exklusiv).
  const confirmBlock = useCallback(async () => {
    if (!sel || !start) return;
    const lo = Math.min(sel.from, sel.to);
    const hi = Math.max(sel.from, sel.to);
    const s = key(addDays(start, lo));
    const e = key(addDays(start, hi + 1)); // end exklusiv
    setSaving(true);
    const res = await blockRange(sel.pid, s, e);
    setSaving(false);
    if (res.ok) {
      setSel(null);
      setMenuAt(null);
      await load();
    }
  }, [sel, start, load]);

  function shift(deltaDays: number) {
    setStart((cur) => (cur ? addDays(cur, deltaDays) : cur));
  }
  function goToday() {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    setStart(now);
  }
  // Auf ein gewähltes Datum springen (Date-Picker im Kopf).
  function jumpTo(isoDate: string) {
    const d = new Date(`${isoDate}T00:00:00`);
    if (!Number.isNaN(d.getTime())) setStart(d);
  }

  if (properties.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <h2 className="font-display text-2xl font-extrabold">Kalender</h2>
        <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-secondary">
            <Icon icon="ph:calendar-blank" className="size-7 text-muted-foreground" />
          </span>
          <p className="font-display text-lg font-extrabold">Noch keine Objekte</p>
          <p className="text-sm text-muted-foreground">
            Lege zuerst ein Objekt an, dann erscheint hier der Kalender.
          </p>
          <Button asChild>
            <Link href="/objekte">Zu den Objekten</Link>
          </Button>
        </Card>
      </div>
    );
  }

  const titleMonth = start ? MONTHS[start.getMonth()] : "";
  const titleYear = start ? `${start.getFullYear()}` : "";

  // „Erstellen"-Menü im Kopf: Sperren geschieht im Raster per Ziehen;
  // „Reservierung" öffnet den Assistenten mit dem ersten Objekt ab morgen.
  function onCreate(kind: "booking" | "blocked") {
    if (kind === "booking" && start && properties[0]) {
      setWizard({
        pid: properties[0].id,
        checkIn: key(addDays(start, 1)),
        checkOut: key(addDays(start, 3)),
      });
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {/* Kopfbereich (eigenes Element, wie Lodgify) */}
      <CalendarHeader
        title={{ month: titleMonth, year: titleYear }}
        view={view}
        onView={setView}
        onPrev={() => shift(-range)}
        onNext={() => shift(range)}
        onToday={goToday}
        onJump={jumpTo}
        jumpValue={start ? key(start) : ""}
        onCreate={onCreate}
      />

      {/* Filter & Suche (Objekt/Typ/Kanal/Status/Gastname) */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Icon
            icon="ph:magnifying-glass"
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Objekt oder Gast suchen…"
            className="h-9 w-56 rounded-full pl-9"
            aria-label="Suche"
          />
        </div>
        <FilterSelect
          value={typeFilter}
          onChange={(v) => setTypeFilter(v as PropertyType | "all")}
          allLabel="Alle Typen"
          options={Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label }))}
        />
        <FilterSelect
          value={channelFilter}
          onChange={(v) => setChannelFilter(v as AvailabilitySource | "all")}
          allLabel="Alle Kanäle"
          options={CHANNEL_SOURCES.map((s) => ({ value: s, label: CHANNEL_META[s].label }))}
        />
        <FilterSelect
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as DisplayStatus | "all")}
          allLabel="Alle Status"
          options={(["confirmed", "pending", "in_house", "completed", "cancelled"] as const).map(
            (s) => ({ value: s, label: STATUS_META[s].label }),
          )}
        />
        {(query || typeFilter !== "all" || channelFilter !== "all" || statusFilter !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQuery("");
              setTypeFilter("all");
              setChannelFilter("all");
              setStatusFilter("all");
            }}
          >
            <Icon icon="ph:x" className="size-3.5" /> Zurücksetzen
          </Button>
        )}
      </div>

      {/* Legende: Status + Vertriebskanäle (Herkunft je Farbe/Logo). */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        {(["open", "blocked"] as AvailabilityStatus[]).map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className={`inline-block size-3 rounded-sm border ${s === "open" ? "bg-background" : SEG_STYLE[s]}`} />
            {STATUS_LABEL[s]}
          </span>
        ))}
        <span className="h-3 w-px bg-border" aria-hidden />
        {CHANNEL_SOURCES.map((src) => (
          <span key={src} className="flex items-center gap-1.5">
            <span
              className={`inline-flex size-4 items-center justify-center rounded-sm text-white ${CHANNEL_META[src].dotBg}`}
            >
              <ChannelLogo source={src} className="size-2.5" />
            </span>
            {CHANNEL_META[src].label}
          </span>
        ))}
        <span className="h-3 w-px bg-border" aria-hidden />
        {(["confirmed", "pending", "in_house", "completed", "cancelled"] as const).map(
          (s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className={`size-2 rounded-full ${STATUS_META[s].dotBg}`} />
              {STATUS_META[s].label}
            </span>
          ),
        )}
        {loading && <span>· lädt …</span>}
      </div>

      {/* Aktionsmenü am Cursor nach dem Ziehen (eigene Komponente, wie Lodgify) */}
      {sel && menuAt && start && (
        <CalendarActionMenu
          at={menuAt}
          rangeLabel={(() => {
            const lo = Math.min(sel.from, sel.to);
            const hi = Math.max(sel.from, sel.to);
            const f = addDays(start, lo);
            const t = addDays(start, hi);
            const fmt = (d: Date) => `${d.getDate()}.${d.getMonth() + 1}.`;
            const n = hi - lo + 1;
            return `${fmt(f)} – ${fmt(t)} · ${n} Tag${n > 1 ? "e" : ""}`;
          })()}
          saving={saving}
          onAction={(action) => {
            if (action === "closed") {
              confirmBlock();
              return;
            }
            const lo = Math.min(sel.from, sel.to);
            const hi = Math.max(sel.from, sel.to);
            const checkIn = key(addDays(start, lo));
            const checkOut = key(addDays(start, hi + 1)); // end exklusiv
            if (action === "bulk") {
              setBulk({ pid: sel.pid, checkIn, checkOut });
            } else {
              // Reservierung: Wizard mit gezogenem Zeitraum öffnen.
              setWizard({ pid: sel.pid, checkIn, checkOut });
            }
            setMenuAt(null);
            setSel(null);
          }}
          onClose={() => {
            setMenuAt(null);
            setSel(null);
          }}
        />
      )}

      {/* Kennzahlenleiste (sichtbarer Zeitraum): Auslastung, ADR, Umsatz.
          Beträge nur, wenn der Nutzer sie sehen darf (sonst Hinweis). */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-(--radius) border bg-secondary/40 px-4 py-2.5 text-sm">
        <Metric
          icon="ph:chart-pie-slice"
          label="Auslastung"
          value={`${Math.round(metrics.occupancy * 100)} %`}
          hint={`${metrics.bookedNights}/${metrics.totalNights} Objekt-Nächte`}
        />
        <Metric
          icon="ph:currency-eur"
          label="Umsatz"
          value={
            metrics.amountsHidden && metrics.revenue === 0
              ? "—"
              : metrics.revenue.toLocaleString("de-DE", {
                  style: "currency",
                  currency: "EUR",
                  maximumFractionDigits: 0,
                })
          }
          hint={metrics.amountsHidden ? "ohne gesperrte Beträge" : "im Zeitraum"}
        />
        <Metric
          icon="ph:bed"
          label="ADR"
          value={
            metrics.adr == null
              ? "—"
              : metrics.adr.toLocaleString("de-DE", {
                  style: "currency",
                  currency: "EUR",
                  maximumFractionDigits: 0,
                })
          }
          hint="Ø Nachtpreis"
        />
      </div>

      {/* Raster — scrollt INNERHALB dieses Containers (min-w-0 begrenzt Breite) */}
      <Card className="min-w-0 overflow-hidden p-0">
        <div className="overflow-x-auto">
          <div style={{ width: `${LABEL + dates.length * COL}rem` }}>
            {/* Tageskopf */}
            <div className="flex border-b">
              <div
                className="sticky left-0 z-20 flex shrink-0 items-center border-r bg-card px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                style={{ width: `${LABEL}rem` }}
              >
                Objekt
              </div>
              <div className="flex">
                {dates.map((d) => {
                  const wd = d.getDay();
                  const isToday = key(d) === todayKey;
                  return (
                    <div
                      key={key(d)}
                      className="flex shrink-0 flex-col items-center border-r py-2 text-sm"
                      style={{ width: `${COL}rem` }}
                    >
                      <span className="text-xs text-muted-foreground">{WEEKDAYS[wd]}</span>
                      <span className={`mt-1 flex size-8 items-center justify-center rounded-full text-base font-semibold ${isToday ? "bg-accent text-white" : ""}`}>
                        {d.getDate()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Objektzeilen */}
            <div ref={gridRef}>
            {shown.map((p) => {
              const statusMap = avail[p.id] ?? {};
              const sourceMap = sources[p.id] ?? {};
              const priceMap = prices[p.id] ?? {};
              const priceSrcMap = priceSources[p.id] ?? {};
              const factorsMap = priceFactors[p.id] ?? {};
              const minStayMap = minStays[p.id] ?? {};
              const resMap = resByProp[p.id] ?? {};
              const segs = toSegments(statusMap, sourceMap, resMap, dates);
              return (
                <div key={p.id} className="flex border-b last:border-b-0">
                  {/* Objektspalte (eigene Komponente, sticky links) */}
                  <PropertyLabel
                    p={p}
                    width={LABEL}
                    showPicture={view.showPicture}
                    showInternalName={view.showInternalName}
                    showId={view.showId}
                  />

                  {/* Tagesbereich */}
                  <div className="relative flex" style={{ width: `${dates.length * COL}rem`, height: `${ROW_H}rem` }}>
                    {/* Zellen mit Gäste + Preis-Platzhalter — klickbar (sperren/freigeben) */}
                    {dates.map((d, di) => {
                      const isToday = key(d) === todayKey;
                      const status = statusMap[key(d)] ?? "open";
                      const inSel = isSelected(p.id, di);
                      return (
                        <button
                          type="button"
                          key={key(d)}
                          onMouseDown={() => onCellDown(p.id, di)}
                          onMouseEnter={() => onCellEnter(p.id, di)}
                          className={`flex shrink-0 cursor-pointer flex-col items-center justify-center gap-0.5 border-r text-sm transition-colors ${
                            inSel
                              ? "bg-neutral-800 text-white"
                              : `hover:bg-accent/10 ${isToday ? "bg-accent/5" : ""}`
                          }`}
                          style={{ width: `${COL}rem`, height: `${ROW_H}rem` }}
                        >
                          {status === "open" && (
                            <>
                              <span className={`flex items-center gap-0.5 ${inSel ? "text-white" : "text-muted-foreground"}`}>
                                <Icon icon="ph:user" className="size-3.5" />
                                {p.maxGuests}
                              </span>
                              {view.showPrice && (
                                <span className={`flex items-center gap-1 ${inSel ? "text-white" : "text-muted-foreground"}`}>
                                  {fmtPrice(priceMap[key(d)])}
                                  {priceSrcMap[key(d)] === "dynamic" && (
                                    <span
                                      title={
                                        explainFactors(factorsMap[key(d)]) ||
                                        "Dynamischer Preis (automatisch berechnet)"
                                      }
                                      className={`cursor-help rounded px-1 text-[0.55rem] font-semibold leading-tight ${inSel ? "bg-white/25 text-white" : "bg-accent/15 text-accent"}`}
                                    >
                                      auto
                                    </span>
                                  )}
                                </span>
                              )}
                              {view.showMinStay && (
                                <span className={`flex items-center gap-0.5 text-[0.65rem] ${inSel ? "text-white/80" : "text-muted-foreground/70"}`}>
                                  <Icon icon="ph:moon" className="size-3" />
                                  {minStayMap[key(d)] != null ? `${minStayMap[key(d)]}` : "–"}
                                </span>
                              )}
                            </>
                          )}
                        </button>
                      );
                    })}

                    {/* Gestrichelter Rahmen um den ausgewählten Block (wie Lodgify) */}
                    {(() => {
                      const active = drag ?? sel;
                      if (!active || active.pid !== p.id) return null;
                      const lo = Math.min(active.from, active.to);
                      const hi = Math.max(active.from, active.to);
                      return (
                        <div
                          className="pointer-events-none absolute inset-y-0 border-2 border-dashed border-neutral-500"
                          style={{
                            left: `calc(${lo} * ${COL}rem)`,
                            width: `calc(${hi - lo + 1} * ${COL}rem)`,
                          }}
                        />
                      );
                    })()}

                    {/* Balken über belegte/gesperrte Zeiträume. Gebuchte Balken
                        zeigen den Gastnamen + Kanal-Icon und sind klickbar
                        (Detail-Popover). */}
                    {segs.map((seg, i) => {
                      const clickable = seg.status === "booked" && !!seg.reservation;
                      // Gebuchte Balken: Kanal-Farbakzent + Logo (Herkunft sofort
                      // erkennbar). Gesperrte: neutraler Block-Stil.
                      const meta = channelMeta(seg.source);
                      // Anzeige-Status (inkl. abgeleitetem „eingecheckt") für
                      // Farb-Punkt + reichen Tooltip.
                      const dispStatus: DisplayStatus | null = seg.reservation
                        ? reservationStatus(seg.reservation, todayKey)
                        : null;
                      const statusMeta = dispStatus ? STATUS_META[dispStatus] : null;
                      const nights = seg.span;
                      const barTitle =
                        seg.status === "booked"
                          ? [
                              segmentLabel(seg),
                              meta.label,
                              statusMeta?.label,
                              `${nights} Nacht${nights > 1 ? "e" : ""}`,
                            ]
                              .filter(Boolean)
                              .join(" · ")
                          : `${STATUS_LABEL[seg.status]} · ${seg.span} Tag(e)`;
                      // Kanal-/Status-Filter: nicht passende Balken dimmen
                      // (Belegung bleibt erkennbar, Treffer stechen hervor).
                      const dimmed = filtersActive && !segMatchesFilters(seg);
                      const barClass = `${
                        seg.status === "booked"
                          ? `${meta.barBg} ${meta.barFg}`
                          : SEG_STYLE[seg.status]
                      } ${dimmed ? "opacity-25" : ""}`;
                      // Während IRGENDEIN Balken gezogen wird, lassen alle Balken
                      // Mausereignisse durch (damit die Zell-onMouseEnter feuert
                      // und den Tag-Offset liefert).
                      const dragging = !!barDrag;
                      const isThisDragged =
                        barDrag?.res.id === seg.reservation?.id && !!seg.reservation;
                      const barStyle = {
                        left: `calc(${seg.start} * ${COL}rem + 0.25rem)`,
                        width: `calc(${seg.span} * ${COL}rem - 0.5rem)`,
                        height: "1.75rem",
                      };
                      const barInner = (
                        <>
                          {seg.status === "booked" && (
                            <ChannelLogo source={seg.source} />
                          )}
                          {seg.status === "blocked" && (
                            <Icon icon="ph:lock-simple" className="size-3 shrink-0" />
                          )}
                          {/* Status-Punkt (OPERA-Stil): bestätigt/Option/
                              eingecheckt/ausgecheckt/storniert. */}
                          {statusMeta && (
                            <span
                              className={`size-1.5 shrink-0 rounded-full ring-1 ring-white/60 ${statusMeta.dotBg}`}
                            />
                          )}
                          <span className="truncate">{segmentLabel(seg)}</span>
                          {/* Indikatoren rechts: Gästezahl + Nächte (sofern Platz). */}
                          {seg.status === "booked" && seg.reservation && (
                            <span className="ml-auto flex shrink-0 items-center gap-1 text-[0.65rem] opacity-90">
                              <span className="flex items-center gap-0.5">
                                <Icon icon="ph:user-fill" className="size-2.5" />
                                {seg.reservation.num_guests}
                              </span>
                              {nights >= 3 && <span>· {nights}N</span>}
                            </span>
                          )}
                        </>
                      );
                      if (!clickable) {
                        return (
                          <div
                            key={i}
                            title={barTitle}
                            className={`absolute top-1/2 flex -translate-y-1/2 items-center gap-1 overflow-hidden rounded-full px-2 text-xs font-medium ${barClass} ${dragging ? "pointer-events-none" : ""}`}
                            style={barStyle}
                          >
                            {barInner}
                          </div>
                        );
                      }
                      const res = seg.reservation as Reservation;
                      return (
                        <div
                          key={i}
                          title={barTitle}
                          onMouseDown={(ev) => {
                            ev.stopPropagation();
                            onBarDown(res, p.id, seg.start, "move", ev);
                          }}
                          // Während IRGENDEIN Balken gezogen wird, müssen ALLE
                          // Balken — auch der gezogene — Mausereignisse durch-
                          // lassen, sonst klebt der gezogene Balken am Cursor und
                          // die Zell-onMouseEnter der Zielzeile/Kante feuern nie
                          // (→ Move in andere Objekte & Resize blieben wirkungslos).
                          className={`group absolute top-1/2 flex -translate-y-1/2 cursor-grab items-center gap-1 overflow-hidden rounded-full px-2 text-xs font-medium transition-shadow hover:ring-2 hover:ring-accent/40 ${barClass} ${isThisDragged ? "opacity-60 ring-2 ring-accent" : ""} ${dragging ? "pointer-events-none" : ""}`}
                          style={barStyle}
                        >
                          {/* Resize-Kante links (Check-in). */}
                          <span
                            role="presentation"
                            onMouseDown={(ev) => {
                              ev.stopPropagation();
                              onBarDown(res, p.id, seg.start, "start", ev);
                            }}
                            className="absolute left-0 top-0 h-full w-2 cursor-ew-resize opacity-0 group-hover:opacity-100"
                          />
                          {barInner}
                          {/* Resize-Kante rechts (Check-out). */}
                          <span
                            role="presentation"
                            onMouseDown={(ev) => {
                              ev.stopPropagation();
                              onBarDown(res, p.id, seg.start + seg.span - 1, "end", ev);
                            }}
                            className="absolute right-0 top-0 h-full w-2 cursor-ew-resize opacity-0 group-hover:opacity-100"
                          />
                        </div>
                      );
                    })}

                    {/* Geister-Vorschau des verschobenen/resizten Balkens in
                        DIESER Zeile (Zielobjekt bei move, sonst gleiches Objekt). */}
                    {barDrag && start && (() => {
                      const { ci, co, pid } = barDragTarget(barDrag);
                      if (pid !== p.id) return null;
                      const ciIdx = Math.round(
                        (new Date(`${ci}T00:00:00`).getTime() - start.getTime()) / 86400000,
                      );
                      const coIdx = Math.round(
                        (new Date(`${co}T00:00:00`).getTime() - start.getTime()) / 86400000,
                      );
                      const span = Math.max(1, coIdx - ciIdx);
                      return (
                        <div
                          className="pointer-events-none absolute top-1/2 -translate-y-1/2 rounded-full border-2 border-dashed border-accent bg-accent/15"
                          style={{
                            left: `calc(${ciIdx} * ${COL}rem + 0.25rem)`,
                            width: `calc(${span} * ${COL}rem - 0.5rem)`,
                            height: "1.75rem",
                          }}
                        />
                      );
                    })()}
                  </div>
                </div>
              );
            })}
            </div>
          </div>
        </div>
      </Card>

      {/* Reservierungs-Assistent (3 Schritte, eigene Komponente) */}
      {wizard && (
        <ReservationWizard
          open
          onClose={() => setWizard(null)}
          onSaved={() => load()}
          properties={properties.map((p) => ({ id: p.id, title: p.title }))}
          initialPropertyId={wizard.pid}
          checkIn={wizard.checkIn}
          checkOut={wizard.checkOut}
          basePrice={0}
        />
      )}

      {/* Bulk-Edit (Preis/Min-Stay/Sperre über Zeitraum × Objekte) */}
      {bulk && start && (
        <BulkEditDialog
          open
          rangeLabel={`${bulk.checkIn} – ${bulk.checkOut}`}
          start={bulk.checkIn}
          end={bulk.checkOut}
          primaryProperty={{
            id: bulk.pid,
            title: properties.find((p) => p.id === bulk.pid)?.title ?? "Objekt",
          }}
          allProperties={properties.map((p) => ({ id: p.id, title: p.title }))}
          onClose={() => setBulk(null)}
          onApplied={() => load()}
        />
      )}

      {/* Buchungsdetail (Klick auf einen Balken) — voller Slider von rechts */}
      {detail && (
        <ReservationDetailSlider
          reservationId={detail}
          todayKey={todayKey}
          onClose={() => setDetail(null)}
          onCancelled={() => {
            setDetail(null);
            load();
          }}
        />
      )}

      {/* Bestätigung vor dem Verschieben/Resizen (Schutz vor Versehen) */}
      {pendingMove && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/40 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="mb-2 flex items-center gap-2">
              <Icon icon="ph:arrows-left-right" className="size-5 text-accent" />
              <h3 className="font-display text-lg font-extrabold">
                {pendingMove.mode === "move"
                  ? "Reservierung verschieben?"
                  : "Zeitraum ändern?"}
              </h3>
            </div>
            <p className="text-sm text-muted-foreground">
              {pendingMove.res.guest_name?.trim() || "Buchung"} →{" "}
              <span className="font-medium text-foreground">
                {properties.find((p) => p.id === pendingMove.targetPid)?.title ?? "Objekt"}
              </span>
              , {pendingMove.ci} – {pendingMove.co}.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Es wird erneut auf Doppelbuchung geprüft.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPendingMove(null)} disabled={saving}>
                Abbrechen
              </Button>
              <Button onClick={confirmMove} disabled={saving}>
                {saving ? "Verschiebe…" : "Verschieben"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Eine Kennzahl in der Auslastungsleiste.
function Metric({
  icon,
  label,
  value,
  hint,
}: {
  icon: string;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon icon={icon} className="size-4 text-muted-foreground" />
      <div className="flex flex-col leading-tight">
        <span className="font-display font-extrabold">{value}</span>
        <span className="text-xs text-muted-foreground">
          {label} · {hint}
        </span>
      </div>
    </div>
  );
}

// Kompaktes Filter-Dropdown (natives select, zugänglich + tastaturbedienbar).
function FilterSelect({
  value,
  onChange,
  allLabel,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  allLabel: string;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={allLabel}
      className="h-9 rounded-full border bg-background px-3 text-sm"
    >
      <option value="all">{allLabel}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

