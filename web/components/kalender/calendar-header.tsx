"use client";

// Kopfbereich des Kalenders: Titel links, dann
// ◀ Zurück · ▶ Vor · 📅 Heute, rechts ⚙️ Ansicht-anpassen (Drawer) und
// ＋ Erstellen (Menü). Eigenständiges Element, steuert das Raster über Props.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Button } from "@nextdays/ui/button";
import { NativeSelect } from "@nextdays/ui/native-select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@nextdays/ui/dropdown-menu";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@nextdays/ui/sheet";
import { Switch } from "@nextdays/ui/switch";

// Zeitfenster (sichtbare Tage). „Monat" = 28 als feste, gleichmäßige Breite
// (OPERA-Room-Diary-Stil; kalendarische Monatslänge bricht das Raster nicht).
// Beschriftung kommt aus i18n (calendar.header.range*); hier nur Wert + Schlüssel.
export const RANGE_OPTIONS = [
  { value: 1, key: "rangeDay" },
  { value: 7, key: "rangeWeek" },
  { value: 14, key: "rangeTwoWeeks" },
  { value: 28, key: "rangeMonth" },
] as const;

export type RangeDays = (typeof RANGE_OPTIONS)[number]["value"];

export type ViewOptions = {
  showPicture: boolean;
  showInternalName: boolean;
  showId: boolean;
  showPrice: boolean;
  showMinStay: boolean;
  // Debug: zeigt an jedem gesperrten/Stop-Sell-Tag die HERKUNFT (Quelle + Typ),
  // damit sichtbar ist, welche Plattform die Sperre gesetzt hat.
  showDebug: boolean;
  weekStart: "mon" | "sun";
  rangeDays: RangeDays;
};

export const DEFAULT_VIEW: ViewOptions = {
  showPicture: true,
  showInternalName: true,
  showId: false,
  showPrice: true,
  showMinStay: true,
  showDebug: false,
  weekStart: "mon",
  rangeDays: 28,
};

export function CalendarHeader({
  title,
  view,
  onView,
  onPrev,
  onNext,
  onToday,
  onJump,
  jumpValue,
  onCreate,
  viewSwitcher,
}: {
  title: { month: string; year: string };
  view: ViewOptions;
  onView: (v: ViewOptions) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onJump: (isoDate: string) => void;
  jumpValue: string; // YYYY-MM-DD des aktuellen Startdatums
  onCreate: (kind: "booking" | "blocked") => void;
  // Optionales Ansicht-Dropdown (Timeline/Buchungen/…), links neben dem Titel,
  // damit Ansicht + Titel + Navigation in EINER Kopfzeile sitzen.
  viewSwitcher?: ReactNode;
}) {
  const t = useTranslations("calendar");
  const set = <K extends keyof ViewOptions>(k: K, v: ViewOptions[K]) =>
    onView({ ...view, [k]: v });

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {/* Ansicht-Umschalter + Titel (links) */}
      <div className="flex items-center gap-3">
        {viewSwitcher}
        <h2 className="font-display text-2xl font-extrabold">
          {title.month} <span className="font-normal text-muted-foreground">{title.year}</span>
        </h2>
      </div>

      {/* Navigations- und Aktionsgruppe */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Zeitfenster (1/7/14/28-Monat) als kompaktes Dropdown statt Button-Reihe */}
        <NativeSelect
          value={view.rangeDays}
          onChange={(e) => set("rangeDays", Number(e.target.value) as RangeDays)}
          aria-label={t("header.timeframe")}
          className="h-9 w-auto rounded-full"
        >
          <option value="" disabled>
            {t("header.chooseTimeframe")}
          </option>
          {RANGE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {t(`header.${o.key}`)}
            </option>
          ))}
        </NativeSelect>

        {/* Datum-Sprung (natives Date-Picker) */}
        <input
          type="date"
          value={jumpValue}
          onChange={(e) => e.target.value && onJump(e.target.value)}
          aria-label={t("header.jumpToDate")}
          className="h-9 rounded-full border bg-background px-3 text-sm"
        />

        <Button variant="outline" size="icon" onClick={onPrev} aria-label={t("header.back")}>
          <Icon icon="ph:caret-left" className="size-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={onNext} aria-label={t("header.next")}>
          <Icon icon="ph:caret-right" className="size-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={onToday} aria-label={t("header.today")}>
          <Icon icon="ph:calendar-dot" className="size-4" />
        </Button>

        {/* Debug-Herkunft direkt umschaltbar (nicht im Drawer versteckt): zeigt an
            jedem Sperr-/Stop-Sell-Balken die Quelle. Aktiv = deutlich hervorgehoben. */}
        <Button
          variant="outline"
          size="icon"
          onClick={() => set("showDebug", !view.showDebug)}
          aria-label={t("header.debugBlocks")}
          title={t("header.debugBlocksShow")}
          className={
            view.showDebug
              ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
              : ""
          }
        >
          <Icon icon="ph:bug" className="size-4" />
        </Button>

        {/* Ansicht anpassen (Drawer) */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" aria-label={t("header.adjustView")}>
              <Icon icon="ph:sliders-horizontal" className="size-4" />
            </Button>
          </SheetTrigger>
          <SheetContent className="flex flex-col">
            <SheetHeader>
              <SheetTitle>{t("header.adjustView")}</SheetTitle>
              <SheetDescription>
                Wähle, welche Details im Kalender erscheinen.
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-4">
              <section className="flex flex-col gap-3">
                <p className="text-sm font-semibold">{t("header.propertyDetails")}</p>
                <ToggleRow label={t("header.showPhoto")} checked={view.showPicture} onChange={(v) => set("showPicture", v)} />
                <ToggleRow label={t("header.showInternalName")} checked={view.showInternalName} onChange={(v) => set("showInternalName", v)} />
                <ToggleRow label={t("header.showId")} checked={view.showId} onChange={(v) => set("showId", v)} />
              </section>

              <div className="h-px bg-border" />

              <section className="flex flex-col gap-3">
                <p className="text-sm font-semibold">Nacht-Details</p>
                <ToggleRow label={t("header.showPrice")} checked={view.showPrice} onChange={(v) => set("showPrice", v)} />
                <ToggleRow label={t("header.showMinStay")} checked={view.showMinStay} onChange={(v) => set("showMinStay", v)} />
                <ToggleRow label={t("header.debugBlocks")} checked={view.showDebug} onChange={(v) => set("showDebug", v)} />
              </section>

              <div className="h-px bg-border" />

              <section className="flex flex-col gap-3">
                <p className="text-sm font-semibold">{t("header.firstWeekday")}</p>
                <div className="flex gap-2">
                  <WeekBtn active={view.weekStart === "mon"} onClick={() => set("weekStart", "mon")}>Montag</WeekBtn>
                  <WeekBtn active={view.weekStart === "sun"} onClick={() => set("weekStart", "sun")}>Sonntag</WeekBtn>
                </div>
              </section>
            </div>

            <SheetFooter>
              <SheetClose asChild>
                <Button className="w-full">Fertig</Button>
              </SheetClose>
            </SheetFooter>
          </SheetContent>
        </Sheet>

        {/* Erstellen (Menü) */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" aria-label={t("header.create")}>
              <Icon icon="ph:plus" className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onCreate("booking")}>
              <Icon icon="ph:note-pencil" className="size-4" />
              Reservierung anlegen
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onCreate("blocked")}>
              <Icon icon="ph:calendar-x" className="size-4" />
              Sperrzeitraum anlegen
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
      <span>{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

function WeekBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      variant={active ? "default" : "outline"}
      size="sm"
      onClick={onClick}
      className="flex-1"
    >
      {children}
    </Button>
  );
}
