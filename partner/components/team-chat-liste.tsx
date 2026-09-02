"use client";

// Chat Sponsor ↔ Team-Mitglied: bestehende Unterhaltungen plus Einstieg je Partner.
// Live über Realtime auf affiliate_team_threads (Policy: nur die beiden Beteiligten).
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import type { TeamThread } from "@/lib/partner";
import { teamThreadStarten } from "@/lib/partner-actions";
import { useRealtime } from "@/lib/use-realtime";

type Partner = { id: string; name: string; role: "sponsor" | "member" };

export function TeamChatListe({ threads, partner }: { threads: TeamThread[]; partner: Partner[] }) {
  const t = useTranslations("team.chat");
  const router = useRouter();
  const [laeuft, starte] = useTransition();
  useRealtime({ table: "affiliate_team_threads", onChange: () => router.refresh() });
  useRealtime({ table: "affiliate_team_messages", onChange: () => router.refresh() });

  const ohneThread = partner.filter((p) => !threads.some((th) => th.partner_id === p.id));

  const starten = (p: Partner) =>
    starte(async () => {
      const res = await teamThreadStarten(p.id);
      if (!res.ok) {
        toast.error(res.fehler);
        return;
      }
      router.push(`/team/${res.data.id}`);
    });

  if (partner.length === 0) return null;
  return (
    <section className="mt-10">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("titel")}</h2>
      <ul className="mt-3 divide-y divide-border rounded-2xl border border-border text-sm">
        {threads.map((th) => (
          <li key={th.id}>
            <Link href={`/team/${th.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50">
              <Icon icon="ph:chat-circle-dots" className="size-5 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate font-medium">{th.partner_name}</span>
              <span className="text-xs text-muted-foreground">{t(`rolle.${th.role}`)}</span>
              {th.unread > 0 && (
                <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">{th.unread}</span>
              )}
            </Link>
          </li>
        ))}
        {ohneThread.map((p) => (
          <li key={p.id} className="flex items-center gap-3 px-4 py-3">
            <Icon icon="ph:chat-circle" className="size-5 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">{p.name}</span>
            <span className="text-xs text-muted-foreground">{t(`rolle.${p.role}`)}</span>
            <button type="button" disabled={laeuft} onClick={() => starten(p)} className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:border-foreground disabled:opacity-50">
              {t("schreiben")}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
