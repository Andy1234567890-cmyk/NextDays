"use client";

// Top-Level-Umschalter des Kalenders: Timeline (bestehendes Board, unverändert)
// plus drei zusätzliche Ansichten — Buchungen (An-/Abreisen + Liste kombiniert),
// Monatsgitter, Auslastung. Die aktive Ansicht wird in der URL (?view=)
// persistiert, damit ein Reload/Teilen denselben Blick öffnet. Die Zusatzviews
// werden lazy geladen, so dass der Standard-Timeline-Blick nicht verzögert wird.
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

import { type Prop, CalendarBoard } from "@/components/kalender/calendar-board";
import { NativeSelect } from "@/components/ui/native-select";

// Lazy: nur laden, wenn die jeweilige Ansicht aktiv ist.
const CalendarBookingsView = dynamic(
  () => import("@/components/kalender/views/bookings-view").then((m) => m.CalendarBookingsView),
  { loading: () => <ViewSkeleton /> },
);
const CalendarMonthGridView = dynamic(
  () => import("@/components/kalender/views/month-grid-view").then((m) => m.CalendarMonthGridView),
  { loading: () => <ViewSkeleton /> },
);
const CalendarOccupancyView = dynamic(
  () => import("@/components/kalender/views/occupancy-view").then((m) => m.CalendarOccupancyView),
  { loading: () => <ViewSkeleton /> },
);

const VIEWS = [
  { key: "timeline", label: "Timeline" },
  { key: "bookings", label: "Buchungen" },
  { key: "month", label: "Monatsgitter" },
  { key: "occupancy", label: "Auslastung" },
] as const;

type ViewKey = (typeof VIEWS)[number]["key"];

function isViewKey(v: string | null): v is ViewKey {
  return VIEWS.some((x) => x.key === v);
}

// Alte gespeicherte Links auf die getrennten Ansichten weiter gültig halten:
// ?view=list und ?view=arrivals zeigen jetzt auf die kombinierte „Buchungen".
function normalizeView(v: string | null): ViewKey {
  if (v === "list" || v === "arrivals") return "bookings";
  return isViewKey(v) ? v : "timeline";
}

export function CalendarViews({ properties }: { properties: Prop[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const active: ViewKey = normalizeView(params.get("view"));

  const setView = useCallback(
    (key: ViewKey) => {
      const next = new URLSearchParams(params.toString());
      if (key === "timeline") next.delete("view");
      else next.set("view", key);
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  // Ansicht-Dropdown — einmal definiert, an der passenden Stelle gerendert.
  // Erste Zeile ist ein nicht-wählbarer Platzhalter „Ansicht wählen…", damit das
  // Feld klar als Auswahl erkennbar ist; der aktive Wert bleibt darunter sichtbar.
  const viewSwitcher = (
    <NativeSelect
      value={active}
      onChange={(e) => setView(e.target.value as ViewKey)}
      aria-label="Ansicht"
      className="h-9 w-auto rounded-full font-medium"
    >
      <option value="" disabled>
        Ansicht wählen…
      </option>
      {VIEWS.map((v) => (
        <option key={v.key} value={v.key}>
          {v.label}
        </option>
      ))}
    </NativeSelect>
  );

  return (
    <div className="flex flex-col gap-5">
      {/* Timeline: das Ansicht-Dropdown sitzt in der Board-Kopfzeile (links neben
          dem Titel) — eine saubere Kopfzeile. Die Timeline bleibt immer gemountet
          (Board hält eigenen State/Scroll). */}
      <div className={active === "timeline" ? "" : "hidden"}>
        <CalendarBoard properties={properties} viewSwitcher={viewSwitcher} />
      </div>

      {/* Andere Views haben keine Board-Kopfzeile → eigene schlanke Zeile mit
          dem Ansicht-Dropdown darüber. */}
      {active !== "timeline" && (
        <>
          <div className="flex items-center">{viewSwitcher}</div>
          {active === "bookings" && <CalendarBookingsView properties={properties} />}
          {active === "month" && <CalendarMonthGridView properties={properties} />}
          {active === "occupancy" && <CalendarOccupancyView properties={properties} />}
        </>
      )}
    </div>
  );
}

function ViewSkeleton() {
  return (
    <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
      Lädt…
    </div>
  );
}
