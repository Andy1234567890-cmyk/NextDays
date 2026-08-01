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

/** Derselbe Realtime-Client für andere Kanalarten (Broadcast/Presence).
 *  Bewusst geteilt: ein zweiter Client wäre eine zweite WebSocket-Verbindung
 *  für dieselbe Sitzung. */
export function getRealtimeClient(): SupabaseClient {
  return realtimeClient();
}

// Modul-globaler Zähler für eindeutige Channel-Namen. Mehrere Komponenten dürfen
// dieselbe Tabelle abonnieren (z. B. Timeline + Listenansicht gleichzeitig);
// ohne eindeutigen Namen teilten sie sich EINEN Supabase-Channel und der zweite
// .on() nach subscribe() wirft „cannot add postgres_changes callbacks … after
// subscribe()". Jede Hook-Instanz bekommt daher ihren eigenen Channel.
let channelSeq = 0;

// --- Sichtbares Realtime-Debugging ------------------------------------------
// Register aller aktiven Subscriptions: Status (SUBSCRIBED/CHANNEL_ERROR/…),
// empfangene Events, letzte Aktivität. Das Debug-Overlay (RealtimeDebugPanel)
// liest hier und macht sichtbar, ob Realtime WIRKLICH verbindet und Events
// ankommen — statt im Dunkeln zu raten.
export type RealtimeSubState = {
  uid: number;
  table: string;
  filter?: string;
  status: string; // "connecting" | "SUBSCRIBED" | "CHANNEL_ERROR" | "TIMED_OUT" | "CLOSED"
  events: number;
  hasToken: boolean;
  lastEventAt: number | null;
  error?: string;
};

const _rtRegistry = new Map<number, RealtimeSubState>();
const _rtListeners = new Set<() => void>();

// Gecachter Snapshot: NUR neu bauen, wenn sich seit dem letzten Lesen etwas
// geändert hat. getRealtimeDebugState dient als getSnapshot für
// useSyncExternalStore — würde es jedes Mal ein neues Array liefern, entstünde
// ein garantierter „Maximum update depth"-Loop.
let _rtSnapshot: RealtimeSubState[] = [];
// Lazy: ohne Overlay (Produktion) liest niemand den Snapshot, dann wäre ein
// Rebuild je Event reine Arbeit für nichts — ein ARI-Import schreibt 365 Zeilen.
let _rtDirty = false;

function _rtNotify(): void {
  _rtDirty = true;
  for (const l of _rtListeners) l();
}

export function _rtUpdate(uid: number, patch: Partial<RealtimeSubState>): void {
  const cur = _rtRegistry.get(uid);
  if (!cur) return;
  _rtRegistry.set(uid, { ...cur, ...patch });
  _rtNotify();
}

/** Snapshot aller aktiven Subscriptions (für das Debug-Overlay). Referenzstabil
 *  zwischen Änderungen — Pflicht für useSyncExternalStore: dieselbe Referenz,
 *  solange kein Update kam, ein neues Array erst nach einer echten Änderung. */
export function getRealtimeDebugState(): RealtimeSubState[] {
  if (_rtDirty) {
    _rtDirty = false;
    _rtSnapshot = [..._rtRegistry.values()].sort((a, b) => a.uid - b.uid);
  }
  return _rtSnapshot;
}

/** Änderungen am Register abonnieren (Debug-Overlay). Gibt eine Unsub-Funktion. */
export function subscribeRealtimeDebug(listener: () => void): () => void {
  _rtListeners.add(listener);
  return () => {
    _rtListeners.delete(listener);
  };
}

/**
 * Roher postgres_changes-Payload, wie ihn supabase-js liefert. `eventType` ist
 * INSERT|UPDATE|DELETE; `new` trägt die neue Zeile (INSERT/UPDATE), `old` die
 * alte (UPDATE/DELETE — bei DELETE standardmäßig nur der Primary Key, für volle
 * Alt-Daten braucht die Tabelle REPLICA IDENTITY FULL).
 */
export type RealtimePayload<T = Record<string, unknown>> = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: T | Record<string, never>;
  old: Partial<T> | Record<string, never>;
};

type RealtimeOpts<T = Record<string, unknown>> = {
  /** Tabelle in public, z.B. "channex_booking". */
  table: string;
  /** Optionaler Server-Filter, z.B. `thread_id=eq.${id}`. */
  filter?: string;
  /**
   * Vollreload-Modus: wird (debounced) bei jeder relevanten Änderung ohne
   * Payload aufgerufen. Für Abonnenten, die einfach alles neu laden. Genau EINER
   * von onChange/onEvent muss gesetzt sein.
   */
  onChange?: () => void;
  /**
   * Inkrementeller Modus: wird pro Event mit dem rohen Payload aufgerufen — OHNE
   * Debounce (jedes INSERT/UPDATE/DELETE einzeln), damit der Abonnent den
   * lokalen State gezielt aus payload.new/old pflegen kann (Notion-Muster: kein
   * Vollreload). Debounce würde hier Events verschlucken/bündeln → deaktiviert.
   */
  onEvent?: (payload: RealtimePayload<T>) => void;
  /** Abo nur aktiv, wenn true (default true). */
  enabled?: boolean;
  /**
   * Events innerhalb dieses Fensters (ms) zu EINEM onChange zusammenfassen.
   * Schützt vor Reload-Fluten, wenn ein Sync viele Zeilen auf einmal schreibt
   * (z. B. OTA-ARI-Import: 365 availability-Zeilen). Default 400ms. Gilt NUR im
   * onChange-Modus; onEvent ist immer un-debounced (jedes Event einzeln).
   */
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
  // Callbacks in refs halten, damit das Abo nicht bei jedem Render neu aufgebaut wird.
  const cb = useRef(onChange);
  cb.current = onChange;
  const evCb = useRef(onEvent);
  evCb.current = onEvent;

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
    // Debug: diese Subscription im Register anmelden (Overlay macht sie sichtbar).
    _rtRegistry.set(uid, {
      uid, table, filter, status: "connecting", events: 0,
      hasToken: false, lastEventAt: null,
    });
    _rtNotify();
    // Debounce NUR für den onChange-Vollreload-Modus: viele Events kurz
    // hintereinander → ein onChange. Der onEvent-Modus feuert un-debounced.
    let timer: ReturnType<typeof setTimeout> | null = null;
    const fireChange = () => {
      if (!cb.current) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => cb.current?.(), debounceMs);
    };

    // Re-Enable-Nachholung gilt nur für Vollreload (onChange): war das Abo
    // pausiert, könnte die Liste stale sein → einmal neu laden. Im onEvent-Modus
    // gibt es keinen sinnvollen „leeren" Nachhol-Event (kein Payload), und das
    // reservations-Abo wird im reinen-Realtime-Modell ohnehin nicht pausiert.
    if (wasDisabled.current) {
      wasDisabled.current = false;
      fireChange();
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
      _rtUpdate(uid, { hasToken: !!token });
      if (cancelled) return;

      channel = supabase
        .channel(`rt:${table}:${filter ?? "all"}:${uid}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table, ...(filter ? { filter } : {}) },
          (payload) => {
            // Debug: jedes empfangene Event zählen (sichtbar im Overlay).
            const cur = _rtRegistry.get(uid);
            _rtUpdate(uid, {
              events: (cur?.events ?? 0) + 1,
              lastEventAt: Date.now(),
            });
            // Inkrementeller Modus hat Vorrang: rohen Payload einzeln durchreichen.
            if (evCb.current) {
              evCb.current(payload as unknown as RealtimePayload<T>);
              return;
            }
            fireChange();
          },
        )
        .subscribe((status, err) => {
          // Debug: den ECHTEN Subscription-Status festhalten. Bisher wurde er
          // verworfen — deshalb sah man nie, ob Realtime verbindet oder scheitert.
          _rtUpdate(uid, {
            status,
            error: err ? String(err.message ?? err) : undefined,
          });
        });
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (channel) supabase.removeChannel(channel);
      // Debug: Subscription aus dem Register nehmen.
      _rtRegistry.delete(uid);
      _rtNotify();
    };
  }, [table, filter, enabled, debounceMs, uid]);
}
