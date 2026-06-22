"use client";

// Echtes Realtime (Supabase WebSocket, kein Polling). Abonniert postgres_changes
// einer Tabelle und ruft bei jedem INSERT/UPDATE/DELETE den Callback. RLS gilt:
// der Client empfängt nur Zeilen seines Tenants (current_tenant_id() aus dem JWT).
import { useEffect, useRef } from "react";

import { createClient } from "@/lib/supabase/client";

type RealtimeOpts = {
  /** Tabelle in public, z.B. "channex_booking". */
  table: string;
  /** Optionaler Server-Filter, z.B. `thread_id=eq.${id}`. */
  filter?: string;
  /** Wird bei jeder relevanten Änderung aufgerufen. */
  onChange: () => void;
  /** Abo nur aktiv, wenn true (default true). */
  enabled?: boolean;
};

export function useRealtime({ table, filter, onChange, enabled = true }: RealtimeOpts) {
  // Callback in ref halten, damit das Abo nicht bei jedem Render neu aufgebaut wird.
  const cb = useRef(onChange);
  cb.current = onChange;

  useEffect(() => {
    if (!enabled) return;
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    (async () => {
      // Realtime mit dem User-JWT verbinden (sonst läuft das Abo als anon und
      // RLS liefert nichts).
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token) {
        supabase.realtime.setAuth(session.access_token);
      }
      if (cancelled) return;

      channel = supabase
        .channel(`rt:${table}:${filter ?? "all"}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table, ...(filter ? { filter } : {}) },
          () => cb.current(),
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [table, filter, enabled]);
}
