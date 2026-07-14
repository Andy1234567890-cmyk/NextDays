"use client";

// Sichtbares Realtime-Debugging: fixes Overlay unten rechts, das LIVE zeigt, ob
// die Supabase-WebSocket-Verbindung steht, welchen Status jede Subscription hat
// (SUBSCRIBED / CHANNEL_ERROR / TIMED_OUT / CLOSED) und ob Events ankommen.
// Ohne das sieht man nicht, warum Realtime nicht aktualisiert — genau das war
// bisher das Problem. Ampel: grün = alle SUBSCRIBED, gelb = verbindet, rot =
// Fehler. Aufklappbar für die Detail-Liste je Tabelle.
import { Icon } from "@iconify/react";
import { useSyncExternalStore, useState } from "react";

import {
  type RealtimeSubState,
  getRealtimeDebugState,
  subscribeRealtimeDebug,
} from "@/lib/use-realtime";

function useRealtimeDebugState(): RealtimeSubState[] {
  return useSyncExternalStore(
    subscribeRealtimeDebug,
    getRealtimeDebugState,
    () => [] as RealtimeSubState[],
  );
}

type Tone = "green" | "amber" | "red" | "gray";

function overallTone(subs: RealtimeSubState[]): Tone {
  if (subs.length === 0) return "gray";
  if (subs.some((s) => s.status === "CHANNEL_ERROR" || s.status === "TIMED_OUT")) {
    return "red";
  }
  if (subs.every((s) => s.status === "SUBSCRIBED")) return "green";
  return "amber";
}

const TONE_DOT: Record<Tone, string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  gray: "bg-neutral-400",
};

function statusColor(status: string): string {
  if (status === "SUBSCRIBED") return "text-emerald-600";
  if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") return "text-red-600";
  if (status === "CLOSED") return "text-neutral-500";
  return "text-amber-600";
}

export function RealtimeDebugPanel() {
  const subs = useRealtimeDebugState();
  const [open, setOpen] = useState(false);
  const tone = overallTone(subs);
  const subscribed = subs.filter((s) => s.status === "SUBSCRIBED").length;
  const totalEvents = subs.reduce((n, s) => n + s.events, 0);

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col items-end gap-2">
      {open && (
        <div className="max-h-[60vh] w-80 overflow-auto rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold">Realtime-Status</span>
            <span className="text-xs text-muted-foreground">
              {subscribed}/{subs.length} aktiv · {totalEvents} Events
            </span>
          </div>
          {subs.length === 0 ? (
            <p className="py-3 text-center text-xs text-muted-foreground">
              Keine aktiven Realtime-Abos auf dieser Seite.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {subs.map((s) => (
                <li key={s.uid} className="flex flex-col gap-0.5 py-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-mono text-xs" title={s.table}>
                      {s.table}
                      {s.filter ? (
                        <span className="text-muted-foreground"> · {s.filter}</span>
                      ) : null}
                    </span>
                    <span className={`shrink-0 text-xs font-medium ${statusColor(s.status)}`}>
                      {s.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span>{s.events} Events</span>
                    <span>{s.hasToken ? "Token ✓" : "kein Token"}</span>
                    {s.lastEventAt ? (
                      <span>
                        zuletzt {Math.round((Date.now() - s.lastEventAt) / 1000)}s
                      </span>
                    ) : null}
                  </div>
                  {s.error ? (
                    <span className="text-[11px] text-red-600">{s.error}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-border bg-popover px-3 py-1.5 text-xs font-medium text-popover-foreground shadow-lg"
        title="Realtime-Debug"
      >
        <span className={`size-2.5 rounded-full ${TONE_DOT[tone]}`} />
        <Icon icon="ph:broadcast" className="size-4" />
        Realtime
        <span className="text-muted-foreground">
          {subscribed}/{subs.length}
        </span>
      </button>
    </div>
  );
}
