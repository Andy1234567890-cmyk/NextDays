"use client";

// Ein Empfehlungscode mit Link und Kopier-Knopf.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import type { Code } from "@/lib/partner";

export function CodeKarte({ code }: { code: Code }) {
  const t = useTranslations("links");

  async function kopieren(wert: string) {
    try {
      await navigator.clipboard.writeText(wert);
      toast.success(t("kopiert"));
    } catch {
      toast.error(t("kopierenFehlgeschlagen"));
    }
  }

  return (
    <div className="rounded-2xl border border-border p-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-mono text-lg font-bold">{code.code}</p>
        <span className="text-xs text-muted-foreground">{t("klicks30", { n: code.clicks_30d })}</span>
      </div>
      {code.label && <p className="mt-1 text-sm text-muted-foreground">{code.label}</p>}
      <div className="mt-4 flex flex-col gap-2 text-sm">
        {code.tracking_url ? (
          <button
            type="button"
            onClick={() => kopieren(code.tracking_url as string)}
            className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2 text-left hover:border-foreground"
          >
            <span className="truncate font-mono text-xs">{code.tracking_url}</span>
            <Icon icon="ph:copy" className="size-4 shrink-0" />
          </button>
        ) : (
          <p className="text-xs text-muted-foreground">{t("linkFehlt")}</p>
        )}
        <button
          type="button"
          onClick={() => kopieren(code.code)}
          className="flex items-center gap-2 text-xs font-semibold underline-offset-4 hover:underline"
        >
          <Icon icon="ph:copy" className="size-3.5" />
          {t("codeKopieren")}
        </button>
      </div>
    </div>
  );
}
