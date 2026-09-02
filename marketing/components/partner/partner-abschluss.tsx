// Abschluss-CTA der Programmseite — gleiche Form wie MarketingCta, anderes Ziel.
import { useTranslations } from "next-intl";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { PARTNER_BEWERBEN_URL } from "@/lib/app-url";

export function PartnerAbschluss() {
  const t = useTranslations("partner.abschluss");

  return (
    <section className="bg-surface-warm">
      <div className="mx-auto max-w-7xl px-6 pb-24 pt-8">
        <div className="relative overflow-hidden rounded-3xl bg-accent px-8 py-16 text-accent-foreground sm:px-14">
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">{t("heading")}</h2>
          <p className="mt-3 max-w-xl text-accent-foreground/85">{t("sub")}</p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Button asChild size="lg" variant="default" className="min-w-48 text-base">
              <Link href={PARTNER_BEWERBEN_URL} data-cta="partner-bewerben">
                {t("cta")}
              </Link>
            </Button>
            <Link href="/kontakt?thema=partner" className="text-sm font-semibold underline-offset-4 hover:underline">
              {t("kontakt")}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
