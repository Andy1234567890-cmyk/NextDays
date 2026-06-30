"use client";

// WhatsApp-Chat im Posteingang (Meta WhatsApp Cloud API). Wird vom gemeinsamen
// Posteingang (inbox-list) gerendert, wenn ein WhatsApp-Thread offen ist —
// bidirektional senden/empfangen, neue Nachrichten kommen live (Realtime).
import { Icon } from "@iconify/react";
import { useCallback, useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  type WhatsAppMessage,
  listWhatsAppMessages,
  sendWhatsApp,
} from "@/lib/whatsapp-api";
import { useRealtime } from "@/lib/use-realtime";

export function WhatsAppChat({
  conversationId,
  phone,
  name,
  onSent,
}: {
  conversationId: string | null;
  phone: string;
  name: string | null;
  onSent: () => void;
}) {
  const t = useTranslations("whatsapp");
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, startSend] = useTransition();

  const load = useCallback(async () => {
    if (!conversationId) {
      setMessages([]);
      return;
    }
    const res = await listWhatsAppMessages(conversationId);
    if (res.ok) setMessages(res.data.items);
  }, [conversationId]);

  useEffect(() => {
    load();
  }, [load]);

  // Echtes Realtime: neue WhatsApp-Nachrichten dieser Konversation sofort.
  useRealtime({
    table: "whatsapp_message",
    filter: conversationId ? `conversation_id=eq.${conversationId}` : undefined,
    enabled: !!conversationId,
    onChange: load,
  });

  function send() {
    const body = text.trim();
    if (!body) return;
    setError(null);
    startSend(async () => {
      const res = await sendWhatsApp(
        conversationId ? { conversation_id: conversationId, body } : { to_phone: phone, body },
      );
      if (res.ok) {
        setMessages((m) => [...m, res.data]);
        setText("");
        onSent();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <>
      <div className="flex items-center gap-3 border-b border-border p-3">
        <span className="flex size-9 items-center justify-center rounded-full bg-emerald-100">
          <Icon icon="ph:whatsapp-logo" className="size-5 text-emerald-600" />
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-semibold">{name || `+${phone}`}</span>
          <span className="truncate text-xs text-muted-foreground">WhatsApp</span>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noMessages")}</p>
        ) : (
          messages.map((m, i) => (
            <div
              key={m.id ?? i}
              className={
                "flex flex-col gap-1 " +
                (m.direction === "out" ? "items-end" : "items-start")
              }
            >
              <div
                className={
                  "max-w-[80%] rounded-2xl px-3 py-2 text-sm " +
                  (m.direction === "out"
                    ? "bg-emerald-600 text-white"
                    : "bg-muted text-foreground")
                }
              >
                {m.body}
              </div>
              {m.sent_at && (
                <span className="text-[0.65rem] text-muted-foreground">
                  {new Date(m.sent_at).toLocaleString("de-DE")}
                  {m.direction === "out" ? ` · ${m.status}` : ""}
                </span>
              )}
            </div>
          ))
        )}
      </div>

      {error && (
        <p className="mx-4 mb-2 rounded-(--radius) bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex items-end gap-2 border-t border-border p-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("placeholder")}
          rows={2}
          className="min-h-[2.5rem] flex-1 resize-none rounded-(--radius) border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40"
        />
        <Button type="button" onClick={send} disabled={sending || !text.trim()}>
          <Icon
            icon={sending ? "ph:spinner" : "ph:paper-plane-tilt"}
            className={"size-4 " + (sending ? "animate-spin" : "")}
          />
          {t("send")}
        </Button>
      </div>
    </>
  );
}
