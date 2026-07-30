// KI & Sprache — farbiger Block mit Check-Liste links und Produkt-Szene rechts.
//
// Referenz-UX (hostaway.com, „Hostaway AI"): eine vollflächig eingefärbte
// Sektion mit zentriertem Titel, drei Häkchen-Punkten (fette Zeile + Erklärung),
// einem dunklen CTA und rechts einem Foto, über dem Chat-Blasen schweben.
// Übernommen sind Aufbau und Bildidee; die Aussagen sind unsere echten
// Funktionen — bewusst OHNE Prozentversprechen („93 % automatisiert",
// „25 % mehr Umsatz"), die wir vor dem Start am 01.09.2026 nicht belegen können.
import { useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";

import { WaveEdge } from "@/components/marketing/section-kit";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

const PUNKTE = ["voice", "concierge", "preise"] as const;

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
                <li key={p} className="flex gap-4">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Icon icon="ph:check-bold" className="size-4" />
                  </span>
                  <div>
                    <h3 className="font-display text-lg font-semibold">
                      {t(`${p}.title`)}
                    </h3>
                    <p className="mt-2 text-foreground/70">{t(`${p}.text`)}</p>
                  </div>
                </li>
              ))}
            </ul>

            <Button asChild size="lg" variant="default" className="mt-10">
              <Link href="#funktionen">{t("cta")}</Link>
            </Button>
          </div>

          {/* Szene: Foto mit schwebenden Sprach-Blasen */}
          <div className="relative mx-auto w-full max-w-md">
            <div className="relative aspect-[3/4] w-full overflow-hidden rounded-3xl bg-surface-accent shadow-float-lg">
              <Image
                src="/marketing/usecases/ki-nutzung.jpg"
                alt=""
                fill
                loading="eager"
                sizes="(min-width: 1024px) 28rem, 100vw"
                className="object-cover"
              />
            </div>

            {/* Frage der Vermieterin */}
            <div className="absolute -left-4 top-10 max-w-[15rem] rounded-2xl rounded-bl-sm bg-card px-4 py-3 text-sm shadow-float sm:-left-10">
              {t("blaseFrage")}
            </div>

            {/* Antwort der Plattform */}
            <div className="absolute -right-4 top-1/3 max-w-[16rem] rounded-2xl rounded-br-sm bg-card px-4 py-3 text-sm shadow-float sm:-right-10">
              <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-accent">
                <Icon icon="ph:sparkle" className="size-3.5" />
                myNextDays
              </span>
              {t("blaseAntwort")}
            </div>

            {/* Eingabefeld mit Mikrofon */}
            <div className="absolute -bottom-6 left-1/2 flex w-[19rem] max-w-[calc(100%+2rem)] -translate-x-1/2 items-center gap-3 rounded-full bg-card px-5 py-3 shadow-float">
              <span className="flex-1 truncate text-sm text-muted-foreground">
                {t("eingabe")}
              </span>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <Icon icon="ph:microphone" className="size-4" />
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
