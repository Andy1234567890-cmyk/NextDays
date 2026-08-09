"use client";

// Plattform-Posteingang (Airbnb „Messages"): drei Spalten —
//   1. Thread-Liste (Filter Alle/Ungelesen, Suche, Archiv)
//   2. Chat (Nachrichten + Eingabe + Quick Replies + Block-Button im Kopf)
//   3. Reservierungs-Panel (öffnet über den „›"-Pfeil am Gastnamen)
//
// Kein Realtime: `guest_messages` liefert dem Betrieb seit Migration 0337 keine
// Events mehr (Begründung unten am ehemaligen Abo). Der State wird von den
// Action-Antworten und den Ladepfaden gepflegt.
import { useCallback, useState } from "react";

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

  // Kein Realtime auf `guest_messages` mehr. Die Tabelle bleibt für
  // `authenticated` zwar lesbar, aber Migration 0337 hat ihre RLS-Policy auf den
  // SELBST-Scope des Gastes reduziert (`portal_guest_id = auth.uid()`); der
  // tenant-weite Zweig ist entfallen (Wurzel 6). Für die BETRIEBS-Seite — also
  // dieses Gastgeber-Dashboard — passt damit keine Policy mehr: das Abo verbindet
  // sauber und liefert nie ein Event, obwohl das Prüfskript die Tabelle als
  // „offen" ausweist. Der Nachrichteninhalt kommt für den Betrieb ohnehin
  // ausschließlich über den host_messages-Slice (service_role), nicht über den
  // Realtime-Payload.
  //
  // Eine Ersatzquelle gibt es nicht: keine für `authenticated` offene Tabelle
  // trägt eine eingehende Gastnachricht. Ehrlich: eine NEUE Gastnachricht
  // erscheint nicht mehr von selbst — weder als Chat-Zeile im offenen Thread
  // noch als Vorschau/Ungelesen-Zähler in der Thread-Liste. Sichtbar wird sie
  // erst beim nächsten Laden: `ladeListe` (Filter-/Suchwechsel),
  // `oeffneThread` (Thread öffnen) oder `nachrichtGesendet` (nach dem Senden).

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
