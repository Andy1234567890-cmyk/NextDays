// Hero der Programmseite — dunkle Fläche wie Kontakt/Preise/Über uns.
import { useTranslations } from "next-intl";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { PARTNER_BEWERBEN_URL, PARTNER_LOGIN_URL } from "@/lib/app-url";

const CHIPS: readonly { key: string; icon: IconName }[] = [
  { key: "chipDauer", icon: "ph:hourglass-high" },
  { key: "chipAuszahlung", icon: "ph:credit-card" },
  { key: "chipKosten", icon: "ph:seal-check" },
  // Endkunden-Anreiz (Master-Strategie 02.09.2026): 14 Tage Test + 1 Gratismonat über Partnerlink.
  { key: "chipGratismonat", icon: "ph:gift" },
];

export function PartnerHero({ max }: { max: string }) {
  const t = useTranslations("partner.hero");

  return (
    <section className="relative overflow-hidden bg-primary pb-24 pt-16 text-primary-foreground">
      <svg
        aria-hidden
        viewBox="0 0 200 200"
        className="pointer-events-none absolute -right-24 -top-24 hidden size-[32rem] text-primary-foreground lg:block"
      >
        <circle cx="100" cy="100" r="80" fill="none" stroke="currentColor" strokeWidth="14" opacity="0.06" />
        <circle cx="100" cy="100" r="40" fill="currentColor" opacity="0.05" />
      </svg>

      <div className="relative mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <p className="eyebrow">{t("eyebrow")}</p>
          <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            {t("headlinePre")} <span className="text-accent">{t("headlineHighlight")}</span>
          </h1>
          <p className="mt-6 text-lg text-primary-foreground/75">{t("sub", { max })}</p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Button asChild size="lg" variant="accent" className="min-w-48 text-base">
              <Link href={PARTNER_BEWERBEN_URL} data-cta="partner-bewerben">
                {t("cta")}
              </Link>
            </Button>
            <Link
              href={PARTNER_LOGIN_URL}
              className="text-sm font-semibold text-primary-foreground/80 underline-offset-4 hover:underline"
            >
              {t("ctaLogin")}
            </Link>
          </div>

          <ul className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-primary-foreground/70">
            {CHIPS.map((c) => (
              <li key={c.key} className="inline-flex items-center gap-2">
                <Icon icon={c.icon} className="size-4 text-accent" />
                {t(c.key)}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
