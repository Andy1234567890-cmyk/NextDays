"use client";

// Echtes Realtime (Supabase WebSocket, kein Polling). Abonniert postgres_changes
// einer Tabelle und ruft bei jedem INSERT/UPDATE/DELETE den Callback. RLS gilt:
// der Client empfängt nur Zeilen seines Tenants (current_tenant_id() aus dem JWT).
import {
  type SupabaseClient,
  createClient as createSupabaseClient,
} from "@supabase/supabase-js";
import { useEffect, useRef } from "react";

import { currentToken } from "@/lib/session-token";

// Dedizierter Realtime-Client (Modul-Singleton, NUR für Realtime — sein
// auth-Modul bleibt passiv und ohne Session). Verifiziert gegen die echte DB:
//
//  - realtime.setAuth(App-JWT) VOR .subscribe() → Events kommen (RLS-Claims
//    werden beim Channel-JOIN registriert).
//  - setAuth NACH subscribe → keine Events (Claims des Joins bleiben anon).
//  - accessToken-Client-Option → keine Events (wird beim postgres_changes-Join
//    nicht ausgewertet, supabase-js 2.108).
//  - Der GETEILTE ssr-Browser-Client (lib/supabase/client) ist ungeeignet:
//    sein auth-Modul überschreibt das Token beim Init/INITIAL_SESSION wieder
//    mit anon (Cookie-Login hat dort keine Session) → Subscription lief als
//    anon, RLS filterte alle Events weg (SUBSCRIBED, aber 0 Events).
let rtClient: SupabaseClient | null = null;
function realtimeClient(): SupabaseClient {
  if (!rtClient) {
    rtClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      // Kein Session-Handling: Dieser Client authentifiziert sich pro Channel
      // explizit über setAuth(currentToken()) — nie über sein auth-Modul.
      { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
    );
  }
  return rtClient;
}

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

  // Während enabled=false ist das Abo abbestellt — Events aus diesem Fenster
  // wären sonst dauerhaft verloren (UI bliebe stale, z. B. Kalender nach einer
  // langen Drag-Interaktion). Beim Re-Enable daher einmal onChange nachholen.
  const wasDisabled = useRef(false);

  useEffect(() => {
    if (!enabled) {
      wasDisabled.current = true;
      return;
    }
    const supabase = realtimeClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    // Debounce: viele Events kurz hintereinander → ein onChange.
    let timer: ReturnType<typeof setTimeout> | null = null;
    const fire = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => cb.current(), debounceMs);
    };

    if (wasDisabled.current) {
      wasDisabled.current = false;
      fire();
    }

    (async () => {
      // App-JWT VOR dem Subscribe setzen — die RLS-Claims der Subscription
      // werden beim JOIN registriert; ohne Token liefe das Abo als anon
      // (default-deny → 0 Events). Token-Quelle currentToken(): FastAPI-Cookie
      // nd_access bevorzugt, sonst Supabase-OAuth-Session.
      const token = await currentToken();
      if (token) {
        await supabase.realtime.setAuth(token);
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
