// Realtime-Austausch-Chat für die Design-System-Werkstatt.
// - Live über Supabase Realtime (Tabelle storybook_chat).
// - Zugang per gemeinsamem Code (im Frontend geprüft) + Anzeigename.
// - Isoliert von den PMS-Daten; nur Lesen/Schreiben von Chat-Nachrichten.
import { useCallback, useEffect, useRef, useState } from "react";

import { supabase, type ChatMessage } from "@/lib/supabase-chat";

const LS_NAME = "nd_chat_name";
const LS_OK = "nd_chat_ok";

type TeamChatProps = {
  /** Optionales Thema (z. B. Komponentenname), das Nachrichten zugeordnet wird. */
  topic?: string;
};

export function TeamChat({ topic }: TeamChatProps) {
  const [unlocked, setUnlocked] = useState(false);
  const [name, setName] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Zugang aus localStorage wiederherstellen.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(LS_OK) === "1") setUnlocked(true);
    const savedName = localStorage.getItem(LS_NAME);
    if (savedName) setName(savedName);
  }, []);

  // Verlauf laden + Realtime abonnieren, sobald entsperrt.
  useEffect(() => {
    if (!unlocked) return;
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
  }, [unlocked, topic]);

  // Automatisch nach unten scrollen bei neuer Nachricht.
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  // Kein Code mehr nötig — der Storybook-Login schützt bereits. Nur Anzeigename.
  const unlock = useCallback(() => {
    setError(null);
    if (nameInput.trim().length < 2) {
      setError("Bitte einen Namen (mind. 2 Zeichen) eingeben.");
      return;
    }
    localStorage.setItem(LS_OK, "1");
    localStorage.setItem(LS_NAME, nameInput.trim());
    setName(nameInput.trim());
    setUnlocked(true);
  }, [nameInput]);

  const send = useCallback(async () => {
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    setError(null);
    const { error: e } = await supabase
      .from("storybook_chat")
      .insert({ author: name, body, topic: topic ?? null });
    setSending(false);
    if (e) setError(e.message);
    else setDraft("");
  }, [draft, name, topic]);

  const card: React.CSSProperties = {
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    color: "var(--foreground)",
    fontFamily: "system-ui, sans-serif",
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

  if (!unlocked) {
    return (
      <div style={{ ...card, padding: "1.5rem", maxWidth: "26rem" }}>
        <h3 style={{ marginTop: 0 }}>Wie heißt du?</h3>
        <p style={{ color: "var(--muted-foreground)", fontSize: "0.9rem" }}>
          Gib deinen Namen ein, dann kannst du live mitschreiben.
        </p>
        <div style={{ display: "grid", gap: "0.6rem" }}>
          <input
            style={inputStyle}
            placeholder="Dein Name"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && unlock()}
          />
          <button style={btn} onClick={unlock}>
            Loslegen
          </button>
          {error ? (
            <span style={{ color: "var(--destructive)", fontSize: "0.85rem" }}>
              {error}
            </span>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...card, maxWidth: "40rem", overflow: "hidden" }}>
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
          angemeldet als {name}
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
            const mine = m.author === name;
            return (
              <div
                key={m.id}
                style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "80%" }}
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
                    color: mine ? "var(--primary-foreground)" : "var(--foreground)",
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
        <button style={btn} onClick={send} disabled={sending}>
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
