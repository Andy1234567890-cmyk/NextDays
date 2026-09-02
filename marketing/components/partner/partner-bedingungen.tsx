// Die Regeln des Programms — sechs Karten. Was hier steht, steht auch in den
// Partner-Bedingungen; die Seite verspricht nichts, was das Dokument nicht hält.
import { useTranslations } from "next-intl";

import { SectionHeading } from "@/components/marketing/section-kit";
import { Icon, type IconName } from "@/components/ui/icon";

const REGELN: readonly { key: string; icon: IconName }[] = [
  { key: "basis", icon: "ph:chart-bar" },
  { key: "dauer", icon: "ph:hourglass-high" },
  { key: "auszahlung", icon: "ph:credit-card" },
  { key: "kennzeichnung", icon: "ph:tag" },
  { key: "verboten", icon: "ph:warning" },
  { key: "daten", icon: "ph:shield-check" },
];

export function PartnerBedingungen() {
  const t = useTranslations("partner.bedingungen");

  return (
    <section className="bg-surface-warm py-20">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeading eyebrow={t("eyebrow")} heading={t("heading")} />
        <ul className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {REGELN.map((r) => (
            <li key={r.key} className="rounded-3xl border border-border bg-background p-7">
              <Icon icon={r.icon} className="size-6 text-accent" />
              <h3 className="mt-4 font-display text-lg font-semibold">{t(`${r.key}.titel`)}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{t(`${r.key}.text`)}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
