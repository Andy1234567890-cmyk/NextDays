"use client";

// Der AGENT-Reiter der rechten Leiste (Framer §15). Er steht heute als
// Platzhalter da, weil sein Anbieter noch nicht angebunden ist: der Agent
// wird mit OpenAI gebaut (Etappe 6 des Plans) und braucht dafür den
// `OPENAI_API_KEY` in der Umgebung. Bis dahin sagt der Reiter GENAU das —
// statt einen Chat zu zeigen, der ins Leere schreibt, oder still auf einen
// anderen Anbieter auszuweichen (Entscheidung des Nutzers, 05.09.2026).
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";

export function AgentReiter() {
  const t = useTranslations("website.canvas.agent");
  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-center gap-2">
        <div className="flex h-9 min-w-0 flex-1 items-center justify-between rounded-lg bg-secondary px-3 text-[13px] text-muted-foreground">
          <span>{t("neuerChat")}</span>
          <Icon icon="ph:caret-down" className="size-3.5" />
        </div>
        <button
          type="button"
          disabled
          aria-label={t("neuerChat")}
          className="flex size-9 items-center justify-center rounded-lg bg-secondary text-muted-foreground opacity-60"
        >
          <Icon icon="ph:plus" className="size-4" />
        </button>
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <Icon icon="ph:info" className="size-4 text-muted-foreground" />
        <p className="mt-2 text-[13px] font-semibold">{t("nichtEingerichtet")}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {t("nichtEingerichtetHinweis")}
        </p>
        <code className="mt-3 block rounded-md bg-secondary px-2 py-1.5 font-mono text-[11px]">
          OPENAI_API_KEY
        </code>
      </div>
    </div>
  );
}
