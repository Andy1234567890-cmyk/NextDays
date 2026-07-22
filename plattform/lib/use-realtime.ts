"use client";

// Echtes Realtime (Supabase WebSocket, kein Polling) — portiert aus
// apps/web/lib/use-realtime.ts. Abonniert postgres_changes einer Tabelle und
// reicht jedes Event inkrementell durch (onEvent). RLS gilt: der Client empfängt
// nur Zeilen des eingeloggten Portal-Gastes (portal_guest_id aus dem JWT).
//
// KRITISCH: supabase.realtime.setAuth(token) MUSS VOR .subscribe() laufen — die
// RLS-Claims der Subscription werden beim Channel-JOIN registriert; ohne Token
// liefe das Abo als anon (default-deny → 0 Events). Der geteilte Auth-Client
// wäre ungeeignet (überschriebe das Token wieder mit anon). Deshalb ein
// dedizierter Client mit persistSession:false und explizitem setAuth pro Abo.
import {
  type SupabaseClient,
  createClient as createSupabaseClient,
} from "@supabase/supabase-js";
import { useEffect, useRef } from "react";

// Token des eingeloggten Gastes wird als Prop übergeben (aus einer "use server"-
// Funktion, guestAccessToken()), damit diese Client-Komponente nicht selbst auf
// das HttpOnly-Cookie zugreifen muss.

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

// Eindeutige Channel-Namen: mehrere Komponenten dürfen dieselbe Tabelle
// abonnieren, ohne sich EINEN Channel zu teilen (zweiter .on() nach subscribe()
// würde werfen).
let channelSeq = 0;

export type RealtimePayload<T = Record<string, unknown>> = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: T | Record<string, never>;
  old: Partial<T> | Record<string, never>;
};

type RealtimeOpts<T = Record<string, unknown>> = {
  /** Tabelle in public, z. B. "guest_messages". */
  table: string;
  /** Optionaler Server-Filter, z. B. `thread_id=eq.${id}`. */
  filter?: string;
  /** Access-Token des Gastes (aus guestAccessToken()). Ohne Token kein Abo. */
  token: string | null;
  /** Inkrementeller Modus: jedes Event einzeln mit rohem Payload (kein Reload). */
  onEvent: (payload: RealtimePayload<T>) => void;
  /** Abo nur aktiv, wenn true (default true). */
  enabled?: boolean;
};

export function useRealtime<T = Record<string, unknown>>({
  table,
  filter,
  token,
  onEvent,
  enabled = true,
}: RealtimeOpts<T>) {
  const evCb = useRef(onEvent);
  evCb.current = onEvent;

  const uidRef = useRef<number | null>(null);
  if (uidRef.current === null) {
    channelSeq += 1;
    uidRef.current = channelSeq;
  }
  const uid = uidRef.current;

  useEffect(() => {
    if (!enabled || !token) return;
    const supabase = realtimeClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    (async () => {
      // App-JWT VOR dem Subscribe setzen (RLS-Claims beim JOIN).
      await supabase.realtime.setAuth(token);
      if (cancelled) return;

      channel = supabase
        .channel(`rt:${table}:${filter ?? "all"}:${uid}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table, ...(filter ? { filter } : {}) },
          (payload) => {
            evCb.current(payload as unknown as RealtimePayload<T>);
          },
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [table, filter, token, enabled, uid]);
}
