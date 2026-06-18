"use client";

// Lodgify-artiges Kalender-Raster (Timeline): rollierend ab HEUTE, links
// Objektzeilen (Foto/Name/Adresse), rechts scrollende Tagespalten mit
// Wochentag+Datum. Zellen zeigen Gäste + Preis-Platzhalter; belegte/gesperrte
// Zeiträume als Balken. Scrollt INNERHALB des Containers (kein Seiten-Overflow).
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  type ViewOptions,
  CalendarHeader,
  DEFAULT_VIEW,
} from "@/components/kalender/calendar-header";
import { CalendarActionMenu } from "@/components/kalender/calendar-action-menu";
import { PropertyLabel } from "@/components/kalender/property-label";
import { ReservationWizard } from "@/components/kalender/reservation-wizard";
import {
  type AvailabilityStatus,
  type DayAvailability,
  blockRange,
  getAvailability,
} from "@/lib/calendar";
import type { PropertyType } from "@/lib/properties";

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

const RANGE = 30; // angezeigte Tage ab Startdatum
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

type Segment = { start: number; span: number; status: AvailabilityStatus };

// Aufeinanderfolgende Tage gleichen (nicht-offenen) Status zu Balken bündeln.
function toSegments(
  statusByDay: Record<string, AvailabilityStatus>,
  dates: Date[],
): Segment[] {
  const segs: Segment[] = [];
  let cur: Segment | null = null;
  dates.forEach((d, i) => {
    const s = statusByDay[key(d)] ?? "open";
    if (s === "open") {
      cur = null;
      return;
    }
    if (cur && cur.status === s && cur.start + cur.span === i) {
      cur.span += 1;
    } else {
      cur = { start: i, span: 1, status: s };
      segs.push(cur);
    }
  });
  return segs;
}

export function CalendarBoard({ properties }: { properties: Prop[] }) {
  // Startdatum (rollierend). null bis der Client das heutige Datum kennt.
  const [start, setStart] = useState<Date | null>(null);
  const [todayKey, setTodayKey] = useState("");
  const [avail, setAvail] = useState<Record<string, Record<string, AvailabilityStatus>>>({});
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<ViewOptions>(DEFAULT_VIEW);

  // Interaktion wie Lodgify: Anfangstag drücken → bis Endtag ziehen → loslassen.
  // `drag` ist nur die Vorschau WÄHREND des Ziehens; `sel` wird ERST beim
  // Loslassen gesetzt und löst dann die Bestätigungsleiste aus.
  const [drag, setDrag] = useState<{ pid: string; from: number; to: number } | null>(null);
  const [sel, setSel] = useState<{ pid: string; from: number; to: number } | null>(null);
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null);
  // Reservierungs-Assistent: Zeitraum (YYYY-MM-DD) + Objekt, wenn offen.
  const [wizard, setWizard] = useState<{ pid: string; checkIn: string; checkOut: string } | null>(null);
  const [saving, setSaving] = useState(false);

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
      setDrag((cur) => (cur && cur.pid === pid ? { ...cur, to: di } : cur));
    },
    [],
  );

  // Maus loslassen beendet das Ziehen: Vorschau → Auswahl, dann öffnet sich
  // direkt das Aktionsmenü am Cursor (wie Lodgify) — keine Leiste.
  useEffect(() => {
    const up = (e: MouseEvent) => {
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
  }, []);

  useEffect(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    setStart(now);
    setTodayKey(key(now));
  }, []);

  const dates = useMemo(
    () => (start ? Array.from({ length: RANGE }, (_, i) => addDays(start, i)) : []),
    [start],
  );

  const shown = properties;

  const load = useCallback(async () => {
    if (!start || properties.length === 0) return;
    setLoading(true);
    const s = key(start);
    const e = key(addDays(start, RANGE));
    const results = await Promise.all(
      properties.map(async (p) => {
        const res = await getAvailability(p.id, s, e);
        const map: Record<string, AvailabilityStatus> = {};
        if (res.ok) for (const d of res.data as DayAvailability[]) map[d.date] = d.status;
        return [p.id, map] as const;
      }),
    );
    setAvail(Object.fromEntries(results));
    setLoading(false);
  }, [start, properties]);

  useEffect(() => {
    load();
  }, [load]);

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
        onPrev={() => shift(-7)}
        onNext={() => shift(7)}
        onToday={goToday}
        onCreate={onCreate}
      />

      {/* Legende */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        {(["open", "booked", "blocked"] as AvailabilityStatus[]).map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className={`inline-block size-3 rounded-sm border ${s === "open" ? "bg-background" : SEG_STYLE[s]}`} />
            {STATUS_LABEL[s]}
          </span>
        ))}
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
            // Reservierung: Wizard mit gezogenem Zeitraum öffnen (end exklusiv).
            const lo = Math.min(sel.from, sel.to);
            const hi = Math.max(sel.from, sel.to);
            setWizard({
              pid: sel.pid,
              checkIn: key(addDays(start, lo)),
              checkOut: key(addDays(start, hi + 1)),
            });
            setMenuAt(null);
            setSel(null);
          }}
          onClose={() => {
            setMenuAt(null);
            setSel(null);
          }}
        />
      )}

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
            {shown.map((p) => {
              const statusMap = avail[p.id] ?? {};
              const segs = toSegments(statusMap, dates);
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
                                <span className={inSel ? "text-white" : "text-muted-foreground"}>–</span>
                              )}
                              {view.showMinStay && (
                                <span className={`flex items-center gap-0.5 text-[0.65rem] ${inSel ? "text-white/80" : "text-muted-foreground/70"}`}>
                                  <Icon icon="ph:moon" className="size-3" />–
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

                    {/* Balken über belegte/gesperrte Zeiträume */}
                    {segs.map((seg, i) => (
                      <div
                        key={i}
                        title={`${STATUS_LABEL[seg.status]} · ${seg.span} Tag(e)`}
                        className={`absolute top-1/2 flex -translate-y-1/2 items-center gap-1 overflow-hidden rounded-full px-2 text-xs font-medium ${SEG_STYLE[seg.status]}`}
                        style={{
                          left: `calc(${seg.start} * ${COL}rem + 0.25rem)`,
                          width: `calc(${seg.span} * ${COL}rem - 0.5rem)`,
                          height: "1.75rem",
                        }}
                      >
                        {seg.status === "booked" && <Icon icon="ph:calendar-check" className="size-3 shrink-0" />}
                        {seg.status === "blocked" && <Icon icon="ph:lock-simple" className="size-3 shrink-0" />}
                        <span className="truncate">{STATUS_LABEL[seg.status]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
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
    </div>
  );
}
