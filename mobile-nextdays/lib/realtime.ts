// Echtes Realtime (Supabase WebSocket, kein Polling) — RN-Portierung des
// Web-Musters apps/web/lib/use-realtime.ts. Dedizierter Singleton-Client
// (persistSession:false); pro Channel wird das App-JWT VOR .subscribe() gesetzt
// (setAuth registriert die RLS-Claims beim JOIN — danach würden 0 Events
// kommen). RLS filtert serverseitig auf den Tenant.
import {
  type RealtimeChannel,
  type SupabaseClient,
  createClient,
} from "@supabase/supabase-js";
import { useEffect, useRef } from "react";

import { CONFIG } from "@/lib/config";

/**
 * Woher das JWT für die Channels kommt. Der Realtime-Client teilt sich EIN
 * globales `setAuth` — es darf ihn deshalb nur GENAU EINE Auth-Welt bedienen.
 * Hingen zwei Token-Listener daran (Tenant + Gast, wie in der früheren
 * All-in-One-App), überschriebe der zuletzt feuernde das JWT der anderen Welt:
 * deren Channels laufen dann still aus, weil keine RLS-Policy mehr passt — ohne
 * Fehler, es kommen nur keine Events mehr. Seit der App-Aufteilung (ADR-0019)
 * hat jede App genau eine Auth-Welt; sie registriert ihre Quelle EINMAL im
 * App-Root, auf Modulebene, vor dem ersten Screen-Mount.
 */
export type TokenQuelle = {
  holen: () => Promise<string | null>;
  abonnieren: (listener: (token: string | null) => void) => () => void;
};

let quelle: TokenQuelle | null = null;

export function realtimeTokenQuelleSetzen(q: TokenQuelle): void {
  if (quelle) {
    throw new Error("Realtime-Tokenquelle ist bereits gesetzt (genau EINE Auth-Welt).");
  }
  quelle = q;
  // Bei Token-Refresh/Logout das JWT erneuern — kein Polling.
  q.abonnieren((token) => {
    if (rtClient && token) {
      rtClient.realtime.setAuth(token).catch(() => {
        // Best-effort: schlägt setAuth fehl, greift beim nächsten Channel-JOIN
        // erneut der Token-Pfad. Kein Kippen des Hauptpfads.
      });
    }
  });
}

// Fail-closed (Wurzel 5): lieber ein lauter Fehler als stille Nicht-Events.
function tokenQuelle(): TokenQuelle {
  if (!quelle) {
    throw new Error(
      "Realtime ohne Tokenquelle — realtimeTokenQuelleSetzen() im App-Root fehlt.",
    );
  }
  return quelle;
}

// Client-Singleton. null, wenn kein anon-Key konfiguriert ist (dann ist der Hook
// ein no-op — kein Crash). EIN Warnhinweis, nicht pro Aufruf.
let rtClient: SupabaseClient | null | undefined;
let warned = false;

function realtimeClient(): SupabaseClient | null {
  if (rtClient !== undefined) return rtClient;
  if (!CONFIG.supabaseAnonKey) {
    if (!warned) {
      console.warn(
        "[realtime] Kein Supabase-anon-Key (lib/config) — Realtime deaktiviert. " +
          "REST/Auth laufen unberührt weiter.",
      );
      warned = true;
    }
    rtClient = null;
    return null;
  }
  rtClient = createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey, {
    // Kein Session-Handling: die Auth kommt pro Channel über setAuth(App-JWT),
    // nie über das auth-Modul dieses Clients.
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return rtClient;
}

// Eindeutige Channel-Namen: mehrere Komponenten dürfen dieselbe Tabelle
// abonnieren, ohne sich einen Channel zu teilen.
let channelSeq = 0;

export type RealtimePayload<T = Record<string, unknown>> = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: T | Record<string, never>;
  old: Partial<T> | Record<string, never>;
};

type RealtimeOpts<T = Record<string, unknown>> = {
  /** Tabelle in public, z. B. "sandbox_message". */
  table: string;
  /** Optionaler Server-Filter, z. B. `thread_id=eq.${id}`. */
  filter?: string;
  /** Vollreload-Modus (debounced): bei jeder Änderung neu laden. */
  onChange?: () => void;
  /** Inkrementeller Modus (un-debounced): State aus payload.new/old pflegen. */
  onEvent?: (payload: RealtimePayload<T>) => void;
  /** Abo nur aktiv, wenn true (default true). */
  enabled?: boolean;
  /** Debounce-Fenster für onChange (ms, default 400 — wie Web). */
  debounceMs?: number;
};

/**
 * Abonniert eine Tabelle per Supabase-Realtime. Genau EINER von onChange/onEvent
 * muss gesetzt sein. Cleanup entfernt den Channel bei unmount.
 */
export function useRealtime<T = Record<string, unknown>>({
  table,
  filter,
  onChange,
  onEvent,
  enabled = true,
  debounceMs = 400,
}: RealtimeOpts<T>): void {
  const cb = useRef(onChange);
  cb.current = onChange;
  const evCb = useRef(onEvent);
  evCb.current = onEvent;

  // Stabile ID pro Hook-Instanz (eindeutiger Channel-Name).
  const uidRef = useRef<number | null>(null);
  if (uidRef.current === null) {
    channelSeq += 1;
    uidRef.current = channelSeq;
  }
  const uid = uidRef.current;

  useEffect(() => {
    if (!enabled) return;
    const supabase = realtimeClient();
    if (!supabase) return; // kein Key → no-op

    let channel: RealtimeChannel | null = null;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const fireChange = () => {
      if (!cb.current) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => cb.current?.(), debounceMs);
    };

    (async () => {
      const token = await tokenQuelle().holen();
      if (cancelled) return;
      if (token) await supabase.realtime.setAuth(token); // VOR subscribe()
      if (cancelled) return;

      channel = supabase
        .channel(`rt:${table}:${filter ?? "all"}:${uid}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table, ...(filter ? { filter } : {}) },
          (payload) => {
            if (evCb.current) {
              evCb.current({
                eventType: payload.eventType as RealtimePayload<T>["eventType"],
                new: (payload.new ?? {}) as T,
                old: (payload.old ?? {}) as Partial<T>,
              });
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
