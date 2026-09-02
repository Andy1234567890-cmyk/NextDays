// Dunkles Band (Lodgify-Muster): Bestandskunden dürfen empfehlen — ein Abo ist
// keine Voraussetzung, aber wer eines hat, kennt das Produkt.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import Link from "next/link";

import { PARTNER_BEWERBEN_URL } from "@/lib/app-url";

export function PartnerKundeCta() {
  const t = useTranslations("partner.kundeCta");
  return (
    <section className="py-10">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex flex-col gap-6 rounded-[2rem] bg-foreground px-8 py-10 text-background sm:flex-row sm:items-center sm:justify-between sm:px-12">
          <div>
            <h2 className="font-display text-3xl font-extrabold tracking-tight text-accent-foreground">{t("heading")}</h2>
            <p className="mt-2 max-w-xl text-background/80">{t("text")}</p>
          </div>
          <Link
            href={PARTNER_BEWERBEN_URL}
            data-cta="partner-kunde-bewerben"
            className="inline-flex shrink-0 items-center gap-3 rounded-full bg-background px-6 py-3 font-semibold text-foreground transition-transform hover:translate-x-0.5"
          >
            {t("cta")}
            <Icon icon="ph:arrow-right" className="size-5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
