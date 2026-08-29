// Das Band während der kostenlosen Testphase (0488).
//
// Warum es das braucht: Am Tag nach dem Ablauf zieht Stripe den ersten Beitrag
// ein. Die Testphase beginnt beim Abschluss und läuft danach still — niemand
// merkt sich das Datum. Ohne diesen Hinweis ist die erste Abbuchung eine
// Belastung aus dem Nichts, und genau daraus werden Rückbuchungen.
//
// Zwei Warnungen, verschiedene Leser: Stripe schickt drei Tage vorher eine
// E-Mail (`trial_will_end` → `melde_testphase_endet`), die den Posteingang
// erreicht. Dieses Band erreicht den, der gerade arbeitet und keine Mail liest.
//
// Warum kein „Schließen"-Knopf: dieselbe Begründung wie beim DemoBand — weg
// wäre es genau in der Sitzung, in der es gebraucht wird. Es ist flach und
// ruhig gehalten und verschwindet von selbst, sobald das Abo läuft.
"use client";

import { Icon } from "@iconify/react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

export function TestphaseBand({ endetAm }: { endetAm: string | null }) {
  const t = useTranslations("account.subscription");
  const locale = useLocale();

  // Ohne Datum KEIN gerechnetes Ersatzdatum (Wurzel 4): dann trägt das Band
  // nur die Aufforderung. Sie stimmt auch ohne Tag, und das genaue Datum
  // steht im Konto.
  const datum = endetAm
    ? new Date(endetAm).toLocaleDateString(locale, {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div
      // `role="note"`: eine dauerhafte Randbedingung, keine Meldung auf ein
      // Ereignis. Ein `alert` unterbräche Screenreader bei jedem Seitenwechsel.
      role="note"
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-border bg-secondary px-4 py-2 text-center text-sm"
    >
      <span className="flex items-center gap-2 font-medium">
        <Icon icon="ph:clock" className="size-4 shrink-0" aria-hidden="true" />
        {t("trialBannerTitel")}
      </span>
      {datum && (
        <span className="text-muted-foreground">
          {t("trialBannerText", { datum })}
        </span>
      )}
      <Link
        href="/konto/tarif"
        className="font-semibold underline underline-offset-4"
      >
        {t("trialBannerKnopf")}
      </Link>
    </div>
  );
}
