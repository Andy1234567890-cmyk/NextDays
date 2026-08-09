"use client";

// Echtes Realtime (Supabase WebSocket, kein Polling). Abonniert postgres_changes
// einer Tabelle und ruft bei jedem INSERT/UPDATE/DELETE den Callback. RLS gilt:
// im Backoffice entscheidet is_platform_admin() aus dem JWT, welche Zeilen
// ankommen — ohne Token joint der Channel als anon und liefert 0 Events.
// Fachlich derselbe Stand wie web/lib/use-realtime.ts (Status-Callback +
// Debug-Register); Token-Quelle ist hier das Admin-Cookie (__Host-nd_admin).
import {
  type SupabaseClient,
  createClient as createSupabaseClient,
} from "@supabase/supabase-js";
import { useEffect, useRef } from "react";

import { adminSessionToken } from "@/lib/session";

// Dedizierter Realtime-Client (Modul-Singleton, NUR für Realtime). Verifiziert:
// realtime.setAuth(App-JWT) MUSS VOR .subscribe() laufen, sonst joint der Channel
// als anon (RLS default-deny → 0 Events). Kein eigenes Session-Handling.
//
// Der Token wird als `realtime.accessToken`-CALLBACK hinterlegt, nicht als fester
// Wert: supabase-js ruft ihn bei jedem Verbindungsaufbau und bei jedem Heartbeat
// erneut auf und schiebt einen geänderten Token per `access_token`-Push in alle
// offenen Channels. Ohne das bliebe der beim Mount geholte Token für immer
// stehen — nach Ablauf oder nach einem Reconnect rejoint der Channel abgelaufen
// und schweigt (auf einer lange offenen Deploy-Seite der Normalfall).
// WICHTIG: deshalb unten `setAuth()` OHNE Argument aufrufen. Ein `setAuth(token)`
// mit explizitem Token setzt intern `_manuallySetToken` und schaltet genau diese
// Auffrischung ab (realtime-js 2.108: `_setAuthSafely` überspringt manuelle
// Token). Aus demselben Grund NICHT die Client-Option `accessToken` auf oberster
// Ebene benutzen: die ruft beim Init selbst `setAuth(token)` mit Wert auf.
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
        realtime: { accessToken: () => adminSessionToken() },
      },
    );
  }
  return rtClient;
}

/** Derselbe Realtime-Client für Broadcast-/Presence-Kanäle (eine Verbindung). */
export function getRealtimeClient(): SupabaseClient {
  return realtimeClient();
}

/**
 * Frischen Token am Realtime-Client setzen — über den `accessToken`-Callback,
 * damit die automatische Auffrischung bei Reconnect/Heartbeat aktiv bleibt.
 * Gibt zurück, ob wirklich ein Token anliegt: ohne Token joint jeder Channel als
 * anon und bleibt stumm, das muss der Aufrufer melden können statt es zu raten.
 */
export async function realtimeAuthSetzen(
  supabase: SupabaseClient,
): Promise<boolean> {
  await supabase.realtime.setAuth();
  return !!supabase.realtime.accessTokenValue;
}

// Eindeutige Channel-Namen: mehrere Komponenten dürfen dieselbe Tabelle
// abonnieren; ohne eindeutigen Namen teilten sie EINEN Channel und der zweite
// .on() nach subscribe() würde werfen.
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
// Rebuild je Event reine Arbeit für nichts.
let _rtDirty = false;

function _rtNotify(): void {
  _rtDirty = true;
  for (const l of _rtListeners) l();
}

function _rtUpdate(uid: number, patch: Partial<RealtimeSubState>): void {
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

/** Nicht-postgres_changes-Kanäle (Broadcast/Presence) im selben Register
 *  sichtbar machen. Gibt eine Funktion zum Abmelden zurück. */
export function registriereFremdkanal(
  table: string,
  filter?: string,
): {
  uid: number;
  setzeStatus: (status: string, err?: unknown) => void;
  setzeToken: (hasToken: boolean) => void;
  zaehleEvent: () => void;
  abmelden: () => void;
} {
  channelSeq += 1;
  const uid = channelSeq;
  _rtRegistry.set(uid, {
    uid,
    table,
    filter,
    status: "connecting",
    events: 0,
    hasToken: false,
    lastEventAt: null,
  });
  _rtNotify();
  return {
    uid,
    setzeStatus: (status, err) =>
      _rtUpdate(uid, {
        status,
        error: err ? String((err as Error).message ?? err) : undefined,
      }),
    setzeToken: (hasToken) => _rtUpdate(uid, { hasToken }),
    zaehleEvent: () =>
      _rtUpdate(uid, {
        events: (_rtRegistry.get(uid)?.events ?? 0) + 1,
        lastEventAt: Date.now(),
      }),
    abmelden: () => {
      _rtRegistry.delete(uid);
      _rtNotify();
    },
  };
}

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
    // Debug: diese Subscription im Register anmelden (Overlay macht sie sichtbar).
    _rtRegistry.set(uid, {
      uid,
      table,
      filter,
      status: "connecting",
      events: 0,
      hasToken: false,
      lastEventAt: null,
    });
    _rtNotify();

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
      // App-JWT VOR dem Subscribe setzen (RLS-Claims beim JOIN). Ohne Argument,
      // damit der accessToken-Callback greift und weiter auffrischen darf.
      const hatToken = await realtimeAuthSetzen(supabase);
      // Fehlender Token ist kein „läuft halt langsam", sondern ein stummes Abo:
      // die Policy is_platform_admin() liefert dann 0 Events. Sichtbar machen.
      _rtUpdate(uid, {
        hasToken: hatToken,
        ...(hatToken
          ? {}
          : {
              status: "KEIN_TOKEN",
              error:
                "Kein Admin-Token — der Channel joint als anon und empfängt nichts.",
            }),
      });
      if (!hatToken) {
        console.warn(
          `[realtime] ${table}: kein Admin-Token, Abo bleibt ohne Events.`,
        );
      }
      if (cancelled) return;

      channel = supabase
        .channel(`rt:${table}:${filter ?? "all"}:${uid}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table, ...(filter ? { filter } : {}) },
          (payload) => {
            _rtUpdate(uid, {
              events: (_rtRegistry.get(uid)?.events ?? 0) + 1,
              lastEventAt: Date.now(),
            });
            if (evCb.current) {
              evCb.current(payload as unknown as RealtimePayload<T>);
              return;
            }
            fireChange();
          },
        )
        .subscribe((status, err) => {
          // Den ECHTEN Status festhalten: CHANNEL_ERROR/TIMED_OUT/CLOSED fielen
          // vorher still auf den Boden und waren von „funktioniert, aber
          // langsam" nicht zu unterscheiden (Wurzel 5).
          _rtUpdate(uid, {
            status,
            error: err ? String(err.message ?? err) : undefined,
          });
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.warn(
              `[realtime] ${table}${filter ? ` (${filter})` : ""}: ${status}`,
              err ?? "",
            );
          }
        });
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (channel) supabase.removeChannel(channel);
      _rtRegistry.delete(uid);
      _rtNotify();
    };
  }, [table, filter, enabled, debounceMs, uid]);
}
