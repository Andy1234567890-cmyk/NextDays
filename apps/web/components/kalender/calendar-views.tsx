"use client";

// Top-Level-Umschalter des Kalenders: Timeline (bestehendes Board, unverändert)
// plus drei zusätzliche Ansichten — Buchungen (An-/Abreisen + Liste kombiniert),
// Monatsgitter, Auslastung. Die aktive Ansicht wird in der URL (?view=)
// persistiert, damit ein Reload/Teilen denselben Blick öffnet. Die Zusatzviews
// werden lazy geladen, so dass der Standard-Timeline-Blick nicht verzögert wird.
import dynamic from "next/dynamic";
import { Icon } from "@iconify/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

import { type Prop, CalendarBoard } from "@/components/kalender/calendar-board";

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
  { key: "timeline", label: "Timeline", icon: "ph:rows" },
  { key: "bookings", label: "Buchungen", icon: "ph:list-bullets" },
  { key: "month", label: "Monatsgitter", icon: "ph:calendar-blank" },
  { key: "occupancy", label: "Auslastung", icon: "ph:chart-bar" },
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

  return (
    <div className="flex flex-col gap-5">
      {/* Ansicht-Umschalter */}
      <div className="inline-flex flex-wrap gap-1 self-start rounded-full border bg-secondary p-0.5 text-sm">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => setView(v.key)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-medium transition-colors ${
              active === v.key
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon icon={v.icon} className="size-4" />
            {v.label}
          </button>
        ))}
      </div>

      {/* Timeline bleibt immer gemountet (Board hält eigenen State/Scroll); die
          Zusatzviews werden nur bei Bedarf gerendert. */}
      <div className={active === "timeline" ? "" : "hidden"}>
        <CalendarBoard properties={properties} />
      </div>
      {active === "bookings" && <CalendarBookingsView properties={properties} />}
      {active === "month" && <CalendarMonthGridView properties={properties} />}
      {active === "occupancy" && <CalendarOccupancyView properties={properties} />}
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
