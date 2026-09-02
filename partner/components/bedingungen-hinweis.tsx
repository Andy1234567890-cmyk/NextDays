"use client";

// Neue Version der Partner-AGB: Hinweis mit Link und Annahme-Knopf, bis der
// Partner zugestimmt hat (Version + Zeitstempel am Datensatz, Wurzel 1: die
// alte Zustimmung bleibt sichtbar als Datum stehen).
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { bedingungenAnnehmen } from "@/lib/partner-actions";

const MARKETING_URL = (process.env.NEXT_PUBLIC_MARKETING_URL ?? "").replace(/\/$/, "");

export function BedingungenHinweis({ aktuell, angenommen }: { aktuell: string; angenommen: string | null }) {
  const t = useTranslations("bedingungen");
  const router = useRouter();
  const [laeuft, starte] = useTransition();
  if (angenommen === aktuell) return null;
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent/40 bg-accent/5 px-4 py-3 text-sm">
      <p>
        {angenommen ? t("neueVersion", { alt: angenommen, neu: aktuell }) : t("nochNicht", { neu: aktuell })}{" "}
        {MARKETING_URL && (
          <a href={`${MARKETING_URL}/partner/agb`} target="_blank" rel="noopener noreferrer" className="font-semibold underline-offset-4 hover:underline">
            {t("lesen")}
          </a>
        )}
      </p>
      <button
        type="button"
        disabled={laeuft}
        onClick={() =>
          starte(async () => {
            const res = await bedingungenAnnehmen(aktuell);
            if (!res.ok) toast.error(res.fehler);
            else {
              toast.success(t("angenommen"));
              router.refresh();
            }
          })
        }
        className="rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background disabled:opacity-50"
      >
        {t("annehmen")}
      </button>
    </div>
  );
}
