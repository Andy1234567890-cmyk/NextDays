"use client";

// Kopfbereich des Kalenders (wie Lodgify): Titel links, dann
// ◀ Zurück · ▶ Vor · 📅 Heute, rechts ⚙️ Ansicht-anpassen (Drawer) und
// ＋ Erstellen (Menü). Eigenständiges Element, steuert das Raster über Props.
import { Icon } from "@iconify/react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";

export type ViewOptions = {
  showPicture: boolean;
  showInternalName: boolean;
  showId: boolean;
  showPrice: boolean;
  showMinStay: boolean;
  weekStart: "mon" | "sun";
};

export const DEFAULT_VIEW: ViewOptions = {
  showPicture: true,
  showInternalName: true,
  showId: false,
  showPrice: true,
  showMinStay: true,
  weekStart: "mon",
};

export function CalendarHeader({
  title,
  view,
  onView,
  onPrev,
  onNext,
  onToday,
  onCreate,
}: {
  title: { month: string; year: string };
  view: ViewOptions;
  onView: (v: ViewOptions) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onCreate: (kind: "booking" | "blocked") => void;
}) {
  const set = <K extends keyof ViewOptions>(k: K, v: ViewOptions[K]) =>
    onView({ ...view, [k]: v });

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {/* Titel */}
      <h2 className="font-display text-2xl font-extrabold">
        {title.month} <span className="font-normal text-muted-foreground">{title.year}</span>
      </h2>

      {/* Navigations- und Aktionsgruppe */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={onPrev} aria-label="Zurück">
          <Icon icon="ph:caret-left" className="size-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={onNext} aria-label="Vor">
          <Icon icon="ph:caret-right" className="size-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={onToday} aria-label="Heute">
          <Icon icon="ph:calendar-dot" className="size-4" />
        </Button>

        {/* Ansicht anpassen (Drawer) */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Ansicht anpassen">
              <Icon icon="ph:sliders-horizontal" className="size-4" />
            </Button>
          </SheetTrigger>
          <SheetContent className="flex flex-col">
            <SheetHeader>
              <SheetTitle>Ansicht anpassen</SheetTitle>
              <SheetDescription>
                Wähle, welche Details im Kalender erscheinen.
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-4">
              <section className="flex flex-col gap-3">
                <p className="text-sm font-semibold">Objekt-Details</p>
                <ToggleRow label="Foto zeigen" checked={view.showPicture} onChange={(v) => set("showPicture", v)} />
                <ToggleRow label="Internen Namen zeigen" checked={view.showInternalName} onChange={(v) => set("showInternalName", v)} />
                <ToggleRow label="ID-Nummer zeigen" checked={view.showId} onChange={(v) => set("showId", v)} />
              </section>

              <div className="h-px bg-border" />

              <section className="flex flex-col gap-3">
                <p className="text-sm font-semibold">Nacht-Details</p>
                <ToggleRow label="Preis zeigen" checked={view.showPrice} onChange={(v) => set("showPrice", v)} />
                <ToggleRow label="Mindestaufenthalt zeigen" checked={view.showMinStay} onChange={(v) => set("showMinStay", v)} />
              </section>

              <div className="h-px bg-border" />

              <section className="flex flex-col gap-3">
                <p className="text-sm font-semibold">Erster Wochentag</p>
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
            <Button size="icon" aria-label="Erstellen">
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
