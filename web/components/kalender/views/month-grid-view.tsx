"use client";

// Einzelobjekt-Monatsgitter (klassischer 7×N-Kalender wie Airbnb/Booking-Host):
// EIN Objekt, ENDLOS scrollbare Monate untereinander. Jede Zelle zeigt Status
// (frei/gebucht/gesperrt aus der availability), Tagespreis, Mindestaufenthalt
// und CTA/CTD-Sperren als Schloss-Icons. Darüber liegen die BUCHUNGSBALKEN mit
// Gastname und Kanalfarbe — wie in der Timeline: „gebucht" allein sagt nicht,
// WER da ist. Realtime auf den relevanten Tabellen, kein Polling.
//
// Scrollen ist unbegrenzt (keine Datumsgrenze). Begrenzt ist NUR, wie viele
// Monate gleichzeitig im DOM hängen (WINDOW): beim Scrollen wandert das Fenster
// mit, alte Monate fallen raus und werden beim Zurückscrollen neu aufgebaut.
// Ohne das lägen nach längerem Scrollen hunderte Gitter à 42 Zellen im Browser.
import { Icon } from "@iconify/react";
import { useTranslations, useLocale } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Prop } from "@/components/kalender/calendar-board";
import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import { NativeSelect } from "@nextdays/ui/native-select";
import {
  type DayAvailability,
  getAvailability,
} from "@/lib/calendar";
import { channelMeta } from "@/lib/calendar-channels";
import {
  OWNER_STAY_BAR,
  OWNER_STAY_ICON,
  STATUS_META,
  reservationStatus,
} from "@/lib/calendar-status";
import { barSegments, channelSource, dateKey } from "@/lib/calendar-views";
import { type Reservation, listReservations } from "@/lib/reservations";
import { formatCurrency } from "@/lib/utils";
import { getBoard } from "@/lib/calendar";
import { useRealtime } from "@/lib/use-realtime";

// Monate gleichzeitig im DOM. Beim Scrollen wandert das Fenster mit.
const WINDOW = 12;
// Der laufende Monat steht oben; so viele folgen beim ersten Rendern.
// Vergangenheit kommt erst beim Hochscrollen dazu.
const INITIAL_FORWARD = 4;

// Ein Monat als fortlaufende Zahl (Jahr*12 + Monat) — damit Vor/Zurück reines
// Rechnen ist und kein Jahreswechsel-Sonderfall entsteht.
type MonthIndex = number;

function toIndex(year: number, month: number): MonthIndex {
  return year * 12 + month;
}
function indexYear(i: MonthIndex): number {
  return Math.floor(i / 12);
}
function indexMonth(i: MonthIndex): number {
  return ((i % 12) + 12) % 12;
}

// Erster Gittertag (Montag der Woche, in der der Monatserste liegt) und Anzahl
// der 7er-Wochen für den Monat. Mo=0 … So=6.
function gridStart(year: number, month: number): Date {
  const first = new Date(year, month, 1);
  const dow = (first.getDay() + 6) % 7; // Mo=0
  const d = new Date(first);
  d.setDate(first.getDate() - dow);
  return d;
}
function weeksInMonth(year: number, month: number): number {
  const start = gridStart(year, month);
  const lastDay = new Date(year, month + 1, 0);
  const diff = Math.round(
    (lastDay.getTime() - start.getTime()) / 86_400_000,
  );
  return Math.ceil((diff + 1) / 7);
}

export function CalendarMonthGridView({
  properties,
  initialPropertyId,
  viewSwitcher,
}: {
  properties: Prop[];
  initialPropertyId?: string | null;
  /** Ansicht-Umschalter des Kalenders — steht in DIESER Steuerzeile, damit
   *  nicht zwei Auswahlfelder untereinander stehen. */
  viewSwitcher?: React.ReactNode;
}) {
  const t = useTranslations("calendar");
  const today = useMemo(() => new Date(), []);
  const todayIndex = useMemo(
    () => toIndex(today.getFullYear(), today.getMonth()),
    [today],
  );
  const [propertyId, setPropertyId] = useState<string>(
    initialPropertyId || properties[0]?.id || "",
  );

  // Sichtbares Monatsfenster [from, to] — wächst beim Scrollen an einem Ende
  // und schrumpft am anderen, sobald WINDOW überschritten wird.
  const [from, setFrom] = useState<MonthIndex>(todayIndex);
  const [to, setTo] = useState<MonthIndex>(todayIndex + INITIAL_FORWARD);

  // Buchungen + Währung liegen beim Elternteil: sie gelten fürs ganze Objekt,
  // nicht je Monat. Ein einziger Call statt einem pro Monatsblock.
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [currency, setCurrency] = useState<string | null>(null);

  const todayKey = useMemo(() => dateKey(today), [today]);

  const weekdays = useMemo(
    () => [
      t("monthGridView.weekdayMon"),
      t("monthGridView.weekdayTue"),
      t("monthGridView.weekdayWed"),
      t("monthGridView.weekdayThu"),
      t("monthGridView.weekdayFri"),
      t("monthGridView.weekdaySat"),
      t("monthGridView.weekdaySun"),
    ],
    [t],
  );
  const months = useMemo(
    () => [
      t("monthGridView.monthJanuary"),
      t("monthGridView.monthFebruary"),
      t("monthGridView.monthMarch"),
      t("monthGridView.monthApril"),
      t("monthGridView.monthMay"),
      t("monthGridView.monthJune"),
      t("monthGridView.monthJuly"),
      t("monthGridView.monthAugust"),
      t("monthGridView.monthSeptember"),
      t("monthGridView.monthOctober"),
      t("monthGridView.monthNovember"),
      t("monthGridView.monthDecember"),
    ],
    [t],
  );

  // Objektweite Daten (Buchungen für die Balken, Währung für die Preise).
  const loadProperty = useCallback(async () => {
    if (!propertyId) {
      setReservations([]);
      setCurrency(null);
      return;
    }
    const res = await listReservations(propertyId);
    if (res.ok) setReservations(res.data.items);
  }, [propertyId]);

  useEffect(() => {
    void loadProperty();
  }, [loadProperty]);

  // Währung aus dem Rate-Plan (zuverlässige Preisquelle, unabhängig von
  // Buchungen). Einmal je Objekt — ein beliebiger kurzer Zeitraum genügt.
  useEffect(() => {
    if (!propertyId) return;
    let aktiv = true;
    const start = gridStart(indexYear(from), indexMonth(from));
    const endExcl = new Date(start);
    endExcl.setDate(start.getDate() + 7);
    void getBoard([propertyId], dateKey(start), dateKey(endExcl)).then((b) => {
      if (!aktiv || !b.ok) return;
      const item = b.data.items.find((it) => it.property_id === propertyId);
      setCurrency(item?.currency ?? null);
    });
    return () => {
      aktiv = false;
    };
    // `from` bewusst NICHT in den Deps: die Währung hängt am Objekt, nicht am
    // Monat — sonst liefe bei jedem Scrollschritt ein Board-Call mit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId]);

  // Realtime: Buchungen speisen die Balken. Preis/Belegung je Monat hört der
  // jeweilige MonthBlock selbst ab (er kennt seinen Zeitraum).
  useRealtime({ table: "reservations", onChange: loadProperty });

  // Objektwechsel: zurück zum Startfenster ab heute.
  const scrollBox = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    setFrom(todayIndex);
    setTo(todayIndex + INITIAL_FORWARD);
    scrollBox.current?.scrollTo({ top: 0 });
  }, [propertyId, todayIndex]);

  const sentinelDown = useRef<HTMLDivElement | null>(null);
  const sentinelUp = useRef<HTMLDivElement | null>(null);
  // Sperre je Richtung: nach einem Nachladen bleibt die Sentinel im Blick
  // (sie wird ans neue Listenende mitgeschoben) und der Observer meldet
  // sofort erneut „sichtbar". Ohne die Sperre lädt er in einem Rutsch bis
  // zum WINDOW-Anschlag durch — die Seite wächst, ohne dass jemand scrollt.
  // Freigegeben wird erst, wenn die Sentinel den Blick wirklich verlassen hat.
  const sperreUnten = useRef(false);
  const sperreOben = useRef(false);

  // Beide Observer messen gegen den Scroll-Kasten (`root`), nicht gegen das
  // Browserfenster — sonst gälte ein Sentinel als sichtbar, sobald der KASTEN
  // im Blick ist, und es liefe endlos nach.
  useEffect(() => {
    const el = sentinelDown.current;
    const box = scrollBox.current;
    if (!el || !box) return;
    const io = new IntersectionObserver((entries) => {
      const sichtbar = entries[0]?.isIntersecting ?? false;
      if (!sichtbar) {
        sperreUnten.current = false;
        return;
      }
      if (sperreUnten.current) return;
      sperreUnten.current = true;
      // Beide Enden aus EINER Wahrheit rechnen: das neue Ende bestimmt, ob
      // vorne einer rausfällt. `to` aus der Closure wäre hier veraltet.
      setTo((prevTo) => {
        const nextTo = prevTo + 1;
        setFrom((prevFrom) =>
          nextTo - prevFrom + 1 > WINDOW ? prevFrom + 1 : prevFrom,
        );
        return nextTo;
      });
    }, { root: box });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Vergangenheit lädt NUR auf echtes Hochscrollen nach — sonst wandert das
  // Fenster beim ersten Rendern rückwärts und man landet statt auf heute im
  // letzten Jahr.
  useEffect(() => {
    const el = sentinelUp.current;
    const box = scrollBox.current;
    if (!el || !box) return;
    const io = new IntersectionObserver((entries) => {
      const sichtbar = entries[0]?.isIntersecting ?? false;
      if (!sichtbar) {
        sperreOben.current = false;
        return;
      }
      if (sperreOben.current) return;
      if (box.scrollTop <= 0) return; // ganz oben: erst scrollen, dann laden
      sperreOben.current = true;
      // Höhe VOR dem Einfügen merken und die Scrollposition um den Zuwachs
      // korrigieren — sonst springt der Blick, sobald oben ein Monat
      // eingehängt wird.
      const vorher = box.scrollHeight;
      setFrom((prevFrom) => {
        const nextFrom = prevFrom - 1;
        setTo((prevTo) =>
          prevTo - nextFrom + 1 > WINDOW ? prevTo - 1 : prevTo,
        );
        return nextFrom;
      });
      requestAnimationFrame(() => {
        box.scrollTop += box.scrollHeight - vorher;
      });
    }, { root: box });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const goToday = () => {
    setFrom(todayIndex);
    setTo(todayIndex + INITIAL_FORWARD);
    scrollBox.current?.scrollTo({ top: 0 });
  };

  // Ziehen zum Scrollen: die Scrollbar ist ausgeblendet, und ohne Mausrad
  // (Trackpad-lose Maus, Touchscreen-Kiosk) gäbe es sonst keinen Weg durch die
  // Monate. Pointer Events statt Mouse Events, damit Maus, Stift und Finger
  // denselben Pfad nehmen.
  const zieht = useRef(false);
  const startY = useRef(0);
  const startTop = useRef(0);
  // Nur WÄHREND des Ziehens die Textauswahl aussetzen — dauerhaft gesetzt
  // könnte man einen Gastnamen nie markieren und kopieren.
  const [ziehtAktiv, setZiehtAktiv] = useState(false);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // Nur die primäre Taste; Rechts-/Mittelklick bleiben dem Browser.
    if (e.button !== 0) return;
    const box = scrollBox.current;
    if (!box) return;
    zieht.current = true;
    startY.current = e.clientY;
    startTop.current = box.scrollTop;
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const box = scrollBox.current;
    if (!zieht.current || !box) return;
    const delta = e.clientY - startY.current;
    // Erst ab einer kleinen Schwelle greifen, sonst verschluckt schon ein
    // Wackeln beim Klicken den Klick.
    if (Math.abs(delta) < 3) return;
    // Pointer einfangen, damit das Ziehen weiterläuft, wenn der Zeiger den
    // Kasten verlässt — und der Browser keine Textauswahl startet.
    if (e.currentTarget.hasPointerCapture(e.pointerId) === false) {
      e.currentTarget.setPointerCapture(e.pointerId);
      setZiehtAktiv(true);
    }
    // Inhalt folgt der Hand: nach oben ziehen scrollt nach unten.
    box.scrollTop = startTop.current - delta;
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    zieht.current = false;
    setZiehtAktiv(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }, []);

  const sichtbar = useMemo(() => {
    const out: MonthIndex[] = [];
    for (let i = from; i <= to; i += 1) out.push(i);
    return out;
  }, [from, to]);

  return (
    <div className="flex flex-col gap-4">
      {/* Steuerung: Ansicht + Objekt nebeneinander, „Heute" rechts. */}
      <div className="flex flex-wrap items-center gap-2">
        {viewSwitcher}
        <NativeSelect
          value={propertyId}
          onChange={(e) => setPropertyId(e.target.value)}
          className="h-9 w-auto"
        >
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </NativeSelect>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" onClick={goToday}>
            {t("monthGridView.today")}
          </Button>
        </div>
      </div>

      <Card className="p-3">
        {/* Wochentagszeile: steht FEST über dem Scroll-Kasten, scrollt also
            nie mit — kein sticky nötig. */}
        <div className="grid grid-cols-7 bg-card">
          {weekdays.map((w) => (
            <div
              key={w}
              className="px-2 py-1.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              {w}
            </div>
          ))}
        </div>

        {/* Eigener Scroll-Kasten mit fester Höhe: die SEITE behält damit ihre
            Höhe, egal wie weit man durch die Monate scrollt. Die Scrollbar
            selbst ist ausgeblendet (scrollbar-hide) — gescrollt wird weiter
            per Rad, Trackpad und Tastatur. */}
        <div
          ref={scrollBox}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className={`scrollbar-hide h-[70vh] touch-pan-y overflow-y-auto overscroll-contain ${
            ziehtAktiv ? "cursor-grabbing select-none" : "cursor-grab"
          }`}
        >
          <div ref={sentinelUp} className="h-px" />
          {sichtbar.map((mi) => (
            <MonthBlock
              key={mi}
              monthIndex={mi}
              label={`${months[indexMonth(mi)]} ${indexYear(mi)}`}
              propertyId={propertyId}
              reservations={reservations}
              currency={currency}
              todayKey={todayKey}
            />
          ))}
          <div ref={sentinelDown} className="h-px" />
        </div>
      </Card>

      {/* Legende */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm border bg-card" /> {t("monthGridView.statusOpen")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-accent/15" /> {t("monthGridView.statusBooked")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-neutral-200 dark:bg-neutral-800" />{" "}
          {t("monthGridView.statusBlocked")}
        </span>
        <span className="flex items-center gap-1.5">
          <Icon icon="ph:sign-in" className="size-3.5 text-destructive" />{" "}
          {t("monthGridView.arrivalBlocked")}
        </span>
        <span className="flex items-center gap-1.5">
          <Icon icon="ph:sign-out" className="size-3.5 text-destructive" />{" "}
          {t("monthGridView.departureBlocked")}
        </span>
      </div>
    </div>
  );
}

// Ein Monat im Scrollstrom. Lädt seine Verfügbarkeit selbst (er kennt seinen
// Zeitraum) und hört auf die Tabellen, die Preis/Min-Stay/Belegung speisen.
// Buchungen und Währung kommen vom Elternteil — die gelten objektweit.
function MonthBlock({
  monthIndex,
  label,
  propertyId,
  reservations,
  currency,
  todayKey,
}: {
  monthIndex: MonthIndex;
  label: string;
  propertyId: string;
  reservations: Reservation[];
  currency: string | null;
  todayKey: string;
}) {
  const t = useTranslations("calendar");
  const locale = useLocale();
  const year = indexYear(monthIndex);
  const month = indexMonth(monthIndex);

  const start = useMemo(() => gridStart(year, month), [year, month]);
  const weeks = useMemo(() => weeksInMonth(year, month), [year, month]);
  const [days, setDays] = useState<Record<string, DayAvailability>>({});

  const statusCell = useMemo(
    (): Record<DayAvailability["status"], { cls: string; label: string }> => ({
      open: { cls: "bg-card", label: t("monthGridView.statusOpen") },
      booked: { cls: "bg-accent/15", label: t("monthGridView.statusBooked") },
      blocked: {
        cls: "bg-neutral-200 dark:bg-neutral-800",
        label: t("monthGridView.statusBlocked"),
      },
    }),
    [t],
  );

  const load = useCallback(async () => {
    if (!propertyId) {
      setDays({});
      return;
    }
    const endExcl = new Date(start);
    endExcl.setDate(start.getDate() + weeks * 7);
    const av = await getAvailability(
      propertyId,
      dateKey(start),
      dateKey(endExcl),
    );
    if (!av.ok) return;
    const map: Record<string, DayAvailability> = {};
    for (const d of av.data) map[d.date] = d;
    setDays(map);
  }, [propertyId, start, weeks]);

  useEffect(() => {
    void load();
  }, [load]);

  // Der Preis kommt aus dem Resolver über price_overrides > dynamic_prices >
  // weekday (property_pricing_config) > base (rate_plans); dp_settings schaltet
  // Dynamic Pricing je Objekt; stop_sell beeinflusst die als 'blocked' gezeigte
  // Belegung. Ohne diese Abos bliebe der Monat stale (Realtime-Pflicht).
  useRealtime({ table: "availability", onChange: load });
  useRealtime({ table: "price_overrides", onChange: load });
  useRealtime({ table: "stop_sell", onChange: load });
  useRealtime({ table: "rate_plans", onChange: load });
  useRealtime({ table: "property_pricing_config", onChange: load });
  useRealtime({ table: "dynamic_prices", onChange: load });
  useRealtime({ table: "dp_settings", onChange: load });

  const cells = useMemo(() => {
    const out: Date[] = [];
    for (let i = 0; i < weeks * 7; i += 1) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      out.push(d);
    }
    return out;
  }, [start, weeks]);

  // Balkenstücke je Gitterwoche — eine Buchung über den Wochenwechsel ergibt
  // mehrere Stücke, weil ein Grid-Kind keine Zeile umbrechen kann.
  const segmentsByWeek = useMemo(() => {
    const all = barSegments(reservations, start, weeks);
    const out: ReturnType<typeof barSegments>[] = Array.from(
      { length: weeks },
      () => [],
    );
    for (const seg of all) out[seg.week]?.push(seg);
    // Innerhalb der Woche nach Startspalte, damit gestapelte Balken bei
    // Mehrfachbelegung (Einheiten) in stabiler Reihenfolge liegen.
    for (const row of out) row.sort((a, b) => a.col - b.col);
    return out;
  }, [reservations, start, weeks]);

  function priceText(price: number | null | undefined): string {
    if (price == null) return "–";
    return currency
      ? formatCurrency(price, currency)
      : price.toLocaleString(locale, { maximumFractionDigits: 0 });
  }

  return (
    <section className="pt-4 first:pt-0">
      <h3 className="px-1 pb-2 font-display text-lg font-bold">{label}</h3>
      {/* Tageszellen, Woche für Woche. Jede Woche ist ein eigenes Raster mit
          zwei Lagen: unten die Tagesfelder (Preis/Status), darüber die
          Buchungsbalken. */}
      <div className="flex flex-col gap-1">
        {Array.from({ length: weeks }, (_, w) => (
          <div key={w} className="relative">
            <div className="grid grid-cols-7 gap-1">
              {cells.slice(w * 7, w * 7 + 7).map((d) => {
                const k = dateKey(d);
                const inMonth = d.getMonth() === month;
                const da = days[k];
                const status = da?.status ?? "open";
                const meta = statusCell[status];
                const isToday = k === todayKey;
                return (
                  <div
                    key={k}
                    className={`flex min-h-[6.5rem] flex-col rounded-xl border p-1.5 ${
                      meta.cls
                    } ${inMonth ? "" : "opacity-40"} ${
                      isToday ? "ring-2 ring-accent" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-semibold ${isToday ? "text-accent" : ""}`}>
                        {d.getDate()}
                      </span>
                      <span className="flex items-center gap-0.5">
                        {/* CTA = Anreise gesperrt, CTD = Abreise gesperrt. */}
                        {da?.closed_to_arrival && (
                          <span title={t("monthGridView.arrivalBlocked")} className="flex">
                            <Icon icon="ph:sign-in" className="size-3.5 text-destructive" />
                          </span>
                        )}
                        {da?.closed_to_departure && (
                          <span title={t("monthGridView.departureBlocked")} className="flex">
                            <Icon icon="ph:sign-out" className="size-3.5 text-destructive" />
                          </span>
                        )}
                      </span>
                    </div>
                    {da && (
                      <div className="mt-auto flex flex-col gap-0.5">
                        <span className="text-xs font-medium tabular-nums">
                          {priceText(da.price)}
                        </span>
                        <div className="flex items-center justify-between text-[0.625rem] text-muted-foreground">
                          <span>{meta.label}</span>
                          {da.min_stay != null && da.min_stay > 1 && (
                            <span
                              title={t("monthGridView.minStayTitle", { count: da.min_stay })}
                            >
                              ≥{da.min_stay}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Balkenlage: sitzt unter der Datumszeile, über den Preisen.
                Reine Anzeige — pointer-events-none, damit die Lage die
                Zellen darunter nicht blockiert. */}
            <div className="pointer-events-none absolute inset-x-0 top-7 grid grid-cols-7 gap-1">
              {segmentsByWeek[w]?.map((seg) => {
                const st = reservationStatus(seg.res, todayKey);
                const cm = channelMeta(channelSource(seg.res));
                const owner = seg.res.is_owner_stay;
                const bar = owner
                  ? OWNER_STAY_BAR
                  : STATUS_META[st].barClass ?? `${cm.barBg} ${cm.barFg}`;
                return (
                  <span
                    key={`${seg.res.id}-${seg.week}-${seg.col}`}
                    title={`${seg.res.guest_name} · ${seg.res.check_in} → ${seg.res.check_out}`}
                    style={{
                      gridColumn: `${seg.col + 1} / span ${seg.span}`,
                    }}
                    className={`flex h-6 items-center gap-1 overflow-hidden px-1.5 text-[0.6875rem] font-medium ${bar} ${
                      seg.startsHere ? "ml-1 rounded-l-full" : ""
                    } ${seg.endsHere ? "mr-1 rounded-r-full" : ""}`}
                  >
                    <Icon
                      icon={owner ? OWNER_STAY_ICON : cm.logo.kind === "icon" ? cm.logo.icon : "ph:globe-simple-fill"}
                      className="size-3 shrink-0"
                    />
                    {/* Name nur im ersten Stück — sonst stünde er nach jedem
                        Wochenwechsel erneut mitten in der Buchung. */}
                    {seg.startsHere && (
                      <span className="truncate">{seg.res.guest_name}</span>
                    )}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
