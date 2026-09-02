"use client";

// Liste der Konversationen + Start einer neuen. Live über Realtime auf
// support_tickets (RLS liefert nur die eigenen Zeilen).
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import type { Konversation } from "@/lib/support";
import { konversationStarten } from "@/lib/support-actions";
import { useRealtime } from "@/lib/use-realtime";

export function NachrichtenListe({ konversationen, locale }: { konversationen: Konversation[]; locale: string }) {
  const t = useTranslations("nachrichten");
  const router = useRouter();
  const [laeuft, starte] = useTransition();
  const [text, setText] = useState("");
  const [neu, setNeu] = useState(konversationen.length === 0);

  useRealtime({ table: "support_tickets", onChange: () => router.refresh() });

  function senden() {
    if (!text.trim()) return;
    const clientMsgId = crypto.randomUUID();
    starte(async () => {
      const res = await konversationStarten(text.trim(), clientMsgId);
      if (res.ok) {
        setText("");
        router.push(`/nachrichten/${res.data.id}`);
      } else toast.error(res.status === 503 ? t("stoerung") : t("fehler"));
    });
  }

  return (
    <div className="mt-8">
      {neu ? (
        <div className="rounded-2xl border border-border p-5">
          <p className="text-sm font-semibold">{t("neu")}</p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            maxLength={5000}
            placeholder={t("platzhalter")}
            className="mt-3 w-full resize-none rounded-2xl border border-border bg-transparent px-4 py-3 text-sm outline-none focus-visible:border-foreground"
          />
          <div className="mt-3 flex gap-3">
            <button type="button" disabled={laeuft || !text.trim()} onClick={senden} className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background disabled:opacity-50">
              {t("senden")}
            </button>
            {konversationen.length > 0 && (
              <button type="button" onClick={() => setNeu(false)} className="text-sm text-muted-foreground underline-offset-4 hover:underline">
                {t("abbrechen")}
              </button>
            )}
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setNeu(true)} className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background">
          {t("neu")}
        </button>
      )}

      <ul className="mt-6 divide-y divide-border rounded-2xl border border-border">
        {konversationen.length === 0 && !neu && <li className="px-5 py-4 text-sm text-muted-foreground">{t("leer")}</li>}
        {konversationen.map((k) => (
          <li key={k.id}>
            <Link href={`/nachrichten/${k.id}`} className="flex items-baseline justify-between gap-4 px-5 py-4 hover:bg-muted/50">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">
                  {k.subject}
                  {k.unread > 0 && (
                    <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-[0.6875rem] font-semibold text-accent-foreground">
                      {k.unread}
                    </span>
                  )}
                </span>
                <span className="block truncate text-xs text-muted-foreground">{k.last_message_preview ?? ""}</span>
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {t(`status.${k.status}`)} ·{" "}
                {k.last_message_at ? new Date(k.last_message_at).toLocaleDateString(locale, { timeZone: "Europe/Copenhagen" }) : ""}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
