// Grundsätze — was wir tun und was wir bewusst lassen.
//
// Referenz-UX (mews.com/en/about, „The Mews Constitution"): fünf kurze
// Prinzipien als eigener Abschnitt vor dem Abschluss-CTA. Übernommen ist die
// Form, nicht der Inhalt — Mews' Sätze („simplify complexity") sind Haltung
// ohne Prüfbarkeit. Jeder Punkt hier lässt sich am Produkt nachsehen: die
// Verfügbarkeitszahl, die Preisseite, die Rechtstexte, die Registerdaten.
import { useTranslations } from "next-intl";

import { SectionHeading } from "@/components/marketing/section-kit";
import { Icon, type IconName } from "@/components/ui/icon";

const GRUNDSAETZE: readonly { key: string; icon: IconName }[] = [
  { key: "doppelbuchung", icon: "ph:calendar-check" },
  { key: "preise", icon: "ph:seal-check" },
  { key: "europa", icon: "ph:globe-hemisphere-west" },
  { key: "daten", icon: "ph:shield-check" },
  { key: "unabhaengig", icon: "ph:handshake" },
  { key: "selbst", icon: "ph:key" },
];

export function UeberWerte() {
  const t = useTranslations("ueberUns.werte");

  return (
    <section className="bg-background">
      <div className="mx-auto max-w-7xl px-6 py-24">
        <SectionHeading
          eyebrow={t("eyebrow")}
          heading={t("heading")}
          sub={t("sub")}
        />

        <div className="mt-14 grid gap-x-10 gap-y-12 md:grid-cols-2 lg:grid-cols-3">
          {GRUNDSAETZE.map((g) => (
            <div key={g.key}>
              <span className="flex size-12 items-center justify-center rounded-2xl bg-surface-accent text-accent">
                <Icon icon={g.icon} className="size-6" />
              </span>
              <h3 className="mt-5 font-display text-lg font-semibold">
                {t(`${g.key}.titel`)}
              </h3>
              <p className="mt-2 leading-relaxed text-muted-foreground">
                {t(`${g.key}.text`)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
