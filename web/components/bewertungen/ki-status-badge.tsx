"use client";

// KI-Status als Badge: zwei Aussagen, die der Betrieb wirklich braucht —
// muss ich etwas freigeben, und wann läuft die KI das nächste Mal?
//
// Vorgänger war das Panel „KI live" (05.09.2026, dieselbe Datenquelle), das
// je offene Bewertung den Grund erklärte. Es war ein Debug-Werkzeug in der
// Kundenoberfläche und ging am selben Tag wieder raus; die Diagnose selbst
// bleibt als Route `/reviews/ki/diagnose` bestehen.
//
// Realtime: die KI-Tabellen sind für den Client gesperrt (Wurzel 6). Das
// Signal ist `review_ki_stand` (0568) — eine Zeile je Betrieb, die der Lauf
// bei jedem Schritt fortschreibt. Darauf hört das Badge und holt die
// Diagnose serverseitig gescopt neu. Kein Polling.
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useCallback, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";

import { type KiDiagnose, getKiDiagnose } from "@/lib/reviews";
import { useRealtime } from "@/lib/use-realtime";
import { formatDateTime } from "@/lib/utils";

const PILL = "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium";
const TON = {
  handeln: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  laeuft: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  ruhig: "bg-secondary text-muted-foreground",
} as const;

export function KiStatusBadge({ initial }: { initial: KiDiagnose | null }) {
  const t = useTranslations("reviews.kiStatus");
  const locale = useLocale();
  const [d, setD] = useState<KiDiagnose | null>(initial);
  const [, start] = useTransition();

  const laden = useCallback(() => {
    start(async () => {
      const res = await getKiDiagnose();
      // Ein Fehler beim Nachladen lässt den letzten bekannten Stand stehen —
      // ein leeres Badge wäre eine Falschaussage („nichts freizugeben").
      if (res.ok) setD(res.data);
    });
  }, []);

  useRealtime({ table: "review_ki_stand", onChange: laden });

  if (!d) return null;

  const freigaben = d.items.filter((e) => e.stufe === "entwurf_wartet").length;

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="ki-status-badge">
      {freigaben > 0 ? (
        <Link
          href="/bewertungen/geplant"
          className={`${PILL} ${TON.handeln} hover:opacity-90`}
          data-testid="ki-status-freigabe"
        >
          <Icon icon="ph:seal-check" className="size-3.5" />
          {t("freigabe", { n: freigaben })}
        </Link>
      ) : (
        <span className={`${PILL} ${TON.ruhig}`} data-testid="ki-status-freigabe">
          <Icon icon="ph:check" className="size-3.5" />
          {t("nichtsFreizugeben")}
        </span>
      )}

      {!d.ki_aktiv ? (
        <Link href="/bewertungen/ki" className={`${PILL} ${TON.ruhig} hover:opacity-90`}>
          <Icon icon="ph:power" className="size-3.5" />
          {t("kiAus")}
        </Link>
      ) : !d.katalog_gepflegt ? (
        <Link href="/bewertungen/ki" className={`${PILL} ${TON.handeln} hover:opacity-90`}>
          <Icon icon="ph:warning" className="size-3.5" />
          {t("katalogLeer")}
        </Link>
      ) : (
        <span className={`${PILL} ${TON.laeuft}`} data-testid="ki-status-lauf">
          <Icon icon="ph:clock" className="size-3.5" />
          {d.naechster_lauf_at
            ? t("naechsterLauf", { time: formatDateTime(d.naechster_lauf_at, locale) })
            : t("naechsterLaufTakt", { min: d.takt_minuten })}
        </span>
      )}
    </div>
  );
}
