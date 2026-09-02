"use client";

// Team-Link: /p/CODE?team=1 — wer darüber kommt, sieht in der Bewerbung den
// Sponsor-Code sichtbar vorbelegt (kein Cookie, wie beim Betrieb).
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState } from "react";

export function TeamLinkKarte({ link }: { link: string | null }) {
  const t = useTranslations("team.link");
  const [kopiert, setKopiert] = useState(false);
  return (
    <div className="rounded-2xl border border-border p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("titel")}</p>
      <p className="mt-1 text-sm text-muted-foreground">{t("text")}</p>
      {link ? (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-border px-3 py-2 font-mono text-xs">
          <span className="min-w-0 flex-1 truncate">{link}</span>
          <button
            type="button"
            aria-label={t("kopieren")}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                setKopiert(true);
                setTimeout(() => setKopiert(false), 1500);
              } catch {
                /* Zwischenablage nicht erlaubt — der Link steht sichtbar daneben. */
              }
            }}
            className="rounded-full p-1.5 hover:bg-muted"
          >
            <Icon icon={kopiert ? "ph:check" : "ph:copy"} className="size-4" />
          </button>
        </div>
      ) : (
        <p className="mt-3 text-sm text-accent">{t("keinLink")}</p>
      )}
    </div>
  );
}
