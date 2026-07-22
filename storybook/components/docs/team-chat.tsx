// Realtime-Team-Chat für die Design-System-Werkstatt.
// Name kommt automatisch aus dem eingeloggten Supabase-Account (kein zweiter
// Login, keine Namensabfrage). Live über Supabase Realtime (Tabelle storybook_chat).
import { useCallback, useEffect, useRef, useState } from "react";

import { supabase, type ChatMessage } from "@/lib/supabase-chat";

type TeamChatProps = {
  /** Optionales Thema (z. B. Komponentenname), das Nachrichten zugeordnet wird. */
  topic?: string;
};

export function TeamChat({ topic }: TeamChatProps) {
  const [me, setMe] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Eingeloggten Nutzer holen -> Anzeigename ableiten.
  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      const u = data.user;
      const name =
        (u?.user_metadata?.name as string) ||
        u?.email?.split("@")[0] ||
        "Gast";
      setMe(name);
    });
    return () => {
      active = false;
    };
  }, []);

  // Verlauf laden + Realtime abonnieren.
  useEffect(() => {
    let active = true;

    const load = async () => {
      let query = supabase
        .from("storybook_chat")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(200);
      if (topic) query = query.eq("topic", topic);
      const { data, error: e } = await query;
      if (!active) return;
      if (e) setError(e.message);
      else setMessages((data as ChatMessage[]) ?? []);
    };
    load();

    const channel = supabase
      .channel(`storybook_chat_${topic ?? "all"}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "storybook_chat" },
        (payload) => {
          const msg = payload.new as ChatMessage;
          if (topic && msg.topic !== topic) return;
          setMessages((prev) =>
            prev.some((m) => m.id === msg.id) ? prev : [...prev, msg],
          );
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [topic]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  const send = useCallback(async () => {
    const body = draft.trim();
    if (!body || !me) return;
    setSending(true);
    setError(null);
    const { error: e } = await supabase
      .from("storybook_chat")
      .insert({ author: me, body, topic: topic ?? null });
    setSending(false);
    if (e) setError(e.message);
    else setDraft("");
  }, [draft, me, topic]);

  const card: React.CSSProperties = {
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    color: "var(--foreground)",
    fontFamily: "system-ui, sans-serif",
    maxWidth: "40rem",
    overflow: "hidden",
  };
  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.55rem 0.75rem",
    borderRadius: "var(--radius)",
    border: "1px solid var(--border)",
    background: "var(--background)",
    color: "var(--foreground)",
    fontSize: "0.9rem",
  };
  const btn: React.CSSProperties = {
    padding: "0.55rem 1rem",
    borderRadius: "var(--radius)",
    border: "none",
    background: "var(--primary)",
    color: "var(--primary-foreground)",
    fontWeight: 600,
    cursor: "pointer",
  };

  return (
    <div style={card}>
      <div
        style={{
          padding: "0.75rem 1rem",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <strong>Austausch{topic ? `: ${topic}` : ""}</strong>
        <span style={{ color: "var(--muted-foreground)", fontSize: "0.8rem" }}>
          {me ? `als ${me}` : "…"}
        </span>
      </div>

      <div
        ref={listRef}
        style={{
          maxHeight: "26rem",
          overflowY: "auto",
          padding: "1rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
        }}
      >
        {messages.length === 0 ? (
          <span style={{ color: "var(--muted-foreground)", fontSize: "0.9rem" }}>
            Noch keine Nachrichten — schreib die erste.
          </span>
        ) : (
          messages.map((m) => {
            const mine = m.author === me;
            return (
              <div
                key={m.id}
                style={{
                  alignSelf: mine ? "flex-end" : "flex-start",
                  maxWidth: "80%",
                }}
              >
                <div
                  style={{
                    fontSize: "0.72rem",
                    color: "var(--muted-foreground)",
                    marginBottom: "0.15rem",
                    textAlign: mine ? "right" : "left",
                  }}
                >
                  {m.author} ·{" "}
                  {new Date(m.created_at).toLocaleString("de-DE", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
                <div
                  style={{
                    background: mine ? "var(--primary)" : "var(--secondary)",
                    color: mine
                      ? "var(--primary-foreground)"
                      : "var(--foreground)",
                    padding: "0.5rem 0.75rem",
                    borderRadius: "var(--radius)",
                    fontSize: "0.9rem",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {m.body}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div
        style={{
          padding: "0.75rem 1rem",
          borderTop: "1px solid var(--border)",
          display: "flex",
          gap: "0.5rem",
        }}
      >
        <input
          style={inputStyle}
          placeholder="Nachricht schreiben…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
        />
        <button style={btn} onClick={send} disabled={sending || !me}>
          {sending ? "…" : "Senden"}
        </button>
      </div>
      {error ? (
        <div
          style={{
            padding: "0 1rem 0.75rem",
            color: "var(--destructive)",
            fontSize: "0.85rem",
          }}
        >
          {error}
        </div>
      ) : null}
    </div>
  );
}
