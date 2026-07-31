// KI & Sprache — farbiger Block mit Check-Liste links und Produkt-Szene rechts.
//
// Referenz-UX (hostaway.com, „Hostaway AI"): eine vollflächig eingefärbte
// Sektion mit zentriertem Titel, drei Häkchen-Punkten (fette Zeile + Erklärung),
// einem dunklen CTA und rechts einem Foto, über dem Chat-Blasen schweben.
// Übernommen sind Aufbau und Bildidee; die Aussagen sind unsere echten
// Funktionen — bewusst OHNE Prozentversprechen („93 % automatisiert",
// „25 % mehr Umsatz"), die wir vor dem Start am 01.09.2026 nicht belegen können.
import { useTranslations } from "next-intl";
import Link from "next/link";

import { KiSzene } from "@/components/marketing/ki-szene";
import { WaveEdge } from "@/components/marketing/section-kit";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

// `bald` = zum Launch (01.09.2026) noch nicht verfügbar. Die Sektion darf nicht
// den Eindruck erwecken, alles sei ab Tag eins da — dieselbe Kennzeichnung wie
// im Funktions-Raster.
const PUNKTE = [
  { key: "voice", bald: true },
  { key: "concierge", bald: false },
  { key: "preise", bald: false },
] as const;

export function MarketingKi() {
  const t = useTranslations("ki");

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-surface-warm via-surface-accent to-accent">
      {/* Der Farbblock läuft oben und unten wellenförmig in die angrenzenden
          hellen Sektionen aus, statt hart abzuschneiden. */}
      <WaveEdge position="top" />
      <WaveEdge position="bottom" />
      {/* Geometrisches Deko-Element rechts, wie die Farbfläche der Referenz */}
      <svg
        aria-hidden
        viewBox="0 0 200 200"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-y-0 right-0 hidden h-full w-1/3 text-accent lg:block"
      >
        <path d="M200 0v200H60z" fill="currentColor" opacity="0.35" />
      </svg>

      {/* pt/pb größer als sonst: die Wellenkanten brauchen Luft. */}
      <div className="relative mx-auto max-w-7xl px-6 pb-32 pt-32">
        <div className="mx-auto max-w-3xl text-center">
          <p className="eyebrow">{t("eyebrow")}</p>
          <h2 className="mt-4 font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            {t("heading")}
          </h2>
          <p className="mt-4 text-lg text-foreground/70">{t("sub")}</p>
        </div>

        <div className="mt-16 grid items-center gap-14 lg:grid-cols-2">
          {/* Punkte */}
          <div>
            <ul className="flex flex-col gap-8">
              {PUNKTE.map((p) => (
                <li key={p.key} className="flex gap-4">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Icon icon="ph:check-bold" className="size-4" />
                  </span>
                  <div>
                    <h3 className="flex flex-wrap items-center gap-2.5 font-display text-lg font-semibold">
                      {t(`${p.key}.title`)}
                      {p.bald ? (
                        <span className="rounded-full bg-card px-2.5 py-0.5 text-xs font-medium text-accent">
                          {t("baldBadge")}
                        </span>
                      ) : null}
                    </h3>
                    <p className="mt-2 text-foreground/70">{t(`${p.key}.text`)}</p>
                  </div>
                </li>
              ))}
            </ul>

            <Button asChild size="lg" variant="default" className="mt-10">
              <Link href="#funktionen">{t("cta")}</Link>
            </Button>
          </div>

          {/* Szene: Foto mit Sprechblasen, die nacheinander erscheinen. */}
          <KiSzene />
        </div>
      </div>
    </section>
  );
}
