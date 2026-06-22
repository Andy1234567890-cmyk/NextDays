"use client";

// WhatsApp-Kanal im Posteingang (Meta WhatsApp Cloud API).
// 2-Spalten: Konversationsliste · Chat. Bidirektional senden/empfangen.
// Eingehende Nachrichten kommen per Webhook ins Backend; hier wird gepollt.
import { Icon } from "@iconify/react";
import { useCallback, useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  type WhatsAppConversation,
  type WhatsAppMessage,
  type WhatsAppStatus,
  getWhatsAppStatus,
  listWhatsAppConversations,
  listWhatsAppMessages,
  sendWhatsApp,
} from "@/lib/whatsapp-api";

export function WhatsAppPanel() {
  const t = useTranslations("whatsapp");
  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const [convs, setConvs] = useState<WhatsAppConversation[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [newPhone, setNewPhone] = useState("");

  const loadConvs = useCallback(async () => {
    const res = await listWhatsAppConversations();
    if (res.ok) {
      setConvs(res.data.items);
      setActive((cur) => cur ?? res.data.items[0]?.id ?? null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const s = await getWhatsAppStatus();
      if (s.ok) setStatus(s.data);
    })();
    loadConvs();
  }, [loadConvs]);

  // Eingehende Nachrichten (Webhook) sichtbar machen: alle 15 s nachladen.
  useEffect(() => {
    const id = setInterval(loadConvs, 15_000);
    return () => clearInterval(id);
  }, [loadConvs]);

  const current = convs.find((c) => c.id === active) ?? null;

  return (
    <div className="grid min-h-0 flex-1 grid-cols-12 gap-3 p-4">
      {/* Statushinweis (white-label, ehrlich) */}
      {status && !status.configured && !status.sandbox && (
        <div className="col-span-12 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <Icon icon="ph:warning-circle" className="mr-1 inline size-4" />
          {t("notConfigured")}
        </div>
      )}
      {status?.sandbox && (
        <div className="col-span-12 rounded-2xl border border-border bg-muted/40 p-2 text-xs text-muted-foreground">
          {t("sandboxActive")}
        </div>
      )}

      {/* Konversationsliste */}
      <div className="col-span-12 flex min-h-0 flex-col rounded-2xl border border-border bg-card sm:col-span-4">
        <div className="flex items-center gap-2 border-b border-border p-2">
          <input
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            placeholder={t("newPhone")}
            className="flex-1 rounded-full border border-border bg-transparent px-3 py-1.5 text-sm outline-none"
          />
          <Button
            type="button"
            size="icon"
            variant="outline"
            title={t("startChat")}
            disabled={newPhone.replace(/\D/g, "").length < 6}
            onClick={() => {
              // Neue Konversation entsteht beim ersten Senden; hier nur „Platzhalter".
              setActive(`new:${newPhone.replace(/\D/g, "")}`);
            }}
          >
            <Icon icon="ph:plus" className="size-4" />
          </Button>
        </div>
        {convs.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
            <Icon icon="ph:whatsapp-logo" className="size-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          </div>
        ) : (
          <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
            {convs.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setActive(c.id)}
                  className={
                    "flex w-full items-start gap-3 p-3 text-left " +
                    (c.id === active ? "bg-muted/60" : "hover:bg-muted/30")
                  }
                >
                  <span className="relative mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                    <Icon icon="ph:whatsapp-logo" className="size-5 text-emerald-600" />
                    {!c.is_read && (
                      <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-accent ring-2 ring-card" />
                    )}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span
                      className={
                        "truncate text-sm " + (c.is_read ? "font-semibold" : "font-extrabold")
                      }
                    >
                      {c.guest_name || `+${c.wa_phone}`}
                    </span>
                    {c.last_message && (
                      <span className="truncate text-xs text-muted-foreground">
                        {c.last_message}
                      </span>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Chat */}
      <div className="col-span-12 flex min-h-0 flex-col rounded-2xl border border-border bg-card sm:col-span-8">
        {active ? (
          <WhatsAppChat
            key={active}
            conversationId={active.startsWith("new:") ? null : active}
            phone={active.startsWith("new:") ? active.slice(4) : current?.wa_phone ?? ""}
            name={current?.guest_name ?? null}
            onSent={loadConvs}
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
            <Icon icon="ph:whatsapp-logo" className="size-10 text-muted-foreground/40" />
            {t("selectChat")}
          </div>
        )}
      </div>
    </div>
  );
}

function WhatsAppChat({
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
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [load]);

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
