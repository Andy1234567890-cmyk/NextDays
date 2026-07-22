// Intro — "Willkommen bei NextDays" (zweispaltig: Visual links, Text rechts)
// + globale Reichweite mit Property-Typ-Tabs und Kunden-Zitat.
import { Icon } from "@iconify/react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

const PROPERTY_TYPES = [
  "Hotel",
  "B&B",
  "Gästehaus",
  "Motel",
  "Lodge",
  "Ferienwohnung",
  "Resort",
  "Hütte",
  "Pension",
  "Campingplatz",
];

export function MarketingIntro() {
  return (
    <section className="bg-background">
      {/* Willkommens-Block */}
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 py-20 lg:grid-cols-2">
        <div className="order-2 overflow-hidden rounded-2xl border border-border bg-card shadow-lg lg:order-1">
          <div className="aspect-[4/3] bg-gradient-to-br from-secondary to-background p-6">
            <div className="flex h-full flex-col gap-3">
              <div className="h-6 w-1/2 rounded bg-muted" />
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-10 flex-1 rounded-lg bg-muted" />
                  <div className="h-10 w-16 rounded-lg bg-accent/40" />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="order-1 lg:order-2">
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Willkommen bei myNextDays.
          </h2>
          <p className="mt-5 text-muted-foreground">
            Leistungsstarke, globale Distributionstechnologie kombiniert mit
            einem perfekt zugeschnittenen Property-Management-System.
          </p>
          <p className="mt-4 text-muted-foreground">
            Erhöhe deine Auslastung, vereinfache den Alltag und biete großartige
            Gästeerlebnisse – ohne die Komplexität von Systemen, die für große
            Hotels gemacht sind.
          </p>
          <p className="mt-4 text-muted-foreground">
            Mit zentralen Tools, smarter Automatisierung und nahtloser Anbindung
            an die wichtigsten Buchungskanäle wächst dein Geschäft mit mehr
            Kontrolle und weniger Aufwand.
          </p>
          <Button asChild variant="default" className="mt-7">
            <Link href="#funktionen" className="gap-2">
              Funktionen entdecken
              <Icon icon="ph:arrow-right" className="size-4" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Globale Reichweite */}
      <div className="border-t border-border">
        <div className="mx-auto max-w-7xl px-6 py-16">
          <p className="text-center font-display text-2xl font-semibold tracking-tight">
            Wir betreuen über 53.000 Unterkünfte weltweit.
          </p>

          <ul className="mx-auto mt-8 flex max-w-4xl flex-wrap justify-center gap-2">
            {PROPERTY_TYPES.map((type, i) => (
              <li key={type}>
                <button
                  type="button"
                  className={
                    "rounded-full px-4 py-1.5 text-sm font-medium transition-colors " +
                    (i === 0
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-muted")
                  }
                >
                  {type}
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-12 grid items-center gap-10 lg:grid-cols-2">
            <div className="aspect-[16/10] overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-secondary to-muted" />
            <figure>
              <Icon icon="ph:quotes-fill" className="size-10 text-accent/30" />
              <blockquote className="mt-4 font-display text-2xl font-medium leading-snug">
                „Die Zusammenarbeit mit euch war die Lösung für unsere Probleme.
                Wir haben unsere Verwaltung und den Service für unsere Gäste
                modernisiert.“
              </blockquote>
              <figcaption className="mt-5 text-sm text-muted-foreground">
                Inhaber, Hotel Santa Maria, Mexiko
              </figcaption>
            </figure>
          </div>
        </div>
      </div>
    </section>
  );
}
