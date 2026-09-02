"use client";

// Nachrichtenverlauf + Eingabe. Realtime auf affiliate_team_messages dieses
// Threads (setAuth(token) läuft im Hook vor subscribe).
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { datumZeit } from "@/lib/format";
import type { TeamNachricht } from "@/lib/partner";
import { teamNachrichtSenden } from "@/lib/partner-actions";
import { useRealtime } from "@/lib/use-realtime";

export function TeamChatVerlauf({ threadId, nachrichten, locale }: { threadId: string; nachrichten: TeamNachricht[]; locale: string }) {
  const t = useTranslations("team.chat");
  const router = useRouter();
  const [text, setText] = useState("");
  const [laeuft, starte] = useTransition();
  useRealtime({ table: "affiliate_team_messages", filter: `thread_id=eq.${threadId}`, onChange: () => router.refresh() });

  const senden = () =>
    starte(async () => {
      const res = await teamNachrichtSenden(threadId, text.trim());
      if (!res.ok) {
        toast.error(res.fehler);
        return;
      }
      setText("");
      router.refresh();
    });

  return (
    <div className="mt-6">
      <ul className="space-y-3">
        {nachrichten.length === 0 && <li className="text-sm text-muted-foreground">{t("leer")}</li>}
        {nachrichten.map((n) => (
          <li key={n.id} className={`flex ${n.mine ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-2xl border px-4 py-3 text-sm ${n.mine ? "border-foreground bg-foreground text-background" : "border-border"}`}>
              <p className={`text-xs ${n.mine ? "text-background/70" : "text-muted-foreground"}`}>{datumZeit(n.created_at, locale)}</p>
              <p className="mt-1 whitespace-pre-wrap">{n.body}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-6 rounded-2xl border border-border p-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          maxLength={4000}
          placeholder={t("platzhalter")}
          className="w-full resize-y rounded-xl border border-border bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-foreground"
        />
        <div className="mt-3 flex justify-end">
          <button type="button" disabled={laeuft || !text.trim()} onClick={senden} className="rounded-full bg-foreground px-5 py-2 text-sm font-semibold text-background disabled:opacity-50">
            {t("senden")}
          </button>
        </div>
      </div>
    </div>
  );
}
