// Abschluss-CTA — der letzte Block vor dem Footer.
//
// Referenz-UX (hostaway.com): unmittelbar vor dem Footer ein vollflächig
// gefärbter Block mit einer Frage als Überschrift, zwei Buttons (gefüllt +
// Outline in derselben hellen Farbe) und dem Logo als großes, sehr blasses
// Wasserzeichen rechts. Dieser Abschluss fehlte unserer Seite komplett — der
// Besucher landete nach dem Zitat direkt im Footer.
import { useTranslations } from "next-intl";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { SIGNUP_URL } from "@/lib/app-url";

export function MarketingCta() {
  const t = useTranslations("abschluss");

  return (
    <section className="bg-surface-warm">
      <div className="mx-auto max-w-7xl px-6 pb-24">
        <div className="relative overflow-hidden rounded-3xl bg-accent px-8 py-16 sm:px-14">
          {/* Wasserzeichen — konzentrische Ringe, wie das Logo-Motiv */}
          {/* Deckkraft als SVG-Attribut, nicht als Tailwind-Opacity-Suffix:
              die Arbitrary-Varianten kompilieren in v4 unzuverlässig und der
              Ring wäre dann deckend weiß statt ein Wasserzeichen. */}
          <svg
            aria-hidden
            viewBox="0 0 200 200"
            className="pointer-events-none absolute -right-16 top-1/2 hidden size-80 -translate-y-1/2 text-accent-foreground lg:block"
          >
            <circle
              cx="100"
              cy="100"
              r="80"
              fill="none"
              stroke="currentColor"
              strokeWidth="16"
              opacity="0.09"
            />
            <circle cx="100" cy="100" r="36" fill="currentColor" opacity="0.09" />
          </svg>

          <div className="relative max-w-2xl">
            <h2 className="font-display text-3xl font-extrabold leading-tight text-accent-foreground sm:text-4xl">
              {t("heading")}
            </h2>
            <p className="mt-5 text-lg text-accent-foreground/80">{t("sub")}</p>
            <div className="mt-9 flex flex-wrap gap-4">
              <Button
                asChild
                size="lg"
                className="bg-accent-foreground text-accent hover:opacity-90"
              >
                <Link href={SIGNUP_URL}>{t("ctaPrimaer")}</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-accent-foreground/40 bg-transparent text-accent-foreground hover:bg-accent-foreground/10"
              >
                <Link href="/preise">{t("ctaSekundaer")}</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
