"use client";

// Echtes Realtime (Supabase WebSocket, kein Polling) — portiert aus
// gastgeber/lib/use-realtime.ts; Token-Quelle ist das Partner-Cookie
// (partnerSessionToken). RLS gilt: der Partner empfängt nur Zeilen seiner
// eigenen Tickets (reporter_affiliate_id = auth.uid(), 0518).
import {
  type SupabaseClient,
  createClient as createSupabaseClient,
} from "@supabase/supabase-js";
import { useEffect, useRef } from "react";

import { partnerSessionToken } from "@/lib/session";

let rtClient: SupabaseClient | null = null;
function realtimeClient(): SupabaseClient {
  if (!rtClient) {
    rtClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
    );
  }
  return rtClient;
}

let channelSeq = 0;

type RealtimeOpts = {
  table: string;
  filter?: string;
  onChange: () => void;
  enabled?: boolean;
  debounceMs?: number;
};

export function useRealtime({ table, filter, onChange, enabled = true, debounceMs = 400 }: RealtimeOpts) {
  const cb = useRef(onChange);
  cb.current = onChange;
  const uidRef = useRef<number | null>(null);
  if (uidRef.current === null) {
    channelSeq += 1;
    uidRef.current = channelSeq;
  }
  const uid = uidRef.current;

  useEffect(() => {
    if (!enabled) return;
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
      // Ohne Supabase-Zugang gibt es kein Realtime — laut sagen, nicht still
      // eine tote Attrappe abonnieren (Wurzel 5).
      console.error("[realtime] NEXT_PUBLIC_SUPABASE_URL/PUBLISHABLE_KEY fehlen — kein Live-Update.");
      return;
    }
    const supabase = realtimeClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    (async () => {
      const token = await partnerSessionToken();
      if (token) await supabase.realtime.setAuth(token);
      if (cancelled) return;
      channel = supabase
        .channel(`rt:${table}:${filter ?? "all"}:${uid}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table, ...(filter ? { filter } : {}) },
          () => {
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => cb.current(), debounceMs);
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
