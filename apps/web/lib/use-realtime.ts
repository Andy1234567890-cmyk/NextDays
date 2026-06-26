"use client";

// Echtes Realtime (Supabase WebSocket, kein Polling). Abonniert postgres_changes
// einer Tabelle und ruft bei jedem INSERT/UPDATE/DELETE den Callback. RLS gilt:
// der Client empfängt nur Zeilen seines Tenants (current_tenant_id() aus dem JWT).
import { useEffect, useRef } from "react";

import { currentToken } from "@/lib/session-token";
import { createClient } from "@/lib/supabase/client";

// Modul-globaler Zähler für eindeutige Channel-Namen. Mehrere Komponenten dürfen
// dieselbe Tabelle abonnieren (z. B. Timeline + Listenansicht gleichzeitig);
// ohne eindeutigen Namen teilten sie sich EINEN Supabase-Channel und der zweite
// .on() nach subscribe() wirft „cannot add postgres_changes callbacks … after
// subscribe()". Jede Hook-Instanz bekommt daher ihren eigenen Channel.
let channelSeq = 0;

type RealtimeOpts = {
  /** Tabelle in public, z.B. "channex_booking". */
  table: string;
  /** Optionaler Server-Filter, z.B. `thread_id=eq.${id}`. */
  filter?: string;
  /** Wird bei jeder relevanten Änderung aufgerufen. */
  onChange: () => void;
  /** Abo nur aktiv, wenn true (default true). */
  enabled?: boolean;
  /**
   * Events innerhalb dieses Fensters (ms) zu EINEM onChange zusammenfassen.
   * Schützt vor Reload-Fluten, wenn ein Sync viele Zeilen auf einmal schreibt
   * (z. B. OTA-ARI-Import: 365 availability-Zeilen). Default 400ms.
   */
  debounceMs?: number;
};

export function useRealtime({
  table,
  filter,
  onChange,
  enabled = true,
  debounceMs = 400,
}: RealtimeOpts) {
  // Callback in ref halten, damit das Abo nicht bei jedem Render neu aufgebaut wird.
  const cb = useRef(onChange);
  cb.current = onChange;

  // Eindeutige, über die Lebensdauer stabile ID dieser Hook-Instanz — damit zwei
  // Komponenten mit derselben Tabelle nicht denselben Channel-Namen erzeugen.
  const uidRef = useRef<number | null>(null);
  if (uidRef.current === null) {
    channelSeq += 1;
    uidRef.current = channelSeq;
  }
  const uid = uidRef.current;

  useEffect(() => {
    if (!enabled) return;
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    // Debounce: viele Events kurz hintereinander → ein onChange.
    let timer: ReturnType<typeof setTimeout> | null = null;
    const fire = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => cb.current(), debounceMs);
    };

    (async () => {
      // Realtime mit dem echten App-Token verbinden (sonst läuft das Abo als
      // anon und RLS liefert nichts). Token-Quelle ist currentToken():
      // bevorzugt das FastAPI-Cookie nd_access (Haupt-Login), sonst die
      // Supabase-OAuth-Session — genau wie bei allen anderen API-Aufrufen.
      const token = await currentToken();
      if (token) {
        supabase.realtime.setAuth(token);
      }
      if (cancelled) return;

      channel = supabase
        .channel(`rt:${table}:${filter ?? "all"}:${uid}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table, ...(filter ? { filter } : {}) },
          () => fire(),
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (channel) supabase.removeChannel(channel);
    };
  }, [table, filter, enabled, debounceMs, uid]);
}
