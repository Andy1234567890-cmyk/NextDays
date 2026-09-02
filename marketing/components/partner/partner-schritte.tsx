// Drei Schritte: bewerben, teilen, verdienen.
import { useTranslations } from "next-intl";

import { SectionHeading } from "@/components/marketing/section-kit";
import { Icon, type IconName } from "@/components/ui/icon";

const SCHRITTE: readonly { key: string; icon: IconName }[] = [
  { key: "bewerben", icon: "ph:file-text" },
  { key: "teilen", icon: "ph:share-network" },
  { key: "verdienen", icon: "ph:trend-up" },
];

export function PartnerSchritte() {
  const t = useTranslations("partner.schritte");

  return (
    <section className="bg-surface-warm py-20">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeading eyebrow={t("eyebrow")} heading={t("heading")} />
        <ol className="mt-12 grid gap-6 md:grid-cols-3">
          {SCHRITTE.map((s, i) => (
            <li key={s.key} className="rounded-3xl border border-border bg-background p-8">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-foreground">
                  {i + 1}
                </span>
                <Icon icon={s.icon} className="size-6 text-accent" />
              </div>
              <h3 className="mt-5 font-display text-xl font-semibold">{t(`${s.key}.titel`)}</h3>
              <p className="mt-2 text-muted-foreground">{t(`${s.key}.text`)}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
