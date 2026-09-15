// Funktionsübersicht — eine Matrix aus Gruppen in EINEM Rahmen.
//
// Referenz-UX (hostaway.com, „Everything needed to … in one place"): ein
// umrandeter weißer Block, darin 3×3 Gruppen aus Icon, fettem Titel und einer
// Komma-Liste der enthaltenen Funktionen; oben ein hervorgehobener Kasten für
// das Neue, unten ein Ghost-Button.
//
// Ersetzt die frühere Tab-Leiste: 14 Reiter zeigten immer nur EINE Funktion,
// die Matrix zeigt den kompletten Umfang auf einen Blick — genau darum geht es
// in dieser Sektion. Was zum Launch (01.09.2026) fehlt, trägt „Kommt 2027".
import { useTranslations } from "next-intl";
import Link from "next/link";

import { SectionHeading } from "@/components/marketing/section-kit";
import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { gruppenStichworte } from "@/lib/gruppen-stichworte";

// Schlüssel + Icon; Titel und die Aufzählung kommen aus messages
// (features.gruppen.*). `bald` markiert eine Gruppe, in der noch nicht alles da ist.
const GRUPPEN: { key: string; icon: IconName; bald?: boolean }[] = [
  { key: "pms", icon: "ph:calendar-blank" },
  { key: "channel", icon: "ph:share-network" },
  { key: "direkt", icon: "ph:globe-hemisphere-west" },
  { key: "preise", icon: "ph:trend-up" },
  { key: "gaeste", icon: "ph:users-three" },
  { key: "ki", icon: "ph:sparkle" },
  { key: "zahlungen", icon: "ph:credit-card" },
  { key: "team", icon: "ph:key" },
  { key: "app", icon: "ph:device-mobile-camera" },
  { key: "eigentuemer", icon: "ph:file-text" },
  { key: "auswertungen", icon: "ph:chart-bar" },
];

/**
 * `satzExtern`: der Provisionssatz für Direktbuchungen, vom Server formatiert
 * (`holeProvisionssaetze` in `app/page.tsx`). Nur die Stichwortzeile der
 * Gruppe „direkt" nennt ihn; die anderen acht ignorieren den Parameter.
 */
export function MarketingFeatures({ satzExtern }: { satzExtern: string | null }) {
  const t = useTranslations("features");
  const tg = useTranslations("features.gruppen");

  return (
    <section id="funktionen" className="bg-background">
      <div className="mx-auto max-w-7xl px-6 py-24">
        <SectionHeading eyebrow={t("eyebrow")} heading={t("heading")} sub={t("sub")} />

        <div className="mt-14 rounded-3xl border border-border bg-card p-8 shadow-soft sm:p-12">
          {/* Hervorgehobener Kasten: das Neue steht über der Matrix, nicht
              versteckt in einer der zehn Gruppen. */}
          <div className="mx-auto max-w-md rounded-2xl bg-gradient-to-br from-surface-accent to-surface-warm p-5 text-center">
            <p className="flex flex-wrap items-center justify-center gap-2 font-display text-lg font-semibold">
              <Icon icon="ph:sparkle" className="size-5 text-accent" />
              {t("neu.title")}
              <span className="rounded-full bg-card px-2.5 py-0.5 text-xs font-medium text-accent">
                {t("baldBadge")}
              </span>
            </p>
            <p className="mt-2 text-sm text-muted-foreground">{t("neu.text")}</p>
          </div>

          <div className="mt-10 grid gap-x-10 gap-y-9 md:grid-cols-2 lg:grid-cols-3">
            {GRUPPEN.map((g) => (
              <div key={g.key} className="flex gap-3.5">
                <Icon icon={g.icon} className="mt-0.5 size-5 shrink-0 text-accent" />
                <div>
                  <h3 className="flex flex-wrap items-center gap-2 font-display text-base font-semibold">
                    {t(`gruppen.${g.key}.title`)}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {gruppenStichworte(tg, g.key, satzExtern)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Add-on-Abgrenzung: was im Grundpreis steckt und was Zusatzmodul ist. */}
          <p className="mt-10 border-t border-border pt-6 text-sm text-muted-foreground">
            {t("hinweis")}
          </p>
        </div>

        <div className="mt-10 flex justify-center">
          <Button asChild variant="outline" size="lg">
            <Link href="#testen" className="gap-2">
              {t("alleAnsehen")}
              <Icon icon="ph:arrow-right" className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
