// Nachrichten: Thread-Liste + Chat-Detail mit ECHTEM Realtime (Supabase
// WebSocket, kein Polling). Abonniert guest_messages (Filter thread_id des
// offenen Chats) UND guest_message_threads (Filter portal_guest_id) und pflegt
// den State inkrementell aus payload.new — KEIN Vollreload nach eigener Aktion.
"use client";

import { Icon } from "@iconify/react";
import { useEffect, useRef, useState } from "react";

import {
  type ChatMessage,
  type MessageThread,
  ladeThread,
  ladeThreads,
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
    <div className="grid gap-0 overflow-hidden rounded-2xl border border-border bg-card md:grid-cols-[20rem_1fr] md:h-[36rem]">
      {/* Thread-Liste */}
      <div className="border-b border-border md:border-b-0 md:border-r">
        <div className="border-b border-border px-4 py-3">
          <p className="font-medium">Konversationen</p>
        </div>
        <div className="max-h-72 overflow-y-auto md:max-h-full">
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
                onClick={() => setAktivId(t.id)}
                className={
                  "flex w-full items-start gap-3 border-b border-border px-4 py-3 text-left transition-colors " +
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

      {/* Chat */}
      <div className="flex min-h-[24rem] flex-col md:min-h-0">
        {aktivId ? (
          <>
            <div className="border-b border-border px-5 py-3">
              <p className="font-medium">
                {aktiverThread?.property_title ?? "Unterkunft"}
              </p>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-5">
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
              className="flex items-center gap-2 border-t border-border p-3"
            >
              <input
                value={entwurf}
                onChange={(e) => setEntwurf(e.target.value)}
                placeholder="Nachricht schreiben…"
                className="w-full rounded-full border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-ring"
              />
              <button
                type="submit"
                disabled={sende || !entwurf.trim()}
                aria-label="Senden"
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground hover:opacity-90 disabled:opacity-50"
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
            Wähle links eine Konversation.
          </div>
        )}
      </div>
    </div>
  );
}
