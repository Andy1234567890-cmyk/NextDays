// Hero — Credibility-Banner, Headline mit Kurven-Akzent, CTA-Buttons, Visual.
// Figma: zweispaltig (Text links, Produkt-Mockup rechts).
import { Icon } from "@iconify/react";
import Link from "next/link";

import { Button } from "@nextdays/ui/button";

export function MarketingHero() {
  return (
    <section className="relative overflow-hidden bg-secondary/40">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 py-20 lg:grid-cols-2 lg:py-28">
        <div>
          {/* Credibility-Banner: Sterne + Reviews */}
          <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex items-center gap-1.5">
              <div className="flex text-accent">
                {[0, 1, 2, 3].map((i) => (
                  <Icon key={i} icon="ph:star-fill" className="size-4" />
                ))}
                <Icon icon="ph:star-half-fill" className="size-4" />
              </div>
              <span className="text-sm font-semibold">4,5 Sterne</span>
              <span className="text-sm text-muted-foreground">· 921 Bewertungen</span>
            </div>
            <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
              Empfohlen von 53.000+ Gastgebern
            </span>
          </div>

          <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            Eine starke Plattform für{" "}
            <span className="relative whitespace-nowrap text-accent">
              kleine Unterkünfte
              <svg
                aria-hidden
                viewBox="0 0 300 20"
                className="absolute -bottom-2 left-0 w-full text-accent"
                preserveAspectRatio="none"
              >
                <path
                  d="M2 14 C 80 4, 220 4, 298 12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            .
          </h1>

          <p className="mt-7 max-w-xl text-lg text-muted-foreground">
            Steigere deine Buchungen, vereinfache deinen Betrieb und biete
            unvergessliche Gästeerlebnisse – alles an einem Ort.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Button asChild variant="accent" size="lg">
              <Link href="/register">30 Tage kostenlos testen</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="#demo" className="gap-2">
                <Icon icon="ph:play-circle" className="size-5" />
                Demo ansehen
              </Link>
            </Button>
          </div>
        </div>

        {/* Produkt-Visual */}
        <div className="relative">
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
            <div className="flex items-center gap-1.5 border-b border-border bg-secondary/60 px-4 py-3">
              <span className="size-3 rounded-full bg-muted-foreground/30" />
              <span className="size-3 rounded-full bg-muted-foreground/30" />
              <span className="size-3 rounded-full bg-muted-foreground/30" />
            </div>
            <div className="aspect-[4/3] bg-gradient-to-br from-secondary to-background p-6">
              <div className="flex h-full flex-col gap-3">
                <div className="h-8 w-2/3 rounded-lg bg-muted" />
                <div className="grid flex-1 grid-cols-7 gap-1.5">
                  {Array.from({ length: 28 }).map((_, i) => (
                    <div
                      key={i}
                      className={
                        "rounded " +
                        (i % 5 === 0
                          ? "bg-accent/70"
                          : i % 3 === 0
                            ? "bg-primary/20"
                            : "bg-muted")
                      }
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
