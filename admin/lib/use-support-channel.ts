"use client";

// Flüchtige Live-Signale des Support-Chats — Backoffice-Seite: „tippt gerade"
// und die eigene Anwesenheit („Team ist da"), die der Kunde im Widget sieht.
//
// Warum NICHT über die Datenbank: beides ändert sich im Sekundentakt und hat
// keinen Wert, sobald es vorbei ist. Als Tabellenschreibvorgang wäre es reine
// Last (und ein Realtime-Event je Tastendruck). Supabase hat dafür zwei eigene
// Kanalarten — Broadcast (fire-and-forget) und Presence (wer ist verbunden).
//
// Beide Kanäle laufen als `private: true`; wer mitlesen/senden darf, entscheidet
// RLS auf realtime.messages (Migration 0236) — nicht der Client. Eintragen in
// den Anwesenheits-Kanal dürfen ausschließlich Backoffice-Nutzer.
import { useEffect, useRef, useState } from "react";

import { adminSessionToken } from "@/lib/session";
import { getRealtimeClient } from "@/lib/use-realtime";

/** Kanal einer Konversation (Tippt-Anzeige beider Seiten). */
const konversationsTopic = (id: string) => `support:${id}`;

/** Kanal, in dem sich das Betreuungsteam als anwesend meldet. */
const PRESENCE_TOPIC = "support:presence";

// Nach dieser Zeit ohne neues Signal gilt „tippt nicht mehr". Ein
// Gegenereignis („tippt nicht mehr") zu senden wäre unzuverlässig — es geht bei
// Verbindungsabbruch verloren, und der Indikator bliebe für immer stehen.
const TIPP_TIMEOUT_MS = 4000;

// Höchstens alle 2 s ein Signal senden. Ohne Drosselung wäre jeder Tastendruck
// eine Realtime-Nachricht.
const TIPP_INTERVALL_MS = 2000;

type TippNutzung = {
  /** true, solange die Gegenseite tippt. */
  gegenseiteTippt: boolean;
  /** Beim Tippen aufrufen — gedrosselt, gefahrlos bei jedem Tastendruck. */
  tippen: () => void;
};

/**
 * Tippt-Anzeige einer Konversation. `seite` ist die eigene Rolle; angezeigt
 * wird nur, was die GEGENSEITE sendet.
 */
export function useTypingChannel(
  conversationId: string | null,
  seite: "reporter" | "agent",
  aktiv = true,
): TippNutzung {
  const [gegenseiteTippt, setGegenseiteTippt] = useState(false);
  const sendenRef = useRef<((payload: unknown) => void) | null>(null);
  const letztesSendenRef = useRef(0);

  useEffect(() => {
    if (!conversationId || !aktiv) {
      setGegenseiteTippt(false);
      return;
    }
    const supabase = getRealtimeClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let abgebrochen = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    (async () => {
      const token = await adminSessionToken();
      if (token) await supabase.realtime.setAuth(token);
      if (abgebrochen) return;

      channel = supabase.channel(konversationsTopic(conversationId), {
        config: { private: true, broadcast: { self: false } },
      });
      channel
        .on("broadcast", { event: "typing" }, ({ payload }) => {
          if ((payload as { seite?: string })?.seite === seite) return;
          setGegenseiteTippt(true);
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => setGegenseiteTippt(false), TIPP_TIMEOUT_MS);
        })
        .subscribe();

      sendenRef.current = (payload) => {
        void channel?.send({ type: "broadcast", event: "typing", payload });
      };
    })();

    return () => {
      abgebrochen = true;
      if (timer) clearTimeout(timer);
      sendenRef.current = null;
      setGegenseiteTippt(false);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [conversationId, seite, aktiv]);

  const tippen = () => {
    const jetzt = Date.now();
    if (jetzt - letztesSendenRef.current < TIPP_INTERVALL_MS) return;
    letztesSendenRef.current = jetzt;
    sendenRef.current?.({ seite });
  };

  return { gegenseiteTippt, tippen };
}

/**
 * Anwesenheit des Teams.
 *
 * `melden = true` trägt die eigene Sitzung ein — das dürfen laut RLS (0236)
 * ausschließlich Backoffice-Nutzer. Das Dashboard eines Betriebs hört nur zu:
 * ein Kunde kann sich nicht selbst als „Team" ausgeben.
 */
export function useTeamPresence(
  { melden = false, aktiv = true }: { melden?: boolean; aktiv?: boolean } = {},
): { teamOnline: boolean } {
  const [teamOnline, setTeamOnline] = useState(false);

  useEffect(() => {
    if (!aktiv) {
      setTeamOnline(false);
      return;
    }
    const supabase = getRealtimeClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let abgebrochen = false;

    (async () => {
      const token = await adminSessionToken();
      if (token) await supabase.realtime.setAuth(token);
      if (abgebrochen) return;

      channel = supabase.channel(PRESENCE_TOPIC, {
        config: { private: true, presence: { key: crypto.randomUUID() } },
      });
      channel
        .on("presence", { event: "sync" }, () => {
          const stand = channel?.presenceState() ?? {};
          setTeamOnline(Object.keys(stand).length > 0);
        })
        .subscribe((status) => {
          if (status !== "SUBSCRIBED" || !melden) return;
          void channel?.track({ rolle: "agent" });
        });
    })();

    return () => {
      abgebrochen = true;
      setTeamOnline(false);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [melden, aktiv]);

  return { teamOnline };
}
