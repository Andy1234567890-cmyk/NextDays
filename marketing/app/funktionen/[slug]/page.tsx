// Eine Funktions-Unterseite (/funktionen/<slug>) — zehn Seiten aus EINER Vorlage.
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
// Warum EINE Vorlage und keine zehn Dateien: die Seiten unterscheiden sich in
// Text und Bild, nicht im Aufbau. Neun Kopien würden beim ersten Umbau
// auseinanderlaufen — und ein Besucher merkt sofort, wenn eine Funktionsseite
// „anders" aussieht als die anderen.
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";

import { AppAufnahme } from "@/components/marketing/app-aufnahme";
import {
  AppAufnahmenMobilReihe,
  TelefonBuehne,
} from "@/components/marketing/app-aufnahme-mobil";
import { MarketingCta } from "@/components/marketing/marketing-cta";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { SectionWave } from "@/components/marketing/section-kit";
import { FunktionsReiter } from "@/components/funktionen/funktions-reiter";
import { GRUPPEN_ILLUSTRATION } from "@/components/preise/preis-illustrationen";
import { KiBuehneAntwort, KiBuehneRegeln } from "@/components/marketing/ki-buehnen";

/** Bewegte Bühnen je Funktionsschlüssel: [Hero, Beleg-Block].
 *
 *  Getrennt von `GRUPPEN_ILLUSTRATION`, weil jene Zeichnungen an fünf Stellen
 *  auch als 28-px-Icon laufen (Navigation, Preisrechner, Kachelgitter) —
 *  Bewegung gehört an die große Fläche, nicht in eine Menüzeile. */
const BUEHNEN: Record<
  string,
  readonly [(p: { className?: string }) => React.ReactElement,
            (p: { className?: string }) => React.ReactElement]
> = {
  ki: [KiBuehneAntwort, KiBuehneRegeln],
};
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { FUNKTIONEN, funktionNachSlug } from "@/content/funktionen";
import { DEMO_URL, SIGNUP_URL } from "@/lib/app-url";
import { gruppenStichworte } from "@/lib/gruppen-stichworte";
import { holeProvisionssaetze } from "@/lib/provisionstexte";

import type { Metadata } from "next";

// Alle zehn Seiten werden zur Bauzeit erzeugt — sie ändern sich nur mit dem
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
  // Label „App herunterladen" — dasselbe wie im Footer, statt eines zweiten
  // Satzes derselben Aussage in 24 Sprachen.
  const tFooter = await getTranslations("footer");
  // Zwei Textstellen dieser Seite nennen einen Provisionssatz: die
  // Stichwortzeile der Gruppe „direkt" (extern) und auf der Direktbuchungs-
  // Seite der dritte Häkchen-Chip (Marktplatz, 8 %). Beide kommen aus
  // /subscriptions/public/pricing, nicht aus den Sprachdateien.
  const locale = await getLocale();
  const saetze = await holeProvisionssaetze(locale);
  const Illustration = GRUPPEN_ILLUSTRATION[funktion.key];
  // Bewegte Bühnen statt eines 96er-Icons auf 40 Pixeln.
  //
  // Nur für Seiten OHNE Bildschirmaufnahme, und derzeit nur für die KI-Seite:
  // sie ist die einzige, deren Funktion man zeigen kann, ohne die Oberfläche
  // fotografiert zu haben (Frage → Antwort ist ein Ablauf, kein Screenshot).
  // Bekommt eine Seite später ihre echte Aufnahme, greift wieder der Zweig
  // darüber — die Bühne ist Ersatz, nicht Ziel.
  const buehnen = BUEHNEN[funktion.key];
  // Fällt auf `Illustration` zurück — dann verhält sich jede Seite ohne
  // `zweiteIllustration` exakt wie bisher.
  const IllustrationBlock = funktion.zweiteIllustration
    ? (GRUPPEN_ILLUSTRATION[funktion.zweiteIllustration] ?? Illustration)
    : Illustration;

  const nutzen = ["a", "b", "c"] as const;
  // EIN Zickzack-Block je Seite: die Referenz hat zwei bis drei, aber jeder
  // weitere Block ist ein weiterer Absatz in 24 Sprachen — und ein zweiter,
  // schwächerer Text schadet der Seite mehr, als er nützt.
  const bloecke = ["eins"] as const;
  const andere = FUNKTIONEN.filter((f) => f.key !== funktion.key);

  return (
    <div className="flex min-h-screen flex-col bg-background font-sans text-foreground">
      <MarketingNav satzExtern={saetze.extern} />
      <main className="flex-1">
        {/* 1. Hero */}
        <section className="bg-gradient-to-b from-surface-warm to-background">
          {/* `min-w-0` an jedem Raster dieser Vorlage: eine Grid-Spalte ist
              standardmaessig mindestens so breit wie ihr breitester unteilbarer
              Inhalt (`min-width: auto`). Bei 320 px hat das die Seite quer
              scrollen lassen — auf Deutsch wegen „Buchungsplattformen." in der
              Ueberschrift, auf Daenisch wegen „Onlinebetalinger" zwei Abschnitte
              weiter unten. Die Silbentrennung in globals.css loest den Text,
              `min-w-0` loest das Raster; es braucht beides. */}
            <div className="mx-auto grid min-w-0 max-w-7xl items-center gap-12 px-6 pb-16 pt-14 lg:grid-cols-[1fr_1.05fr]">
            <div>
              {/* Eyebrow statt Chip mit Icon: die Startseite und jede Sektion
                  darauf beginnen mit derselben kleinen Kategoriezeile
                  (`section-kit.tsx`). Ein umrandeter Chip war das einzige
                  Element dieser Art auf der ganzen Site. */}
              <p className="eyebrow">{tr(`bereich.${funktion.bereich}`)}</p>

              <h1 className="mt-4 font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
                {t("headline")}
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
                {t("sub")}
              </p>

              {/* Die Stichwortzeile aus `features.gruppen` — dieselbe, die im
                  Menü und auf der Preisseite steht. Bewusst EIN Absatz und
                  keine Chip-Reihe: die Zeile ist nur auf manchen Seiten eine
                  Komma-Aufzählung, auf anderen ein Satz („Native App mit
                  eigenen Logins für Eigentümer, Gäste und Reinigung, …").
                  Am Komma getrennt zerfällt der Satz in sinnlose Schnipsel. */}
              <p className="mt-5 max-w-xl text-sm font-medium text-muted-foreground">
                {gruppenStichworte(tg, funktion.key, saetze.extern)}
              </p>

              {/* Dieselben zwei Knöpfe wie im Hero der Startseite: Akzent für
                  den Test, dunkel mit Play-Symbol für die Demo. */}
              <div className="mt-7 flex flex-wrap items-center gap-4">
                <Button asChild variant="accent" size="lg" className="min-w-48 text-base">
                  <Link href={SIGNUP_URL} data-cta="signup">
                    {tr("ctaTesten")}
                  </Link>
                </Button>
                <Button asChild variant="default" size="lg" className="min-w-40 text-base">
                  <Link href={DEMO_URL} data-cta="demo" className="gap-2">
                    <Icon icon="ph:play-circle" className="size-5" />
                    {tr("ctaDemo")}
                  </Link>
                </Button>
              </div>

              {/* Nur auf App-Seiten: wer eine App sucht, will als erstes
                  wissen, ob sie sein Telefon trifft. Dieselbe Darstellung wie
                  im Footer — und wie dort OHNE Link, weil die Apps noch nicht
                  in den Stores stehen (ein toter Store-Link wäre ein
                  Versprechen, das die Seite nicht hält). */}
              {funktion.telefonHero ? (
                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <span className="text-sm font-medium text-muted-foreground">
                    {tFooter("appLaden")}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-sm font-medium shadow-card">
                    <Icon icon="ph:apple-logo-fill" className="size-4" />
                    App Store
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-sm font-medium shadow-card">
                    <Icon icon="ph:google-play-logo-fill" className="size-4" />
                    Google Play
                  </span>
                </div>
              ) : null}
            </div>

            {/* Rechts die echte Aufnahme: Telefone, wo die Funktion von der
                App handelt, sonst die Browser-Aufnahme. Fehlt beides, trägt
                die Zeichnung die Fläche — statt eines fremden Screenshots. */}
            {funktion.telefonHero ? (
              <TelefonBuehne>
                <AppAufnahmenMobilReihe
                  motive={funktion.telefonHero}
                  alt={t("bildAlt")}
                  priority
                />
              </TelefonBuehne>
            ) : (
              <div className="rounded-3xl bg-surface-accent p-6 shadow-float lg:p-8">
                {funktion.aufnahme ? (
                  <AppAufnahme
                    name={funktion.aufnahme}
                    alt={t("bildAlt")}
                    priority
                    className="w-full"
                  />
                ) : buehnen ? (
                  // Bewegte Bühne: trägt die Fläche wirklich (volle Breite,
                  // 16:10). Das 40er-Icon davor ließ die Kachel auf 64 px
                  // zusammenfallen und wirkte wie ein Ladefehler.
                  <span className="block w-full text-accent">
                    {(() => {
                      const Hero = buehnen[0];
                      return <Hero className="w-full" />;
                    })()}
                  </span>
                ) : (
                  <span className="flex aspect-[16/10] items-center justify-center text-accent">
                    {Illustration ? <Illustration className="size-40" /> : null}
                  </span>
                )}
              </div>
            )}
          </div>
        </section>

        {/* 2. Drei Kurz-Nutzen — Muster der Startseite (`marketing-benefits`):
            getönte Fläche, drei zentrierte Spalten mit Kreis, keine
            Karten-Rahmen. Die Ruhe kommt aus dem Weißraum, nicht aus Rahmen. */}
        <section className="bg-surface-warm">
          <div className="mx-auto max-w-7xl px-6 py-24">
            <div className="grid min-w-0 gap-12 md:grid-cols-3">
              {nutzen.map((n, i) => (
                <div key={n} className="flex flex-col items-center text-center">
                  {/* Nummer statt dreimal desselben Häkchens: drei gleiche
                      Symbole nebeneinander tragen keine Information. */}
                  <span className="flex size-20 items-center justify-center rounded-full bg-surface-accent font-display text-2xl font-extrabold text-accent">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h2 className="mt-6 font-display text-xl font-semibold">
                    {t(`nutzen.${n}.titel`)}
                  </h2>
                  <p className="mt-3 max-w-sm leading-relaxed text-muted-foreground">
                    {t(`nutzen.${n}.text`)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Wellenkante wie zwischen den Sektionen der Startseite — harte
            Farbkanten gibt es dort nirgends. */}
        <SectionWave from="text-surface-warm" to="bg-background" />

        {/* 3. Reiter mit gebauten Grafiken — die Teilaspekte dieser Funktion. */}
        <FunktionsReiter gruppe={funktion.key} reiter={funktion.reiter} />

        <SectionWave from="text-background" to="bg-surface-warm" />

        {/* 4. Beleg-Block (Text ↔ Bild) */}
        {bloecke.map((b, i) => (
          <section
            key={b}
            className={i % 2 === 0 ? "bg-surface-warm" : "bg-background"}
          >
            <div
              className={`mx-auto grid min-w-0 max-w-7xl items-center gap-12 px-6 py-24 lg:grid-cols-2 ${
                i % 2 === 0 ? "" : "lg:[&>*:first-child]:order-2"
              }`}
            >
              <div>
                <h2 className="font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
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
                      {/* Der Marktplatz-Satz steht in genau EINEM dieser
                          Chips (`funktionen.direkt.block.eins.punkte.c`); die
                          übrigen Texte tragen keinen `{satz}` und nehmen den
                          Parameter unbeschadet an. Fehlt die Preisliste, tritt
                          das übersetzte Ersatzwort ein statt einer Lücke im
                          Chip — ein Chip ohne Text wäre ein leeres Häkchen.
                          Begründung ausführlich in `marketing-faq.tsx`. */}
                      {t(`block.${b}.punkte.${p}`, {
                        satz:
                          saetze.marktplatz ??
                          tr("satzUnbekannt"),
                      })}
                    </li>
                  ))}
                </ul>
              </div>

              {funktion.telefonBlock ? (
                <TelefonBuehne>
                  <AppAufnahmenMobilReihe
                    motive={funktion.telefonBlock}
                    alt={t("bildAltBlock")}
                  />
                </TelefonBuehne>
              ) : (
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
                  ) : buehnen ? (
                    <span className="block w-full text-accent">
                      {(() => {
                        const Block = buehnen[1];
                        return <Block className="w-full" />;
                      })()}
                    </span>
                  ) : (
                    <span className="flex aspect-[16/10] items-center justify-center text-accent">
                      {IllustrationBlock ? (
                        <IllustrationBlock className="size-40" />
                      ) : null}
                    </span>
                  )}
                </div>
              )}
            </div>
          </section>
        ))}

        {/* 5. Weiter zu den anderen Funktionen */}
        <section className="bg-background">
          <div className="mx-auto max-w-7xl px-6 py-20">
            <h2 className="font-display text-2xl font-extrabold tracking-tight">
              {tr("weiter")}
            </h2>
            <ul className="mt-8 grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                          {gruppenStichworte(tg, f.key, saetze.extern)}
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
