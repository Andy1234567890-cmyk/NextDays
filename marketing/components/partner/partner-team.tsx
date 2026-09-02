// „Team aufbauen" (0520): das Zweistufen-Prinzip in drei Sätzen plus Leitplanken.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";

import { SectionHeading } from "@/components/marketing/section-kit";
import { type Rang, prozent } from "@/lib/partner";

const PUNKTE = ["rang", "ebene", "keinGeld", "dauer"] as const;

export function PartnerTeam({ staffel }: { staffel: Rang[] | null }) {
  const t = useTranslations("partner.team");
  // Differenzmodell (0525): das Maximum ist der höchste Satz der Staffel minus
  // dem niedrigsten — mehr Abstand kann zwischen Sponsor und Team-Partner nicht liegen.
  const max = staffel
    ? prozent(
        String(
          Math.max(...staffel.map((r) => Number(r.rate))) - Math.min(...staffel.map((r) => Number(r.rate))),
        ),
      )
    : "–";
  return (
    <section className="py-20">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center">
          <div>
            <SectionHeading eyebrow={t("eyebrow")} heading={t("heading", { max })} sub={t("sub")} align="left" />
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {PUNKTE.map((k) => (
              <li key={k} className="rounded-3xl border border-border bg-background p-6">
                <Icon icon="ph:check-circle" className="size-6 text-accent" />
                <p className="mt-3 font-semibold">{t(`${k}.titel`)}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t(`${k}.text`)}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
