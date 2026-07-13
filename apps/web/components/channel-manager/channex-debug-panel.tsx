"use client";

// Sichtbares Flow-Debugging für die Portale-Anbindung (Channex): zeigt jeden
// Sync-Call in Echtzeit — Schritt, Status, Dauer, erzeugte Portal-ID, Request/
// Response ausklappbar. Live über useRealtime auf channex_debug_log (kein
// Polling). White-label: „Channex" bleibt intern, UI spricht von „Portalen".
import { Icon } from "@iconify/react";
import { useCallback, useEffect, useState } from "react";

import {
  type ChannexDebugEntry,
  listChannexDebugTrace,
} from "@/lib/channex";
import { useRealtime } from "@/lib/use-realtime";

const STEP_LABEL: Record<string, string> = {
  property: "Objekt",
  property_update: "Objekt (Update)",
  room_type: "Zimmertyp",
  rate_plan: "Preisplan",
  taxes: "Steuern",
  availability: "Verfügbarkeit",
  restrictions: "Preise/Restriktionen",
  channel: "Kanal",
  booking: "Buchung",
  group: "Gruppe",
  call: "Aufruf",
};

function stepLabel(step: string): string {
  return STEP_LABEL[step] ?? step;
}

export function ChannexDebugPanel({
  initial,
}: {
  initial: ChannexDebugEntry[];
}) {
  const [items, setItems] = useState<ChannexDebugEntry[]>(initial);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await listChannexDebugTrace(undefined, 100);
    if (res.ok) setItems(res.data.items);
  }, []);

  // Realtime-Pflicht: jeder neue Portal-Call erscheint sofort (kein Reload).
  useRealtime({ table: "channex_debug_log", onChange: () => void load() });

  // Direkt nach Mount einmal frisch laden (falls seit SSR neue Calls kamen).
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <header className="flex items-center justify-between">
        <div className="flex flex-col">
          <h2 className="text-lg font-semibold">Portale-Sync-Verlauf</h2>
          <p className="text-sm text-muted-foreground">
            Jeder Übertragungs-Schritt an die Buchungsportale — live, mit
            Anfrage, Antwort und erzeugter Portal-ID.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
        >
          <Icon icon="ph:arrows-clockwise" className="size-4" />
          Aktualisieren
        </button>
      </header>

      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Noch keine Übertragungen. Sobald ein Objekt an die Portale gesendet
          wird, erscheinen die Schritte hier.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {items.map((e) => {
            const open = openId === e.id;
            return (
              <li key={e.id} className="py-2">
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : e.id)}
                  className="flex w-full items-center gap-3 text-left"
                >
                  <span
                    className={`flex size-6 shrink-0 items-center justify-center rounded-full ${
                      e.ok
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-destructive/15 text-destructive"
                    }`}
                  >
                    <Icon
                      icon={e.ok ? "ph:check-bold" : "ph:x-bold"}
                      className="size-3.5"
                    />
                  </span>
                  <span className="w-36 shrink-0 text-sm font-medium">
                    {stepLabel(e.step)}
                  </span>
                  <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                    {e.channex_method} {e.channex_path}
                  </span>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                    {e.http_status ?? "—"}
                    {e.duration_ms != null ? ` · ${e.duration_ms} ms` : ""}
                  </span>
                  <Icon
                    icon={open ? "ph:caret-up" : "ph:caret-down"}
                    className="size-4 shrink-0 text-muted-foreground"
                  />
                </button>

                {e.channex_id && (
                  <p className="ml-9 mt-0.5 font-mono text-xs text-muted-foreground">
                    Portal-ID: {e.channex_id}
                  </p>
                )}
                {e.error && (
                  <p className="ml-9 mt-0.5 text-xs text-destructive">
                    {e.error}
                  </p>
                )}
                {e.created_at && (
                  <p className="ml-9 mt-0.5 text-xs text-muted-foreground">
                    {new Date(e.created_at).toLocaleString("de-DE")}
                  </p>
                )}

                {open && (
                  <div className="ml-9 mt-2 flex flex-col gap-2">
                    <JsonBlock title="Anfrage" value={e.request_body} />
                    <JsonBlock title="Antwort" value={e.response_body} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  if (value == null) return null;
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{title}</span>
      <pre className="max-h-64 overflow-auto rounded bg-muted p-2 font-mono text-xs">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
