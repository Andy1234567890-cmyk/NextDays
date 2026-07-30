"use client";

// Echtes Realtime (Supabase WebSocket, kein Polling). Abonniert postgres_changes
// einer Tabelle und ruft bei jedem INSERT/UPDATE/DELETE den Callback. RLS gilt:
// der Client empfängt nur Zeilen seines Tenants (current_tenant_id() aus dem JWT).
// Portiert aus gastgeber/lib/use-realtime.ts — Token-Quelle ist hier das
// Admin-Cookie (__Host-nd_admin), nicht das Host-Cookie des Gastgebers.
import {
  type SupabaseClient,
  createClient as createSupabaseClient,
} from "@supabase/supabase-js";
import { useEffect, useRef } from "react";

import { adminSessionToken } from "@/lib/session";

// Dedizierter Realtime-Client (Modul-Singleton, NUR für Realtime). Verifiziert:
// realtime.setAuth(App-JWT) MUSS VOR .subscribe() laufen, sonst joint der Channel
// als anon (RLS default-deny → 0 Events). Kein eigenes Session-Handling.
let rtClient: SupabaseClient | null = null;
function realtimeClient(): SupabaseClient {
  if (!rtClient) {
    rtClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      },
    );
  }
  return rtClient;
}

/** Derselbe Realtime-Client für Broadcast-/Presence-Kanäle (eine Verbindung). */
export function getRealtimeClient(): SupabaseClient {
  return realtimeClient();
}

// Eindeutige Channel-Namen: mehrere Komponenten dürfen dieselbe Tabelle
// abonnieren; ohne eindeutigen Namen teilten sie EINEN Channel und der zweite
// .on() nach subscribe() würde werfen.
let channelSeq = 0;

export type RealtimePayload<T = Record<string, unknown>> = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: T | Record<string, never>;
  old: Partial<T> | Record<string, never>;
};

type RealtimeOpts<T = Record<string, unknown>> = {
  /** Tabelle in public, z. B. "reservations". */
  table: string;
  /** Optionaler Server-Filter, z. B. `property_id=eq.${id}`. */
  filter?: string;
  /** Vollreload-Modus (debounced): bei jeder Änderung ohne Payload. */
  onChange?: () => void;
  /** Inkrementeller Modus (un-debounced): pro Event mit rohem Payload. */
  onEvent?: (payload: RealtimePayload<T>) => void;
  /** Abo nur aktiv, wenn true (default true). */
  enabled?: boolean;
  /** onChange-Events innerhalb dieses Fensters (ms) zu einem bündeln. */
  debounceMs?: number;
};

export function useRealtime<T = Record<string, unknown>>({
  table,
  filter,
  onChange,
  onEvent,
  enabled = true,
  debounceMs = 400,
}: RealtimeOpts<T>) {
  const cb = useRef(onChange);
  cb.current = onChange;
  const evCb = useRef(onEvent);
  evCb.current = onEvent;

  const uidRef = useRef<number | null>(null);
  if (uidRef.current === null) {
    channelSeq += 1;
    uidRef.current = channelSeq;
  }
  const uid = uidRef.current;

  const wasDisabled = useRef(false);

  useEffect(() => {
    if (!enabled) {
      wasDisabled.current = true;
      return;
    }
    const supabase = realtimeClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const fireChange = () => {
      if (!cb.current) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => cb.current?.(), debounceMs);
    };

    if (wasDisabled.current) {
      wasDisabled.current = false;
      fireChange();
    }

    (async () => {
      // App-JWT VOR dem Subscribe setzen (RLS-Claims beim JOIN). Token aus dem
      // Host-Cookie über eine Server Action (hostSessionToken).
      const token = await adminSessionToken();
      if (token) await supabase.realtime.setAuth(token);
      if (cancelled) return;

      channel = supabase
        .channel(`rt:${table}:${filter ?? "all"}:${uid}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table, ...(filter ? { filter } : {}) },
          (payload) => {
            if (evCb.current) {
              evCb.current(payload as unknown as RealtimePayload<T>);
              return;
            }
            fireChange();
          },
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
