// Funktions-Übersicht (/funktionen) — der Einstieg zu den neun Unterseiten.
//
// Referenz: hostaway.com/features und lodgify.com/de/funktionen/ (beide am
// 18.08.2026 angesehen). Beide führen eine eigene Hub-Seite, die nach
// Bereichen gruppiert und von dort in die Einzelseiten verzweigt — nicht eine
// lange Aufzählung. Übernommen ist genau das: drei Bereiche, je Bereich die
// zugehörigen Funktionen als Karten mit Zeichnung, Titel und Stichwortzeile.
//
// Die Texte kommen aus `features.gruppen` — dieselben wie im Megamenü, auf der
// Startseite und der Preisseite (eine Quelle, 24 Sprachen).
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";

import { MarketingCta } from "@/components/marketing/marketing-cta";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { SectionWave } from "@/components/marketing/section-kit";
import { GRUPPEN_ILLUSTRATION } from "@/components/preise/preis-illustrationen";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { FUNKTIONEN } from "@/content/funktionen";
import { DEMO_URL, SIGNUP_URL } from "@/lib/app-url";
import { gruppenStichworte } from "@/lib/gruppen-stichworte";
import { holeProvisionssaetze } from "@/lib/provisionstexte";

import type { Metadata } from "next";

const BEREICHE = ["verkauf", "gast", "betrieb"] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("funktionen.uebersicht");
  return {
    title: t("metaTitel"),
    description: t("metaBeschreibung"),
    alternates: { canonical: "/funktionen" },
  };
}

export default async function FunktionenSeite() {
  const t = await getTranslations("funktionen.uebersicht");
  const tr = await getTranslations("funktionen.rahmen");
  const tg = await getTranslations("features.gruppen");
  // Die Stichwortzeile der Gruppe „direkt" nennt unseren Provisionssatz — er
  // kommt aus /subscriptions/public/pricing, nicht aus den Sprachdateien.
  const locale = await getLocale();
  const saetze = await holeProvisionssaetze(locale);

  return (
    <div className="flex min-h-screen flex-col bg-background font-sans text-foreground">
      <MarketingNav satzExtern={saetze.extern} />
      <main className="flex-1">
        <section className="bg-primary pb-24 pt-16 text-primary-foreground">
          <div className="mx-auto max-w-3xl px-6 text-center">
            <p className="eyebrow">{t("eyebrow")}</p>
            <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              {t("headline")}
            </h1>
            <p className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-primary-foreground/70">
              {t("sub")}
            </p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild variant="accent" size="lg">
                <Link href={SIGNUP_URL}>{tr("ctaTesten")}</Link>
              </Button>
              {/* Auf dunklem Grund braucht der zweite Knopf eine eigene
                  Fassung: `variant="outline"` bringt `bg-background` mit und
                  erbt die weiße Hero-Schrift — weiß auf weiß, unlesbar. */}
              <Button
                asChild
                size="lg"
                className="border border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10"
              >
                <Link href={DEMO_URL}>{tr("ctaDemo")}</Link>
              </Button>
            </div>
          </div>
        </section>

        {BEREICHE.map((bereich, i) => (
          <section
            key={bereich}
            className={i % 2 === 0 ? "bg-background" : "bg-surface-warm"}
          >
            <div className="mx-auto max-w-7xl px-6 py-20">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="font-display text-3xl font-extrabold tracking-tight">
                  {tr(`bereich.${bereich}`)}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {t(`bereichSub.${bereich}`)}
                </p>
              </div>

              <ul className="mt-10 grid gap-6 md:grid-cols-3">
                {FUNKTIONEN.filter((f) => f.bereich === bereich).map((f) => {
                  const Illustration = GRUPPEN_ILLUSTRATION[f.key];
                  return (
                    <li key={f.key}>
                      <Link
                        href={`/funktionen/${f.slug}`}
                        className="group flex h-full flex-col rounded-3xl border border-border bg-card p-7 shadow-card transition-shadow hover:shadow-float"
                      >
                        <span className="flex size-20 items-center justify-center rounded-2xl bg-surface-accent text-accent transition-colors group-hover:bg-accent group-hover:text-accent-foreground">
                          {Illustration ? (
                            <Illustration className="size-14" />
                          ) : null}
                        </span>
                        <h3 className="mt-6 font-display text-lg font-semibold transition-colors group-hover:text-accent">
                          {tg(`${f.key}.title`)}
                        </h3>
                        <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                          {gruppenStichworte(tg, f.key, saetze.extern)}
                        </p>
                        <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-accent">
                          {tr("mehr")}
                          <Icon
                            icon="ph:arrow-right"
                            className="size-4 transition-transform group-hover:translate-x-1"
                          />
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        ))}

        <SectionWave from="text-background" to="bg-surface-warm" />
        <MarketingCta />
      </main>
      <MarketingFooter />
    </div>
  );
}
