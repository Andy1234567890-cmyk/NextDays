// Eine Funktions-Unterseite (/funktionen/<slug>) — neun Seiten aus EINER Vorlage.
//
// AUFBAU nach der Referenz (lodgify.com/de/ferienwohnung-channel-manager/ und
// die übrigen Funktionsseiten, abgelesen 18.08.2026). Dort folgt jede Seite
// demselben Ablauf, und genau das ist die Stärke: der Besucher erkennt die
// Machart wieder, egal über welche Suche er hereinkommt.
//   1. Hero: Chip mit dem Bereich, große Überschrift, Absatz, zwei CTAs —
//      rechts die Aufnahme aus der Software auf farbiger Fläche.
//   2. Drei Kurz-Nutzen nebeneinander.
//   3. Reiter über die Teilaspekte, je mit gebauter Grafik (Referenz:
//      hostaway.com/features/communication/ — Chip-Reihe, die den Block
//      darunter austauscht).
//   4. Beleg-Block (Text ↔ Aufnahme) mit Häkchen-Chips.
//   5. Weiterführung zu den anderen Funktionen (die Referenz endet dort mit
//      Testimonials; die haben wir vor dem Start bewusst nicht, siehe
//      `marketing-stimmen.tsx`).
//   6. Abschluss-CTA.
//
// Warum EINE Vorlage und keine neun Dateien: die Seiten unterscheiden sich in
// Text und Bild, nicht im Aufbau. Neun Kopien würden beim ersten Umbau
// auseinanderlaufen — und ein Besucher merkt sofort, wenn eine Funktionsseite
// „anders" aussieht als die anderen.
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { AppAufnahme } from "@/components/marketing/app-aufnahme";
import { MarketingCta } from "@/components/marketing/marketing-cta";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { SectionWave } from "@/components/marketing/section-kit";
import { FunktionsReiter } from "@/components/funktionen/funktions-reiter";
import { GRUPPEN_ILLUSTRATION } from "@/components/preise/preis-illustrationen";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { FUNKTIONEN, funktionNachSlug } from "@/content/funktionen";
import { DEMO_URL, SIGNUP_URL } from "@/lib/app-url";

import type { Metadata } from "next";

// Alle neun Seiten werden zur Bauzeit erzeugt — sie ändern sich nur mit dem
// Code, nicht mit Daten.
export function generateStaticParams() {
  return FUNKTIONEN.map((f) => ({ slug: f.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const funktion = funktionNachSlug(slug);
  if (!funktion) return {};
  const tg = await getTranslations("features.gruppen");
  const tf = await getTranslations(`funktionen.${funktion.key}`);
  return {
    title: `${tg(`${funktion.key}.title`)} | myNextDays`,
    description: tf("metaBeschreibung"),
    alternates: { canonical: `/funktionen/${funktion.slug}` },
  };
}

export default async function FunktionsSeite({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const funktion = funktionNachSlug(slug);
  // Unbekanntes Segment → 404. Keine Ersatzseite: eine erfundene Funktion
  // wäre ein Versprechen, das das Produkt nicht hält.
  if (!funktion) notFound();

  const t = await getTranslations(`funktionen.${funktion.key}`);
  const tr = await getTranslations("funktionen.rahmen");
  const tg = await getTranslations("features.gruppen");
  const Illustration = GRUPPEN_ILLUSTRATION[funktion.key];

  const nutzen = ["a", "b", "c"] as const;
  // EIN Zickzack-Block je Seite: die Referenz hat zwei bis drei, aber jeder
  // weitere Block ist ein weiterer Absatz in 24 Sprachen — und ein zweiter,
  // schwächerer Text schadet der Seite mehr, als er nützt.
  const bloecke = ["eins"] as const;
  const andere = FUNKTIONEN.filter((f) => f.key !== funktion.key);

  return (
    <div className="flex min-h-screen flex-col bg-background font-sans text-foreground">
      <MarketingNav />
      <main className="flex-1">
        {/* 1. Hero */}
        <section className="bg-gradient-to-b from-surface-warm to-background">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 pb-20 pt-14 lg:grid-cols-[1fr_1.05fr]">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium shadow-card">
                <span className="text-accent">
                  {Illustration ? <Illustration className="size-5" /> : null}
                </span>
                {tr(`bereich.${funktion.bereich}`)}
              </p>

              <h1 className="mt-6 font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
                {t("headline")}
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
                {t("sub")}
              </p>

              {/* Die Stichwortzeile aus `features.gruppen` — dieselbe, die im
                  Menü und auf der Preisseite steht. */}
              <p className="mt-5 text-sm font-medium text-muted-foreground">
                {tg(`${funktion.key}.items`)}
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild variant="accent" size="lg">
                  <Link href={SIGNUP_URL}>{tr("ctaTesten")}</Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href={DEMO_URL}>{tr("ctaDemo")}</Link>
                </Button>
              </div>
            </div>

            {/* Rechts die echte Aufnahme; fehlt das Motiv, trägt die
                Zeichnung die Fläche — statt eines fremden Screenshots. */}
            <div className="rounded-3xl bg-surface-accent p-6 shadow-float lg:p-8">
              {funktion.aufnahme ? (
                <AppAufnahme
                  name={funktion.aufnahme}
                  alt={t("bildAlt")}
                  priority
                  className="w-full"
                />
              ) : (
                <span className="flex aspect-[16/10] items-center justify-center text-accent">
                  {Illustration ? <Illustration className="size-40" /> : null}
                </span>
              )}
            </div>
          </div>
        </section>

        {/* 2. Drei Kurz-Nutzen */}
        <section className="bg-background">
          <div className="mx-auto max-w-7xl px-6 py-20">
            <div className="grid gap-10 md:grid-cols-3">
              {nutzen.map((n, i) => (
                <div key={n}>
                  {/* Nummer statt dreimal desselben Häkchens: drei gleiche
                      Symbole nebeneinander tragen keine Information. */}
                  <span className="flex size-12 items-center justify-center rounded-2xl bg-surface-accent font-display text-lg font-extrabold text-accent">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h2 className="mt-5 font-display text-xl font-semibold">
                    {t(`nutzen.${n}.titel`)}
                  </h2>
                  <p className="mt-2 leading-relaxed text-muted-foreground">
                    {t(`nutzen.${n}.text`)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 3. Reiter mit gebauten Grafiken — die Teilaspekte dieser Funktion. */}
        <FunktionsReiter gruppe={funktion.key} reiter={funktion.reiter} />

        {/* 4. Beleg-Block (Text ↔ Bild) */}
        {bloecke.map((b, i) => (
          <section
            key={b}
            className={i % 2 === 0 ? "bg-surface-warm" : "bg-background"}
          >
            <div
              className={`mx-auto grid max-w-7xl items-center gap-12 px-6 py-20 lg:grid-cols-2 ${
                i % 2 === 0 ? "" : "lg:[&>*:first-child]:order-2"
              }`}
            >
              <div>
                <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
                  {t(`block.${b}.titel`)}
                </h2>
                <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
                  {t(`block.${b}.text`)}
                </p>
                {/* Häkchen-Chips wie bei der Referenz: drei knappe Belege,
                    keine zweite Textwand. */}
                <ul className="mt-7 flex flex-wrap gap-2.5">
                  {(["a", "b", "c"] as const).map((p) => (
                    <li
                      key={p}
                      className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium shadow-card"
                    >
                      <Icon
                        icon="ph:check-circle-fill"
                        className="size-4 text-accent"
                      />
                      {t(`block.${b}.punkte.${p}`)}
                    </li>
                  ))}
                </ul>
              </div>

              <div
                className={`rounded-3xl p-6 lg:p-8 ${
                  i % 2 === 0 ? "bg-card shadow-float" : "bg-surface-accent"
                }`}
              >
                {funktion.aufnahmeBlock ? (
                  <AppAufnahme
                    name={funktion.aufnahmeBlock}
                    alt={t("bildAltBlock")}
                    className="w-full"
                  />
                ) : (
                  <span className="flex aspect-[16/10] items-center justify-center text-accent">
                    {Illustration ? <Illustration className="size-40" /> : null}
                  </span>
                )}
              </div>
            </div>
          </section>
        ))}

        {/* 5. Weiter zu den anderen Funktionen */}
        <section className="bg-background">
          <div className="mx-auto max-w-7xl px-6 py-20">
            <h2 className="font-display text-2xl font-extrabold tracking-tight">
              {tr("weiter")}
            </h2>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {andere.map((f) => {
                const Bild = GRUPPEN_ILLUSTRATION[f.key];
                return (
                  <li key={f.key}>
                    <Link
                      href={`/funktionen/${f.slug}`}
                      className="group flex h-full items-start gap-3 rounded-2xl border border-border bg-card p-5 shadow-card transition-shadow hover:shadow-float"
                    >
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-surface-accent text-accent transition-colors group-hover:bg-accent group-hover:text-accent-foreground">
                        {Bild ? <Bild className="size-7" /> : null}
                      </span>
                      <span>
                        <span className="block text-sm font-semibold transition-colors group-hover:text-accent">
                          {tg(`${f.key}.title`)}
                        </span>
                        <span className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                          {tg(`${f.key}.items`)}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        <SectionWave from="text-background" to="bg-surface-warm" />
        <MarketingCta />
      </main>
      <MarketingFooter />
    </div>
  );
}
