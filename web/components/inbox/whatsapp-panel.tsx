"use client";

// WhatsApp-Chat im Posteingang (Meta WhatsApp Cloud API). Wird vom gemeinsamen
// Posteingang (inbox-list) gerendert, wenn ein WhatsApp-Thread offen ist —
// bidirektional senden/empfangen, neue Nachrichten kommen live (Realtime).
import { Icon } from "@iconify/react";
import { Fragment, useCallback, useEffect, useState, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";

import { Button } from "@nextdays/ui/button";
import { tagLabel, tagWechsel, uhrzeit } from "@/lib/chat-format";
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
  kompakt,
}: {
  conversationId: string | null;
  phone: string;
  name: string | null;
  onSent: () => void;
  /** Eingebettet unter einem Kanal-Chat: eigener Kopf entfällt, den trägt
   *  dort der Trennbalken („WhatsApp mit <Gast>"). */
  kompakt?: boolean;
}) {
  const t = useTranslations("whatsapp");
  // Tages-Trenner teilt sich die Wörter „Heute"/„Gestern" mit dem OTA-Verlauf.
  const tInbox = useTranslations("inbox");
  const locale = useLocale();
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
      {!kompakt && (
        <div className="flex items-center gap-3 border-b border-border p-3">
          <span className="flex size-9 items-center justify-center rounded-full bg-emerald-100">
            <Icon icon="ph:whatsapp-logo" className="size-5 text-emerald-600" />
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-semibold">{name || `+${phone}`}</span>
            <span className="truncate text-xs text-muted-foreground">WhatsApp</span>
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noMessages")}</p>
        ) : (
          messages.map((m, i) => (
            <Fragment key={m.id ?? i}>
              {/* Tages-Trenner wie im OTA-Verlauf (lib/chat-format) */}
              {tagWechsel(messages[i - 1]?.sent_at ?? null, m.sent_at) && (
                <div className="flex items-center gap-3 py-1">
                  <span className="h-px flex-1 bg-border" />
                  <span className="rounded-full bg-secondary px-3 py-1 text-[0.7rem] font-medium text-muted-foreground">
                    {tagLabel(m.sent_at, locale, tInbox)}
                  </span>
                  <span className="h-px flex-1 bg-border" />
                </div>
              )}
              <div
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
                    {uhrzeit(m.sent_at, locale)}
                    {m.direction === "out" ? ` · ${m.status}` : ""}
                  </span>
                )}
              </div>
            </Fragment>
          ))
        )}
      </div>

      {error && (
        <p className="mx-4 mb-2 rounded-(--radius) bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* Eingabe-Box wie im Posteingang: Textarea oben, Senden INNEN unten
          rechts — bleibt in jeder Spaltenbreite voll breit. */}
      <div className="border-t border-border p-3">
        <div className="flex flex-col rounded-2xl border border-border bg-background focus-within:ring-2 focus-within:ring-accent/40">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("placeholder")}
            rows={2}
            className="min-h-[2.5rem] w-full resize-none bg-transparent px-3 pt-2.5 pb-1 text-sm outline-none"
          />
          <div className="flex items-center justify-end px-2 pb-2">
            <Button type="button" onClick={send} disabled={sending || !text.trim()}>
              <Icon
                icon={sending ? "ph:spinner" : "ph:paper-plane-tilt"}
                className={"size-4 " + (sending ? "animate-spin" : "")}
              />
              {t("send")}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
