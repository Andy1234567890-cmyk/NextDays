"use client";

// Verlauf + Antwortfeld. Antworten des Teams erscheinen live (Realtime auf
// support_messages, gefiltert auf dieses Ticket; interne Notizen lösen durch
// die RLS-Policy gar kein Event aus).
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import type { KonversationDetail } from "@/lib/support";
import { antworten } from "@/lib/support-actions";
import { useRealtime } from "@/lib/use-realtime";

export function NachrichtVerlauf({ konversation, locale }: { konversation: KonversationDetail; locale: string }) {
  const t = useTranslations("nachrichten");
  const router = useRouter();
  const [laeuft, starte] = useTransition();
  const [text, setText] = useState("");

  useRealtime({ table: "support_messages", filter: `ticket_id=eq.${konversation.id}`, onChange: () => router.refresh() });
  useRealtime({ table: "support_tickets", filter: `id=eq.${konversation.id}`, onChange: () => router.refresh() });

  function senden() {
    if (!text.trim()) return;
    const clientMsgId = crypto.randomUUID();
    starte(async () => {
      const res = await antworten(konversation.id, text.trim(), clientMsgId);
      if (res.ok) setText("");
      else toast.error(res.status === 503 ? t("stoerung") : t("fehler"));
    });
  }

  const zeit = (w: string) => new Date(w).toLocaleString(locale, { timeZone: "Europe/Copenhagen", dateStyle: "short", timeStyle: "short" });

  return (
    <>
      <div className="mt-4 flex items-start justify-between gap-4">
        <h1 className="font-sans text-[1.75rem] font-bold tracking-tight">{konversation.subject}</h1>
        <span className="mt-1 shrink-0 rounded-full bg-muted px-3 py-1 text-xs font-semibold">{t(`status.${konversation.status}`)}</span>
      </div>
      <div className="mt-8 space-y-4">
        {konversation.messages.map((m) => {
          const vomTeam = m.author_kind === "agent";
          return (
            <div key={m.id} className={`flex ${vomTeam ? "justify-start" : "justify-end"}`}>
              <div className={`max-w-[85%] rounded-2xl px-5 py-4 ${vomTeam ? "bg-muted/50" : "border border-border"}`}>
                <p className="text-xs font-semibold text-muted-foreground">
                  {vomTeam ? t("team") : t("du")} · {zeit(m.created_at)}
                </p>
                <p className="mt-1.5 whitespace-pre-wrap text-[0.9375rem] leading-relaxed">{m.body}</p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-8 rounded-2xl border border-border p-5">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={5000} placeholder={t("antwortPlatzhalter")} className="w-full resize-none bg-transparent text-[0.9375rem] outline-none" />
        <div className="mt-4 flex justify-end border-t border-border pt-4">
          <button type="button" disabled={laeuft || !text.trim()} onClick={senden} className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background disabled:opacity-50">
            {t("antworten")}
          </button>
        </div>
      </div>
    </>
  );
}
