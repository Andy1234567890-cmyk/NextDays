"use client";

// Kalender-Ansicht „Preise": eine Zeile je Rate-Plan des Objekts mit den ECHTEN
// Tagespreisen (Datumspreis > Objekt-Override > Dynamic > Wochentag >
// Plan-Grundpreis) — dieselbe Wahrheit wie Buchungs-Quote und Portale
// (/rates/grid, zentraler Resolver). Ziehen über Tage → kleiner Bulk-Editor
// (Preis setzen / auf Grundpreis zurück), Umschalter Preise|Min-Stay|Restriktionen.
// Ein Objekt = eine Einheit; mehrere Rate-Pläne (BAR/B&B) je Objekt möglich, KEINE
// Zimmerkategorie-Ebene.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type { Prop } from "@/components/kalender/calendar-board";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Segmented } from "@/components/ui/segmented";
import { getBoard } from "@/lib/calendar";
import { formatCurrency } from "@/lib/currency";
import {
  getRateGrid,
  listRatePlanMinStays,
  listRatePlanRestrictions,
  resyncRatePlanPrices,
  setRatePlanMinStays,
  setRatePlanPrices,
  setRatePlanRestrictions,
  type RateGridResponse,
  type RatePlanMinStayDay,
  type RatePlanRestrictionDay,
} from "@/lib/rates";
import { useRealtime } from "@/lib/use-realtime";

const WD_KEYS = ["so", "mo", "di", "mi", "do", "fr", "sa"] as const;
// Gleiche Geometrie wie der Belegungsplan (calendar-board) — die Ansicht soll
// sich wie eine zweite Seite DESSELBEN Kalenders anfühlen, nicht wie eine Tabelle.
const COL = 5.5; // rem pro Tagesspalte
const LABEL = 17; // rem für die Plan-Spalte

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDaysIso(isoDate: string, n: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
}

// Kompakt-Label der Ableitung: „+25 · −15 %" (Betrag sprachneutral ohne Symbol,
// Prozent mit %). Beide leer → „1:1" (Spiegel). Vorzeichen explizit.
function derivedOffsetLabel(plan: {
  offset_amount: number | null;
  offset_percent: number | null;
}): string {
  const parts: string[] = [];
  if (plan.offset_amount != null && plan.offset_amount !== 0) {
    parts.push(`${plan.offset_amount > 0 ? "+" : ""}${plan.offset_amount}`);
  }
  if (plan.offset_percent != null && plan.offset_percent !== 0) {
    parts.push(`${plan.offset_percent > 0 ? "+" : ""}${plan.offset_percent} %`);
  }
  return parts.length ? parts.join(" · ") : "1:1";
}

type Mode = "prices" | "minstay" | "restrictions";
// Verfügbarkeits-Zustand eines Tages in der Kopfzeile. "stop" (Stop-Sell) ist
// bewusst ein EIGENER Zustand: der Tag ist frei, wird aber auf allen Kanälen
// nicht verkauft — das ist etwas anderes als belegt oder manuell gesperrt.
type AvailKind = "open" | "booked" | "blocked" | "stop";
// Drei-Wege-Auswahl im Restriktions-Editor: unverändert lassen gibt es hier
// nicht — "none" heißt „kein Override" (Default offen).
type TriState = "none" | "on" | "off";

export function CalendarRatesView({ properties }: { properties: Prop[] }) {
  const t = useTranslations("calendar");
  const [propertyId, setPropertyId] = useState(properties[0]?.id ?? "");
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getUTCFullYear(), month: now.getUTCMonth() };
  });
  const [grid, setGrid] = useState<RateGridResponse | null>(null);
  const todayKey = iso(new Date());
  const [minStays, setMinStays] = useState<Map<string, Map<string, number>>>(
    new Map(),
  );
  // Gesetzte Restriktionen (CTA/CTD/Max-Stay) je Plan × Datum (0153) — die
  // Anzeige-Wahrheit für den Restriktions-Modus, live per Realtime.
  const [restr, setRestr] = useState<
    Map<string, Map<string, RatePlanRestrictionDay>>
  >(new Map());
  const [mode, setMode] = useState<Mode>("prices");
  const [busy, setBusy] = useState(false);
  // Verfügbarkeit des Objekts je Tag (frei/belegt/gesperrt) — read-only Kopfzeile
  // über den Plan-Zeilen. Belegung wird im Belegungsplan gepflegt, NICHT hier;
  // umgekehrt werden Preise NUR hier gepflegt.
  const [avail, setAvail] = useState<Map<string, AvailKind>>(new Map());
  const [availOpen, setAvailOpen] = useState(true);

  // Monatsfenster [first, firstNext) — /rates/grid ist range-begrenzt.
  const first = useMemo(
    () => iso(new Date(Date.UTC(cursor.year, cursor.month, 1))),
    [cursor],
  );
  const firstNext = useMemo(
    () => iso(new Date(Date.UTC(cursor.year, cursor.month + 1, 1))),
    [cursor],
  );
  const days = useMemo(() => {
    const out: string[] = [];
    let cur = first;
    while (cur < firstNext) {
      out.push(cur);
      cur = addDaysIso(cur, 1);
    }
    return out;
  }, [first, firstNext]);

  const load = useCallback(async () => {
    if (!propertyId) return;
    const res = await getRateGrid(propertyId, first, firstNext);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setGrid(res.data);
    // Min-Stay- und Restriktions-Overrides je Plan (kleine Listen; Anzeige =
    // Override ?? Default) — parallel geladen.
    const planIds = res.data.plans.map((p) => p.id);
    const loaded = await Promise.all(
      planIds.map(async (id) => {
        const [ms, rs] = await Promise.all([
          listRatePlanMinStays(id),
          listRatePlanRestrictions(id),
        ]);
        const map = new Map<string, number>();
        if (ms.ok) {
          for (const d of ms.data.items as RatePlanMinStayDay[]) {
            map.set(d.date, d.min_stay);
          }
        }
        const rmap = new Map<string, RatePlanRestrictionDay>();
        if (rs.ok) {
          for (const d of rs.data.items) rmap.set(d.date, d);
        }
        return [id, map, rmap] as const;
      }),
    );
    setMinStays(new Map(loaded.map(([id, ms]) => [id, ms])));
    setRestr(new Map(loaded.map(([id, , rs]) => [id, rs])));

    // Verfügbarkeit derselben Spanne (ein Objekt) für die read-only Kopfzeile.
    // Stop-Sell gewinnt über "frei": der Tag ist buchbar, wird aber nicht
    // verkauft — das muss man beim Preise-Pflegen sehen.
    const board = await getBoard([propertyId], first, firstNext);
    if (board.ok) {
      const item = board.data.items.find((i) => i.property_id === propertyId);
      const next = new Map<string, AvailKind>();
      for (const d of item?.days ?? []) next.set(d.date, d.status);
      for (const s of item?.stop_sell ?? []) {
        if (next.get(s.date) === "open") next.set(s.date, "stop");
      }
      setAvail(next);
    }
  }, [propertyId, first, firstNext]);

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime auf ALLE speisenden Tabellen (Preise, Min-Stay, Pläne, Sync,
  // Kategorien) — kein manuelles Reload nötig.
  const reload = useCallback(() => void load(), [load]);
  useRealtime({ table: "rate_plan_price_overrides", onChange: reload });
  useRealtime({ table: "rate_plan_min_stay_overrides", onChange: reload });
  useRealtime({ table: "rate_plan_restriction_overrides", onChange: reload });
  useRealtime({ table: "rate_plans", onChange: reload });
  useRealtime({ table: "rate_plan_sync_state", onChange: reload });
  useRealtime({ table: "price_overrides", onChange: reload });
  useRealtime({ table: "dynamic_prices", onChange: reload });
  // Speisen die Verfügbarkeits-Kopfzeile (Belegung/Sperren/Stop-Sell).
  useRealtime({ table: "availability", onChange: reload });
  useRealtime({ table: "reservations", onChange: reload });
  useRealtime({ table: "stop_sell", onChange: reload });

  // Drag-Auswahl innerhalb EINER Plan-Zeile → Editor öffnen.
  const drag = useRef<{ planId: string; from: string; to: string } | null>(null);
  const [dragSel, setDragSel] = useState<{
    planId: string;
    from: string;
    to: string;
  } | null>(null);
  const [editor, setEditor] = useState<{
    planId: string;
    planName: string;
    currency: string;
    from: string;
    to: string; // inklusiv
  } | null>(null);
  const [value, setValue] = useState("");
  // Restriktions-Editor: CTA/CTD als Drei-Wege (kein Override / gesperrt / offen);
  // `value` trägt in diesem Modus den Max-Stay.
  const [ctaSel, setCtaSel] = useState<TriState>("none");
  const [ctdSel, setCtdSel] = useState<TriState>("none");
  // Optionale Wochentagsmaske im Bulk-Editor (Mo=0 … So=6). Leer = alle Tage im
  // gezogenen Bereich. Wird an prices/minstay/restrictions durchgereicht.
  const [weekdaySel, setWeekdaySel] = useState<number[]>([]);

  const onDown = (planId: string, day: string) => {
    drag.current = { planId, from: day, to: day };
    setDragSel({ ...drag.current });
    setEditor(null);
  };
  const onEnter = (planId: string, day: string) => {
    if (!drag.current || drag.current.planId !== planId) return;
    drag.current = { ...drag.current, to: day };
    setDragSel({ ...drag.current });
  };
  useEffect(() => {
    const onUp = () => {
      const cur = drag.current;
      drag.current = null;
      if (!cur || !grid) return;
      const [lo, hi] = cur.from <= cur.to ? [cur.from, cur.to] : [cur.to, cur.from];
      const plan = grid.plans.find((p) => p.id === cur.planId);
      if (!plan) return;
      setEditor({
        planId: plan.id,
        planName: plan.name,
        currency: plan.currency,
        from: lo,
        to: hi,
      });
      // Restriktions-Modus: Editor mit den AKTUELLEN Werten des ersten Tags
      // vorbefüllen — Nachträglich-Bearbeiten heißt sehen, was gesetzt ist.
      if (mode === "restrictions") {
        const cur = restr.get(plan.id)?.get(lo);
        setCtaSel(
          cur?.closed_to_arrival == null
            ? "none"
            : cur.closed_to_arrival
              ? "on"
              : "off",
        );
        setCtdSel(
          cur?.closed_to_departure == null
            ? "none"
            : cur.closed_to_departure
              ? "on"
              : "off",
        );
        setValue(cur?.max_stay != null ? String(cur.max_stay) : "");
      } else {
        setValue("");
      }
    };
    window.addEventListener("mouseup", onUp);
    return () => window.removeEventListener("mouseup", onUp);
  }, [grid, mode, restr]);

  const closeEditor = useCallback(() => {
    setEditor(null);
    setDragSel(null);
    setValue("");
    setCtaSel("none");
    setCtdSel("none");
    setWeekdaySel([]);
  }, []);

  // Escape schließt das Popup (Modal-Standard) — nur solange nicht gespeichert wird.
  useEffect(() => {
    if (!editor) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) closeEditor();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editor, busy, closeEditor]);

  const apply = async (reset: boolean) => {
    if (!editor) return;
    const endExclusive = addDaysIso(editor.to, 1);
    if (mode === "restrictions") {
      // Endzustand senden: reset = alle drei null (Override zurücknehmen).
      let maxStay: number | null = null;
      if (!reset && value.trim() !== "") {
        const n = Number(value);
        if (!Number.isInteger(n) || n < 0) {
          toast.error(t("ratesView.invalidValue"));
          return;
        }
        maxStay = n;
      }
      setBusy(true);
      const res = await setRatePlanRestrictions(
        editor.planId, editor.from, endExclusive,
        reset
          ? { closed_to_arrival: null, closed_to_departure: null, max_stay: null }
          : {
            closed_to_arrival: ctaSel === "none" ? null : ctaSel === "on",
            closed_to_departure: ctdSel === "none" ? null : ctdSel === "on",
            max_stay: maxStay,
          },
        weekdaySel,
      );
      setBusy(false);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      closeEditor();
      void load();
      return;
    }
    let num: number | null = null;
    if (!reset) {
      num = Number(value);
      const bad =
        value.trim() === "" ||
        !Number.isFinite(num) ||
        num < 0 ||
        (mode === "minstay" && (!Number.isInteger(num) || num < 1));
      if (bad) {
        toast.error(t("ratesView.invalidValue"));
        return;
      }
    }
    setBusy(true);
    const res =
      mode === "prices"
        ? await setRatePlanPrices(
            editor.planId, editor.from, endExclusive, num, weekdaySel,
          )
        : await setRatePlanMinStays(
            editor.planId, editor.from, endExclusive, num, weekdaySel,
          );
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    closeEditor();
    void load();
  };

  const resync = async (planId: string) => {
    const res = await resyncRatePlanPrices(planId);
    if (!res.ok) toast.error(res.error);
    else toast.success(t("ratesView.resyncQueued"));
  };

  const goMonth = (delta: number) =>
    setCursor((c) => {
      const d = new Date(Date.UTC(c.year, c.month + delta, 1));
      return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
    });

  const inDrag = (planId: string, day: string): boolean => {
    if (!dragSel || dragSel.planId !== planId) return false;
    const [lo, hi] =
      dragSel.from <= dragSel.to
        ? [dragSel.from, dragSel.to]
        : [dragSel.to, dragSel.from];
    return day >= lo && day <= hi;
  };

  const monthLabel = `${t(`calendarBoard.months.${(["januar", "februar", "maerz", "april", "mai", "juni", "juli", "august", "september", "oktober", "november", "dezember"] as const)[cursor.month]}`)} ${cursor.year}`;

  return (
    <div className="flex flex-col gap-4">
      {/* Kopfzeile: Objekt, Monat, Modus. */}
      <div className="flex flex-wrap items-center gap-3">
        <NativeSelect
          value={propertyId}
          onChange={(e) => setPropertyId(e.target.value)}
          aria-label={t("ratesView.propertyLabel")}
          className="h-9 w-auto rounded-full font-medium"
        >
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </NativeSelect>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => goMonth(-1)}>
            <Icon icon="ph:caret-left" className="size-4" />
          </Button>
          <span className="min-w-36 text-center font-display text-lg font-bold">
            {monthLabel}
          </span>
          <Button variant="outline" size="icon" onClick={() => goMonth(1)}>
            <Icon icon="ph:caret-right" className="size-4" />
          </Button>
        </div>
        <Segmented
          value={mode}
          onChange={(v) => {
            setMode(v as Mode);
            closeEditor();
          }}
          options={[
            { value: "prices", label: t("ratesView.modePrices") },
            { value: "minstay", label: t("ratesView.modeMinStay") },
            { value: "restrictions", label: t("ratesView.modeRestrictions") },
          ]}
        />
      </div>

      {/* Bulk-Editor der aufgezogenen Auswahl als Popup (SiteMinder-Quick-Update):
          als flache Leiste brach der Restriktions-Modus zweizeilig um und die
          Auswahl im Grid geriet aus dem Blick. Modal, zentriert, Icon je Modus. */}
      {editor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            // Klick auf den Schleier schließt; Klicks im Dialog nicht.
            if (e.target === e.currentTarget && !busy) closeEditor();
          }}
        >
        <div className="flex w-full max-w-xl flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-2xl">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
              <Icon
                icon={
                  mode === "prices"
                    ? "ph:tag"
                    : mode === "minstay"
                      ? "ph:moon-stars"
                      : "ph:lock-key"
                }
                className="size-5"
              />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="font-display text-lg font-extrabold">
                {mode === "prices"
                  ? t("ratesView.modePrices")
                  : mode === "minstay"
                    ? t("ratesView.modeMinStay")
                    : t("ratesView.modeRestrictions")}
              </h3>
              <p className="truncate text-sm text-muted-foreground">
                {editor.planName} · {editor.from} – {editor.to}
              </p>
            </div>
            <button
              type="button"
              onClick={closeEditor}
              disabled={busy}
              className="shrink-0 text-muted-foreground hover:text-foreground"
              aria-label={t("ratesView.cancel")}
            >
              <Icon icon="ph:x" className="size-5" />
            </button>
          </div>

          {/* Wochentagsmaske (SiteMinder Quick-Bulk): leer = alle Tage im Bereich. */}
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">
              {t("ratesView.weekdaysLabel")}
            </span>
            <div className="flex items-center gap-1" role="group" aria-label={t("ratesView.weekdaysLabel")}>
              {[0, 1, 2, 3, 4, 5, 6].map((wd) => {
                const active = weekdaySel.includes(wd);
                return (
                  <button
                    key={wd}
                    type="button"
                    onClick={() =>
                      setWeekdaySel((s) =>
                        s.includes(wd) ? s.filter((x) => x !== wd) : [...s, wd],
                      )
                    }
                    className={`size-8 rounded-full text-xs font-medium transition-colors ${
                      active
                        ? "bg-accent text-white"
                        : "bg-secondary text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {t(`calendarBoard.weekdays.${WD_KEYS[(wd + 1) % 7]}`)}
                  </button>
                );
              })}
            </div>
          </div>

          {mode === "restrictions" ? (
            <div className="flex flex-col gap-3">
              {/* CTA/CTD als Drei-Wege (— = kein Override, An = gesperrt, Aus =
                  ausdrücklich offen) + Max-Stay. Vorbefüllt mit den aktuellen
                  Werten — ändern überschreibt, „Zurücknehmen" löscht den Override. */}
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 text-sm">
                  <Icon icon="ph:sign-in" className="size-4 text-muted-foreground" />
                  {t("monthGridView.arrivalBlocked")}
                </span>
                <Segmented
                  value={ctaSel}
                  options={[
                    { value: "none", label: "—" },
                    { value: "on", label: t("ratesView.on") },
                    { value: "off", label: t("ratesView.off") },
                  ]}
                  onChange={(v) => setCtaSel(v as TriState)}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 text-sm">
                  <Icon icon="ph:sign-out" className="size-4 text-muted-foreground" />
                  {t("monthGridView.departureBlocked")}
                </span>
                <Segmented
                  value={ctdSel}
                  options={[
                    { value: "none", label: "—" },
                    { value: "on", label: t("ratesView.on") },
                    { value: "off", label: t("ratesView.off") },
                  ]}
                  onChange={(v) => setCtdSel(v as TriState)}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm">{t("ratesView.maxStayLabel")}</span>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  placeholder={t("ratesView.maxStayLabel")}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="w-36"
                />
              </div>
            </div>
          ) : (
            <Input
              type="number"
              min={mode === "minstay" ? 1 : 0}
              step={mode === "minstay" ? 1 : "0.01"}
              inputMode="decimal"
              autoFocus
              placeholder={
                mode === "prices"
                  ? t("ratesView.pricePlaceholder", { currency: editor.currency })
                  : t("ratesView.minStayPlaceholder")
              }
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !busy) void apply(false);
              }}
            />
          )}

          <div className="flex items-center justify-between gap-2 border-t pt-4">
            <Button
              variant="ghost"
              onClick={() => void apply(true)}
              disabled={busy}
            >
              {mode === "prices"
                ? t("ratesView.resetToBase")
                : t("ratesView.resetToDefault")}
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={closeEditor} disabled={busy}>
                {t("ratesView.cancel")}
              </Button>
              <Button onClick={() => void apply(false)} disabled={busy}>
                {t("ratesView.apply")}
              </Button>
            </div>
          </div>
        </div>
        </div>
      )}

      {/* Grid in der Design-Sprache des Belegungsplans: sticky Plan-Spalte,
          Tagesspalten in Board-Geometrie, Heute im Akzent-Kreis. */}
      <div className="overflow-x-auto rounded-(--radius) border bg-card">
        <div style={{ width: `${LABEL + days.length * COL}rem` }}>
          <div className="flex border-b">
            <div
              className="sticky left-0 z-20 flex shrink-0 items-center border-r bg-card px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              style={{ width: `${LABEL}rem` }}
            >
              {t("ratesView.planColumn")}
            </div>
            {days.map((d) => {
              const dt = new Date(`${d}T00:00:00Z`);
              const isToday = d === todayKey;
              return (
                <div
                  key={d}
                  className="flex shrink-0 flex-col items-center border-r py-2 text-sm"
                  style={{ width: `${COL}rem` }}
                >
                  <span className="text-xs text-muted-foreground">
                    {t(`calendarBoard.weekdays.${WD_KEYS[dt.getUTCDay()]}`)}
                  </span>
                  <span
                    className={`mt-1 flex size-8 items-center justify-center rounded-full text-base font-semibold ${
                      isToday ? "bg-accent text-white" : ""
                    }`}
                  >
                    {dt.getUTCDate()}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Objekt-Kopfzeile (Plan 5.1): Objekt-Titel + read-only
              Verfügbarkeits-Punkte, darunter die Plan-Zeilen. Der Titel klappt
              den Objekt-Block auf/zu; die Belegung selbst wird im Belegungsplan
              gepflegt, hier ist sie nur Kontext beim Preise-Setzen. */}
          <AvailabilityRow
            title={
              properties.find((pr) => pr.id === propertyId)?.title ?? ""
            }
            days={days}
            avail={avail}
            open={availOpen}
            onToggle={() => setAvailOpen((o) => !o)}
          />

          {availOpen &&
            grid?.plans.map((plan) => (
              <PlanRow
                key={plan.id}
                plan={plan}
                days={days}
                mode={mode}
                minStays={minStays}
                restrictions={restr}
                inDrag={inDrag}
                onDown={onDown}
                onEnter={onEnter}
                onResync={(id) => void resync(id)}
              />
            ))}
        </div>
        {grid && grid.plans.length === 0 && (
          <p className="p-6 text-center text-sm text-muted-foreground">
            {t("ratesView.empty")}
          </p>
        )}
        {!grid && (
          <p className="p-6 text-center text-sm text-muted-foreground">
            {t("calendarViews.loading")}
          </p>
        )}
      </div>
    </div>
  );
}

// Farben wie im Belegungsplan (SEG_STYLE) — dieselbe Wahrheit soll überall
// gleich aussehen. Stop-Sell = warning, belegt = accent, gesperrt = neutral.
const AVAIL_DOT: Record<AvailKind, string> = {
  open: "bg-success",
  booked: "bg-accent",
  blocked: "bg-neutral-700",
  stop: "bg-warning",
};

/** Objekt-Kopfzeile: Titel (klappt die Plan-Zeilen auf/zu) + read-only
 *  Verfügbarkeits-Punkte je Tag. Belegung/Sperren werden im Belegungsplan
 *  gepflegt — hier nur sichtbar, nie editierbar. */
function AvailabilityRow({
  title,
  days,
  avail,
  open,
  onToggle,
}: {
  title: string;
  days: string[];
  avail: Map<string, AvailKind>;
  open: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations("calendar");
  const label: Record<AvailKind, string> = {
    open: t("calendarBoard.status.open"),
    booked: t("calendarBoard.status.booked"),
    blocked: t("calendarBoard.status.blocked"),
    stop: t("calendarBoard.status.stopSell"),
  };
  return (
    <div className="flex border-b bg-secondary/30">
      {/* Die sticky Spalte MUSS deckend sein (bg-card wie die Plan-Zeilen):
          mit einem halbtransparenten Hintergrund scheinen die wegscrollenden
          Tagesspalten durch das Label hindurch. */}
      <div
        className="sticky left-0 z-20 flex shrink-0 items-center gap-2 border-r bg-card px-4 py-2"
        style={{ width: `${LABEL}rem` }}
      >
        <button
          type="button"
          onClick={onToggle}
          title={t("ratesView.availabilityLabel")}
          className="flex min-w-0 items-center gap-1.5 text-sm font-medium hover:text-accent"
          aria-expanded={open}
        >
          <Icon
            icon={open ? "ph:caret-down" : "ph:caret-right"}
            className="size-4 shrink-0"
          />
          <span className="truncate">{title}</span>
        </button>
      </div>
      {days.map((day) => {
        const kind = avail.get(day) ?? "open";
        return (
          <div
            key={day}
            title={label[kind]}
            className="flex shrink-0 items-center justify-center border-r py-2"
            style={{ width: `${COL}rem` }}
          >
            <span className={`size-2.5 rounded-full ${AVAIL_DOT[kind]}`} />
          </div>
        );
      })}
    </div>
  );
}

function PlanRow({
  plan,
  days,
  mode,
  minStays,
  restrictions,
  inDrag,
  onDown,
  onEnter,
  onResync,
}: {
  plan: RateGridResponse["plans"][number];
  days: string[];
  mode: Mode;
  minStays: Map<string, Map<string, number>>;
  restrictions: Map<string, Map<string, RatePlanRestrictionDay>>;
  inDrag: (planId: string, day: string) => boolean;
  onDown: (planId: string, day: string) => void;
  onEnter: (planId: string, day: string) => void;
  onResync: (planId: string) => void;
}) {
  const t = useTranslations("calendar");
  const byDate = new Map(plan.days.map((d) => [d.date, d]));
  const ms = minStays.get(plan.id);
  const rs = restrictions.get(plan.id);
  // Abgeleiteter Plan: im Preise-Modus sind die Zellen read-only (Preis folgt
  // dem Basis-Plan). Min-Stay/Restriktionen bleiben editierbar.
  const priceLocked = plan.price_read_only && mode === "prices";
  const offsetLabel = derivedOffsetLabel(plan);
  return (
    <div className="flex border-b last:border-b-0">
            <div
              className="sticky left-0 z-20 flex shrink-0 items-center gap-2 border-r bg-card px-4 py-2"
              style={{ width: `${LABEL}rem` }}
            >
              <span className="truncate text-sm font-medium">{plan.name}</span>
              {plan.rate_mode === "derived" ? (
                <span
                  title={t("ratesView.derivedFrom", {
                    parent: plan.derived_from_name ?? "",
                    offset: offsetLabel,
                  })}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground"
                >
                  <Icon icon="ph:link" className="size-3" />
                  {offsetLabel}
                </span>
              ) : (
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatCurrency(plan.base_price, plan.currency)}
                </span>
              )}
              {plan.sync_status === "pending" && (
                <button
                  type="button"
                  onClick={() => onResync(plan.id)}
                  title={t("ratesView.resyncTitle")}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning"
                >
                  <Icon icon="ph:clock-countdown" className="size-3.5" />
                  {t("ratesView.syncPending")}
                </button>
              )}
              {plan.sync_status === "synced" && (
                <span
                  title={t("ratesView.syncSynced")}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success"
                >
                  <Icon icon="ph:check-circle" className="size-3.5" />
                </span>
              )}
            </div>
            {days.map((day) => {
              const cell = byDate.get(day);
              const isOverride = cell?.source === "rate_plan";
              const selected = inDrag(plan.id, day);
              const msOverride = ms?.get(day);
              const rsDay = rs?.get(day);
              const hasRestriction =
                rsDay != null &&
                (rsDay.closed_to_arrival != null ||
                  rsDay.closed_to_departure != null ||
                  rsDay.max_stay != null);
              // Gleiche Preisdarstellung wie der Belegungsplan: Währung + zwei
              // Nachkommastellen („100,00 $"), nie nackte Zahlen.
              const shown =
                mode === "prices"
                  ? cell?.price != null
                    ? formatCurrency(cell.price, plan.currency)
                    : "—"
                  : String(msOverride ?? plan.min_stay);
              const overrideCell =
                mode === "prices"
                  ? isOverride
                  : mode === "minstay"
                    ? msOverride != null
                    : hasRestriction;
              const restrTitle = hasRestriction
                ? [
                  rsDay?.closed_to_arrival
                    ? t("monthGridView.arrivalBlocked")
                    : null,
                  rsDay?.closed_to_departure
                    ? t("monthGridView.departureBlocked")
                    : null,
                  rsDay?.max_stay != null
                    ? `${t("ratesView.maxStayLabel")}: ${rsDay.max_stay}`
                    : null,
                ].filter(Boolean).join(" · ")
                : undefined;
              return (
                <button
                  key={day}
                  type="button"
                  disabled={priceLocked}
                  onMouseDown={
                    priceLocked
                      ? undefined
                      : (e) => {
                          e.preventDefault();
                          onDown(plan.id, day);
                        }
                  }
                  onMouseEnter={
                    priceLocked ? undefined : () => onEnter(plan.id, day)
                  }
                  title={
                    priceLocked
                      ? t("ratesView.derivedReadOnly")
                      : mode === "prices" && cell
                        ? t(`ratesView.source.${cell.source}`)
                        : mode === "restrictions"
                          ? restrTitle
                          : undefined
                  }
                  className={`flex shrink-0 select-none items-center justify-center gap-0.5 border-r py-2 text-sm tabular-nums transition-colors ${
                    selected
                      ? "outline outline-2 -outline-offset-2 outline-accent"
                      : ""
                  } ${
                    priceLocked
                      ? "cursor-not-allowed bg-muted/40 text-muted-foreground"
                      : overrideCell
                        ? "bg-accent/10 font-semibold text-accent"
                        : "hover:bg-secondary/60"
                  } ${
                    mode === "minstay" && msOverride == null
                      ? "text-muted-foreground"
                      : ""
                  }`}
                  style={{ width: `${COL}rem` }}
                >
                  {mode === "restrictions" ? (
                    hasRestriction ? (
                      <>
                        {/* Sprachneutrale Kompaktdarstellung: ⇥ Anreise, ⇤ Abreise
                            gesperrt, ≤n Max-Stay — Details im Tooltip. */}
                        {rsDay?.closed_to_arrival ? (
                          <Icon icon="ph:sign-in" className="size-4 text-destructive" />
                        ) : null}
                        {rsDay?.closed_to_departure ? (
                          <Icon icon="ph:sign-out" className="size-4 text-destructive" />
                        ) : null}
                        {rsDay?.max_stay != null ? (
                          <span className="text-xs">≤{rsDay.max_stay}</span>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )
                  ) : (
                    shown
                  )}
                </button>
              );
            })}
    </div>
  );
}
