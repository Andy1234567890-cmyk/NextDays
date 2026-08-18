// Nachrichten: Thread-Liste + Chat-Detail mit ECHTEM Realtime (Supabase
// WebSocket, kein Polling). Abonniert guest_messages (Filter thread_id des
// offenen Chats) UND guest_message_threads (Filter portal_guest_id) und pflegt
// den State inkrementell aus payload.new — KEIN Vollreload nach eigener Aktion.
//
// Zwei Layouts:
//   ab md  — Liste links, Verlauf rechts (zwei Spalten, feste Höhe).
//   unter md — Master/Detail wie jede Messenger-App: erst die Liste, Antippen
//              öffnet den Verlauf als eigene Ansicht mit Zurück-Pfeil.
// Vorher stapelten mobil BEIDE Bereiche untereinander: man scrollte durch eine
// 18-rem-Liste, um zu einem Verlauf zu kommen, der nicht sagte, zu welcher
// Unterkunft er gehört. Zusätzlich sprang der erste Thread automatisch auf —
// mobil landete man also in einem Chat, ohne die Liste gesehen zu haben.
//
// Der offene Verlauf hängt an einem History-Eintrag (#chat): damit schließt ihn
// die Zurück-Wischgeste des Geräts, statt die ganze Seite zu verlassen. Ein
// Hash statt eines Query-Parameters, weil er den Next-Router nicht auslöst und
// die Realtime-Abos deshalb nicht neu aufgebaut werden.
"use client";

import { Icon } from "@iconify/react";
import { useEffect, useRef, useState } from "react";

import {
  type ChatMessage,
  type MessageThread,
  ladeThread,
  sendeNachricht,
} from "@/lib/guest-messages";
import { useRealtime } from "@/lib/use-realtime";
import { formatDateTime } from "@/lib/format";

export function NachrichtenClient({
  token,
  guestId,
  initialThreads,
  initialThreadId,
}: {
  token: string | null;
  guestId: string;
  initialThreads: MessageThread[];
  initialThreadId: string | null;
}) {
  const [threads, setThreads] = useState<MessageThread[]>(initialThreads);
  const [aktivId, setAktivId] = useState<string | null>(
    initialThreadId ?? initialThreads[0]?.id ?? null,
  );
  // Mobil: ist der Verlauf als eigene Ansicht offen? Startet nur offen, wenn
  // gezielt ein Thread angefragt wurde (?reservation=…).
  const [mobilChatOffen, setMobilChatOffen] = useState(
    Boolean(initialThreadId),
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [ladeMsg, setLadeMsg] = useState(false);
  const [entwurf, setEntwurf] = useState("");
  const [sende, setSende] = useState(false);
  const endeRef = useRef<HTMLDivElement>(null);

  // Thread-Nachrichten laden, wenn sich der aktive Thread ändert.
  useEffect(() => {
    if (!aktivId) {
      setMessages([]);
      return;
    }
    let aktiv = true;
    setLadeMsg(true);
    (async () => {
      const res = await ladeThread(aktivId);
      if (!aktiv) return;
      setLadeMsg(false);
      if (res.ok) setMessages(res.data.messages);
    })();
    return () => {
      aktiv = false;
    };
  }, [aktivId]);

  // Zurück-Geste/-Taste des Geräts schließt den Verlauf statt die Seite.
  useEffect(() => {
    function onPop() {
      setMobilChatOffen(false);
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  function oeffneThread(id: string) {
    setAktivId(id);
    setMobilChatOffen(true);
    if (window.location.hash !== "#chat") {
      window.history.pushState(null, "", "#chat");
    }
  }

  function schliesseThread() {
    if (window.location.hash === "#chat") {
      // Über die History zurück, damit kein toter Eintrag stehen bleibt; das
      // popstate-Ereignis setzt den Zustand.
      window.history.back();
      return;
    }
    setMobilChatOffen(false);
  }

  // Ans Ende scrollen bei neuen Nachrichten.
  useEffect(() => {
    endeRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Realtime: neue/aktualisierte Nachrichten im OFFENEN Thread inkrementell.
  useRealtime<ChatMessage>({
    table: "guest_messages",
    filter: aktivId ? `thread_id=eq.${aktivId}` : undefined,
    token,
    enabled: Boolean(aktivId),
    onEvent: (payload) => {
      if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
        const neu = payload.new as ChatMessage;
        if (!neu.id) return;
        setMessages((prev) => {
          const idx = prev.findIndex((m) => m.id === neu.id);
          if (idx >= 0) {
            const kopie = [...prev];
            kopie[idx] = neu;
            return kopie;
          }
          return [...prev, neu];
        });
      }
    },
  });

  // Realtime: Thread-Liste (neuer Thread / neue letzte-Nachricht / Unread).
  useRealtime<MessageThread>({
    table: "guest_message_threads",
    filter: `portal_guest_id=eq.${guestId}`,
    token,
    onEvent: (payload) => {
      if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
        const neu = payload.new as MessageThread;
        if (!neu.id) return;
        setThreads((prev) => {
          const idx = prev.findIndex((t) => t.id === neu.id);
          const merged =
            idx >= 0 ? { ...prev[idx], ...neu } : neu;
          const rest = prev.filter((t) => t.id !== neu.id);
          // Nach letzter Aktivität sortieren (neueste oben).
          return [merged, ...rest].sort((a, b) => {
            const ta = a.last_message_at ?? a.created_at;
            const tb = b.last_message_at ?? b.created_at;
            return (tb ?? "").localeCompare(ta ?? "");
          });
        });
      }
    },
  });

  async function absenden(e: React.FormEvent) {
    e.preventDefault();
    const text = entwurf.trim();
    if (!text || !aktivId || sende) return;
    setSende(true);
    const res = await sendeNachricht(aktivId, text);
    setSende(false);
    if (res.ok) {
      setEntwurf("");
      // Kein manuelles Reload: die eigene Nachricht kommt entweder per Realtime-
      // INSERT rein, oder wir fügen sie sofort optimistisch hinzu (dedupe per id).
      const neu = res.data;
      setMessages((prev) =>
        prev.some((m) => m.id === neu.id) ? prev : [...prev, neu],
      );
    }
  }

  const aktiverThread = threads.find((t) => t.id === aktivId) ?? null;

  return (
    <div className="grid gap-0 overflow-hidden rounded-2xl border border-border bg-card md:h-[36rem] md:grid-cols-[20rem_1fr]">
      {/* Thread-Liste — mobil die erste Ansicht, ab md die linke Spalte */}
      <div
        className={
          "border-border md:block md:border-b-0 md:border-r " +
          (mobilChatOffen ? "hidden" : "block")
        }
      >
        <div className="border-b border-border px-4 py-3">
          <p className="font-medium">Konversationen</p>
        </div>
        <div className="overflow-y-auto md:max-h-full">
          {threads.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
                <Icon icon="ph:chat-circle" className="size-6" />
              </span>
              <p className="text-sm text-muted-foreground">
                Noch keine Nachrichten.
              </p>
            </div>
          ) : (
            threads.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => oeffneThread(t.id)}
                className={
                  "flex min-h-16 w-full items-start gap-3 border-b border-border px-4 py-3 text-left transition-colors " +
                  (t.id === aktivId ? "bg-secondary" : "hover:bg-secondary/60")
                }
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Icon icon="ph:house-simple" className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {t.property_title ?? "Unterkunft"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t.last_message_at
                      ? formatDateTime(t.last_message_at)
                      : "Neu"}
                  </p>
                </div>
                {t.unread_count > 0 && (
                  <span className="flex size-5 items-center justify-center rounded-full bg-accent text-[0.65rem] font-bold text-accent-foreground">
                    {t.unread_count > 9 ? "9+" : t.unread_count}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat — mobil die zweite Ansicht (volle Höhe), ab md die rechte Spalte */}
      <div
        className={
          "h-[calc(100dvh-13rem)] min-h-[18rem] flex-col md:flex md:h-auto md:min-h-0 " +
          (mobilChatOffen ? "flex" : "hidden")
        }
      >
        {aktivId ? (
          <>
            <div className="flex shrink-0 items-center gap-1 border-b border-border px-2 py-2 md:px-5 md:py-3">
              {/* Zurück nur mobil — ab md steht die Liste ja daneben. */}
              <button
                type="button"
                onClick={schliesseThread}
                aria-label="Zurück zu den Konversationen"
                className="flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-secondary md:hidden"
              >
                <Icon icon="ph:arrow-left" className="size-5" />
              </button>
              <p className="min-w-0 truncate font-medium">
                {aktiverThread?.property_title ?? "Unterkunft"}
              </p>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-4 md:p-5">
              {ladeMsg ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Icon icon="ph:spinner" className="size-5 animate-spin" />
                  Lädt…
                </div>
              ) : messages.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Schreib die erste Nachricht.
                </p>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={
                      "flex " +
                      (m.sender === "guest" ? "justify-end" : "justify-start")
                    }
                  >
                    <div
                      className={
                        "max-w-[80%] rounded-2xl px-4 py-2 text-sm " +
                        (m.sender === "guest"
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-foreground")
                      }
                    >
                      <p className="whitespace-pre-line">{m.body}</p>
                      <p
                        className={
                          "mt-1 text-[0.65rem] " +
                          (m.sender === "guest"
                            ? "text-primary-foreground/60"
                            : "text-muted-foreground")
                        }
                      >
                        {formatDateTime(m.created_at)}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div ref={endeRef} />
            </div>
            <form
              onSubmit={absenden}
              className="flex shrink-0 items-center gap-2 border-t border-border p-3"
            >
              <input
                value={entwurf}
                onChange={(e) => setEntwurf(e.target.value)}
                placeholder="Nachricht schreiben…"
                className="min-h-12 w-full rounded-full border border-border bg-background px-4 text-base outline-none focus:border-ring md:min-h-0 md:py-2.5 md:text-sm"
              />
              <button
                type="submit"
                disabled={sende || !entwurf.trim()}
                aria-label="Senden"
                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground hover:opacity-90 disabled:opacity-50 md:size-10"
              >
                {sende ? (
                  <Icon icon="ph:spinner" className="size-5 animate-spin" />
                ) : (
                  <Icon icon="ph:paper-plane-tilt-fill" className="size-5" />
                )}
              </button>
            </form>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground">
            Wähle eine Konversation.
          </div>
        )}
      </div>
    </div>
  );
}
