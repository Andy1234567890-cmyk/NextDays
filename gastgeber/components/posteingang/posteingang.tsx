"use client";

// Plattform-Posteingang (Airbnb „Messages"): drei Spalten —
//   1. Thread-Liste (Filter Alle/Ungelesen, Suche, Archiv)
//   2. Chat (Nachrichten + Eingabe + Quick Replies + Block-Button im Kopf)
//   3. Reservierungs-Panel (öffnet über den „›"-Pfeil am Gastnamen)
//
// Realtime (Supabase WebSocket, kein Polling): neue guest_messages/Thread-Updates
// pflegen den State inkrementell. Nach eigenen Aktionen wird NICHT neu geladen —
// nur das Event bzw. die Action-Antwort pflegt den State (Muster use-realtime).
import { useCallback, useMemo, useState } from "react";

import { useRealtime } from "@/lib/use-realtime";
import type {
  HostMessage,
  HostThreadDetail,
  HostThreadSummary,
  QuickReply,
} from "@/lib/posteingang";
import { getThreadDetail, getThreads } from "@/lib/posteingang";

import { ThreadListe } from "./thread-liste";
import { ChatSpalte } from "./chat-spalte";
import { ReservierungsPanel } from "./reservierungs-panel";

export type Filter = "alle" | "ungelesen" | "archiviert";

export function Posteingang({
  initialThreads,
  quickReplies,
  zugriffFehlt,
}: {
  initialThreads: HostThreadSummary[];
  quickReplies: QuickReply[];
  zugriffFehlt: boolean;
}) {
  const [threads, setThreads] = useState<HostThreadSummary[]>(initialThreads);
  const [filter, setFilter] = useState<Filter>("alle");
  const [suche, setSuche] = useState("");
  const [aktivId, setAktivId] = useState<string | null>(null);
  const [detail, setDetail] = useState<HostThreadDetail | null>(null);
  const [panelOffen, setPanelOffen] = useState(false);

  // Realtime: neue Nachricht in irgendeinem Thread → Liste + offenen Chat pflegen.
  useRealtime<{ thread_id: string; sender: string; body: string; id: string; created_at: string }>({
    table: "guest_messages",
    enabled: !zugriffFehlt,
    onEvent: (evt) => {
      const row = evt.new;
      if (!row?.thread_id) return;
      // Offenen Chat inkrementell ergänzen (Duplikate meiden).
      setDetail((d) =>
        d && d.id === row.thread_id && !d.messages.some((m) => m.id === row.id)
          ? {
              ...d,
              messages: [
                ...d.messages,
                {
                  id: row.id,
                  sender: row.sender as HostMessage["sender"],
                  body: row.body,
                  created_at: row.created_at,
                },
              ],
            }
          : d,
      );
      // Thread-Vorschau + Unread in der Liste aktualisieren.
      setThreads((list) =>
        list.map((t) =>
          t.id === row.thread_id
            ? {
                ...t,
                last_message: row.body,
                last_message_at: row.created_at,
                unread_count:
                  row.sender === "guest" && aktivId !== row.thread_id
                    ? t.unread_count + 1
                    : t.unread_count,
              }
            : t,
        ),
      );
    },
  });

  const ladeListe = useCallback(
    async (f: Filter, q: string) => {
      const res = await getThreads({
        unread: f === "ungelesen",
        archived: f === "archiviert",
        q: q || undefined,
      });
      if (res) setThreads(res);
    },
    [],
  );

  function wechsleFilter(f: Filter) {
    setFilter(f);
    void ladeListe(f, suche);
  }

  function sucheGeaendert(q: string) {
    setSuche(q);
    void ladeListe(filter, q);
  }

  async function oeffneThread(id: string) {
    setAktivId(id);
    setPanelOffen(false);
    const d = await getThreadDetail(id);
    setDetail(d);
    // Unread lokal auf 0 (Öffnen markiert serverseitig gelesen).
    setThreads((list) =>
      list.map((t) => (t.id === id ? { ...t, unread_count: 0 } : t)),
    );
  }

  // Nach dem Senden (Action-Antwort) den Chat inkrementell ergänzen.
  function nachrichtGesendet(msg: HostMessage) {
    setDetail((d) =>
      d ? { ...d, messages: [...d.messages, msg] } : d,
    );
    setThreads((list) =>
      list.map((t) =>
        t.id === detail?.id
          ? { ...t, last_message: msg.body, last_message_at: msg.created_at }
          : t,
      ),
    );
  }

  // Nach Archivieren: aus der aktuellen (nicht-Archiv-)Liste entfernen.
  function threadArchiviert(id: string, archiviert: boolean) {
    if (filter !== "archiviert" && archiviert) {
      setThreads((list) => list.filter((t) => t.id !== id));
      if (aktivId === id) {
        setAktivId(null);
        setDetail(null);
      }
    }
    setDetail((d) => (d && d.id === id ? { ...d, is_archived: archiviert } : d));
  }

  function gastBlockiert() {
    setDetail((d) => (d ? { ...d, is_blocked: true } : d));
  }

  const aktiverThread = useMemo(
    () => threads.find((t) => t.id === aktivId) ?? null,
    [threads, aktivId],
  );

  if (zugriffFehlt) {
    return (
      <div className="mx-auto max-w-md px-8 py-24 text-center text-muted-foreground">
        Du hast keinen Zugriff auf den Posteingang.
      </div>
    );
  }

  return (
    <div className="grid h-[calc(100vh-5rem)] grid-cols-[22rem_1fr] overflow-hidden lg:grid-cols-[22rem_1fr_auto]">
      <ThreadListe
        threads={threads}
        aktivId={aktivId}
        filter={filter}
        suche={suche}
        onFilter={wechsleFilter}
        onSuche={sucheGeaendert}
        onOeffne={(id) => void oeffneThread(id)}
      />

      <ChatSpalte
        detail={detail}
        thread={aktiverThread}
        quickReplies={quickReplies}
        onGesendet={nachrichtGesendet}
        onArchiviert={threadArchiviert}
        onBlockiert={gastBlockiert}
        onPanelToggle={() => setPanelOffen((v) => !v)}
        panelOffen={panelOffen}
      />

      {panelOffen && detail && (
        <ReservierungsPanel
          threadId={detail.id}
          onClose={() => setPanelOffen(false)}
        />
      )}
    </div>
  );
}
