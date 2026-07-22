"use client";

// Seiten-Panel des Stop-Sell-Kalenders (Konvergenzmuster aller PMS:
// Auswahl → seitliches Panel statt Modal): Zeitraum (editierbar),
// Wochentags-Maske (Hostaway/Smoobu-Muster, Channex versteht sie nativ),
// Grund-Auswahl + Notiz (Guesty-Muster) und Setzen/Aufheben.
// Portal-Stopps (source=channex) sind read-only und werden nie überschrieben.
import { Icon } from "@iconify/react";
import { useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";
import { NativeSelect } from "@nextdays/ui/native-select";
import {
  bulkRestrictions,
  clearStopSell,
  setStopSell,
  type StopSellDay,
} from "@/lib/calendar";
import { isoPlus, isoWeekday } from "@/lib/dates";

export type AgencyOption = { id: string; name: string };

export type StopSellSelection = {
  propertyId: string;
  propertyTitle: string;
  start: string; // YYYY-MM-DD, inklusiv
  end: string; // YYYY-MM-DD, inklusiv
  // Hotel: die gewählte Zeile ist ein Rate-Plan (Kategorie — Plan). Der Stopp
  // trifft dann GENAU diesen Plan (bulk-restrictions, ein Portale-Call) statt
  // der Objekt-Ebene. Undefined = Objekt-Zeile (Ferienwohnung).
  ratePlan?: { id: string; label: string };
};

// Grund-Auswahl wie Guesty (Owner block / Maintenance / Do not sell / Other);
// gespeichert wird der lokalisierte Text als reason-Freitext (+ Notiz).
const REASON_KEYS = ["reasonOwner", "reasonMaintenance", "reasonDoNotSell", "reasonOther"] as const;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Tage in [start..end] (beide inklusiv), optional auf Wochentage gefiltert.
 *  Unvollständige Eingaben (geleertes Datumsfeld) → leere Liste statt
 *  Invalid-Date-Crash im Render. */
function daysBetween(start: string, end: string, weekdays: Set<number>): string[] {
  if (!ISO_DATE.test(start) || !ISO_DATE.test(end)) return [];
  const out: string[] = [];
  for (let d = start; d <= end; d = isoPlus(d, 1)) {
    if (weekdays.size === 7 || weekdays.has(isoWeekday(d))) out.push(d);
  }
  return out;
}

export function StopSellPanel({
  selection,
  stops,
  bookedDates,
  agencies,
  onClose,
  onDone,
}: {
  selection: StopSellSelection;
  /** Alle Stop-Sell-Tage des Objekts (der Kalender hält sie ohnehin vor). */
  stops: StopSellDay[];
  /** Gebuchte Tage (ISO) des Objekts — für Stop-Sell tabu, werden aus der
   *  Auswahl ausgeschlossen und als Überschneidung gemeldet. */
  bookedDates: Set<string>;
  /** Reisebüros/Veranstalter als Adressaten der Stop-Sell-Meldung. */
  agencies: AgencyOption[];
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("stopSell");
  const locale = useLocale();
  const [from, setFrom] = useState(selection.start);
  const [to, setTo] = useState(selection.end);
  const [weekdays, setWeekdays] = useState<Set<number>>(
    new Set([0, 1, 2, 3, 4, 5, 6]),
  );
  const [reasonKey, setReasonKey] = useState<(typeof REASON_KEYS)[number] | null>(null);
  const [note, setNote] = useState("");
  // Adressat der Stop-Sell-Meldung ("" = alle Reiseanbieter).
  const [agencyId, setAgencyId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Wochentagskürzel in der Nutzersprache (2024-01-01 ist ein Montag).
  const weekdayLabels = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
    return Array.from({ length: 7 }, (_, i) =>
      fmt.format(new Date(Date.UTC(2024, 0, 1 + i))),
    );
  }, [locale]);

  // Alle Tage im Zeitraum (vor Buchungs-Filter) — für die Überschneidungs-Zählung.
  const rangeDays = useMemo(
    () => (from <= to ? daysBetween(from, to, weekdays) : []),
    [from, to, weekdays],
  );
  // Gebuchte Tage sind für Stop-Sell tabu → aus der wirksamen Auswahl raus.
  const bookedInRange = useMemo(
    () => rangeDays.filter((d) => bookedDates.has(d)),
    [rangeDays, bookedDates],
  );
  const affected = useMemo(
    () => rangeDays.filter((d) => !bookedDates.has(d)),
    [rangeDays, bookedDates],
  );
  const affectedSet = useMemo(() => new Set(affected), [affected]);
  const ratePlan = selection.ratePlan;
  // Plan-Zeile: für „Aufheben" zählen nur die Stops GENAU dieses Plans — ein
  // Objekt-Stopp (gilt allen Plänen) lässt sich hier nicht plan-genau lösen.
  const manualInRange = stops.filter(
    (s) =>
      s.source === "manual" &&
      affectedSet.has(s.date) &&
      (!ratePlan || s.rate_plan_id === ratePlan.id),
  );
  const channexInRange = stops.filter(
    (s) => s.source === "channex" && affectedSet.has(s.date),
  );

  // Zusammenhängende [von, bis]-Bereiche (beide inkl.) der wirksamen Tage —
  // eine Wochentags-Maske wird so zu mehreren Zeilen im EINEN Portale-Call.
  const affectedRanges = useMemo(() => {
    const out: [string, string][] = [];
    for (const d of affected) {
      const last = out[out.length - 1];
      if (last && isoPlus(last[1], 1) === d) last[1] = d;
      else out.push([d, d]);
    }
    return out;
  }, [affected]);

  const weekdayArg =
    weekdays.size === 7 ? undefined : Array.from(weekdays).sort((a, b) => a - b);

  function toggleWeekday(i: number) {
    setWeekdays((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function onApply() {
    setError(null);
    startTransition(async () => {
      const reason = reasonKey
        ? t(reasonKey) + (note.trim() ? ` — ${note.trim()}` : "")
        : note.trim() || undefined;
      // Plan-Zeile (Hotel): Stopp GENAU für diesen Rate-Plan über den
      // gebündelten Restriktions-Weg — alle Bereiche in EINEM Portale-Call.
      const res = ratePlan
        ? await bulkRestrictions(
          selection.propertyId,
          affectedRanges.map(([s, e]) => ({
            start: s,
            end: isoPlus(e, 1), // exklusiv
            rate_plan_id: ratePlan.id,
            stop_sell: true,
            ...(reason ? { reason } : {}),
          })),
        )
        : await setStopSell(
          selection.propertyId, from, isoPlus(to, 1), reason, weekdayArg,
          agencyId || undefined,
        );
      if (res.ok) onDone();
      else setError(res.error);
    });
  }

  function onClear(includePortal = false) {
    setError(null);
    startTransition(async () => {
      const res = ratePlan
        ? await bulkRestrictions(
          selection.propertyId,
          affectedRanges.map(([s, e]) => ({
            start: s,
            end: isoPlus(e, 1),
            rate_plan_id: ratePlan.id,
            stop_sell: false,
          })),
        )
        : await clearStopSell(
          selection.propertyId, from, isoPlus(to, 1), weekdayArg, includePortal,
        );
      if (res.ok) onDone();
      else setError(res.error);
    });
  }

  return (
    <aside className="flex w-full shrink-0 flex-col gap-4 rounded-(--radius) border border-border bg-card p-4 lg:w-80">
      <header className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <span className="text-sm font-semibold">{t("selection")}</span>
          <span className="truncate text-xs text-muted-foreground">
            {ratePlan
              ? `${selection.propertyTitle} · ${ratePlan.label}`
              : selection.propertyTitle}
          </span>
        </div>
        <button
          type="button"
          aria-label={t("close")}
          onClick={onClose}
          className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground"
        >
          <Icon icon="ph:x" className="size-4" />
        </button>
      </header>

      {/* Zeitraum (inklusive Enden — wie im Kalender ausgewählt) */}
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">{t("from")}</span>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">{t("toIncl")}</span>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>

      {/* Wochentags-Maske (alle an = ganzer Zeitraum) */}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">
          {t("weekdaysLabel")}
        </span>
        <div className="flex flex-wrap gap-1">
          {weekdayLabels.map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => toggleWeekday(i)}
              className={
                "rounded-full px-2.5 py-1 text-xs font-medium transition " +
                (weekdays.has(i)
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground")
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Adressat: Reisebüro/Veranstalter (Touristik: Stop-Sell-Meldung an
          den Partner); leer = gilt allen Kanälen. Objekt-Ebene only — ein
          plan-genauer Hotel-Stopp kennt keinen Partner-Adressaten. */}
      {!ratePlan && agencies.length > 0 && (
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            {t("agencyLabel")}
          </span>
          <NativeSelect value={agencyId} onChange={(e) => setAgencyId(e.target.value)}>
            <option value="">{t("agencyAll")}</option>
            {agencies.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </NativeSelect>
        </label>
      )}

      {/* Grund (Guesty-Muster) + Notiz */}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">{t("reasonLabel")}</span>
        <div className="flex flex-wrap gap-1">
          {REASON_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setReasonKey((prev) => (prev === key ? null : key))}
              className={
                "rounded-full px-2.5 py-1 text-xs font-medium transition " +
                (reasonKey === key
                  ? "bg-foreground text-background"
                  : "bg-secondary text-muted-foreground hover:text-foreground")
              }
            >
              {t(key)}
            </button>
          ))}
        </div>
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t("noteLabel")}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        {t("daysAffected", { n: affected.length })}
      </p>

      {bookedInRange.length > 0 && (
        <p className="flex items-start gap-2 rounded-(--radius) bg-accent/10 px-3 py-2 text-xs text-accent-foreground">
          <Icon icon="ph:calendar-check" className="mt-0.5 size-3.5 shrink-0" />
          {t("bookedInRange", { n: bookedInRange.length })}
        </p>
      )}
      {channexInRange.length > 0 && (
        <p className="flex items-start gap-2 rounded-(--radius) bg-muted px-3 py-2 text-xs text-muted-foreground">
          <Icon icon="ph:lock-simple" className="mt-0.5 size-3.5 shrink-0" />
          {t("channexInRange", { n: channexInRange.length })}
        </p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="mt-auto flex flex-col gap-2">
        <Button onClick={onApply} disabled={pending || affected.length === 0}>
          <Icon icon="ph:hand-palm" className="size-4" />
          {t("apply")}
        </Button>
        {/* Aufheben (manuell): die selbst gesetzten Stops im Zeitraum löschen.
            Portal-/Channex-Stops bleiben (dafür der zweite Button unten). */}
        {manualInRange.length > 0 && (
          <Button
            variant="destructive"
            onClick={() => onClear(false)}
            disabled={pending}
          >
            <Icon icon="ph:trash" className="size-4" />
            {t("clearRange", { n: manualInRange.length })}
          </Button>
        )}
        {/* Auch Portal-Stops aufheben: entfernt zusätzlich die Channex/Portal-
            Stops und öffnet die Tage an den OTAs. Für versehentlich gesetzte
            Stops — daher separater, klar benannter Button mit Warnung. */}
        {/* Portal-Stops mit aufheben: nur Objekt-Ebene — der include_portal-Weg
            löscht objekt-weit; für Plan-Zeilen wäre das zu grob. */}
        {!ratePlan && channexInRange.length > 0 && (
          <>
            <Button
              variant="outline"
              onClick={() => onClear(true)}
              disabled={pending}
              className="border-destructive text-destructive hover:bg-destructive/10"
            >
              <Icon icon="ph:lock-simple-open" className="size-4" />
              {t("clearPortalRange", { n: channexInRange.length })}
            </Button>
            <p className="text-xs text-muted-foreground">
              {t("clearPortalHint")}
            </p>
          </>
        )}
      </div>
    </aside>
  );
}
