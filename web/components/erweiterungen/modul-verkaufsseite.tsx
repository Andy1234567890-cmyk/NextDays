"use client";

// Verkaufsseite einer NICHT gebuchten Erweiterung — steht anstelle der
// gesperrten Fläche (bei Lodgify zeigt „Einstellungen → Dynamic Pricing"
// genau das, solange das Modul nicht aktiviert ist).
//
// Aufbau übernommen von dort, weil die Reihenfolge trägt: Hero (Marke,
// Überschrift, Absatz, Pill-CTA) über einem großen gerundeten Bild → farbig
// abgesetztes Vorteils-Band mit runden Icon-Badges → drei Schritte mit
// gezeichneten Illustrationen, Ziffer und Trennlinien → erklärender Abschnitt
// mit Icon-Badge → Abschluss-CTA.
//
// Die Illustrationen sind EIGENE Inline-SVGs (`illustrationen.tsx`), nicht
// Lodgifys Bilddateien: fremdes Material wird nicht kopiert, und Inline-SVG
// funktioniert in hell wie dunkel ohne zweites Asset.
//
// Reine Anzeige ohne eigenen Zustand. Preise stehen hier bewusst NICHT: die
// nennt die Detailseite aus Stripe (Wurzel 4).
import { Icon } from "@iconify/react";
import Link from "next/link";

import { Button } from "@nextdays/ui/button";
import type { Erweiterung } from "@/lib/erweiterungen";

import {
  PreisverlaufIllustration,
  SCHRITT_ILLUSTRATIONEN,
} from "./illustrationen";

export function ModulVerkaufsseite({ eintrag }: { eintrag: Erweiterung }) {
  const detail = `/erweiterungen/${eintrag.slug}`;
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-16 py-6">
      {/* Hero */}
      <header className="flex flex-col items-center gap-4 text-center">
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
          Erweiterung
        </span>
        <h1 className="font-display text-3xl font-extrabold leading-tight sm:text-4xl">
          {eintrag.name} — {eintrag.untertitel}
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
          {eintrag.ueber[0]}
        </p>
        <Button asChild size="lg" className="mt-1">
          <Link href={detail}>Modul ansehen und aktivieren</Link>
        </Button>

        {/* Großes Motiv unter dem Hero (bei Lodgify der Produkt-Screenshot) */}
        <div className="mt-4 w-full max-w-3xl overflow-hidden rounded-3xl border border-border bg-card p-5 sm:p-8">
          <PreisverlaufIllustration className="h-auto w-full" />
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Der berechnete Preis folgt der Nachfrage — begrenzt durch Ihren
            Mindest- und Höchstpreis.
          </p>
        </div>
      </header>

      {/* Vorteile — abgesetztes Band in der Markenfarbe (Lodgify nutzt hier ein
          farbiges Feld; unsere Tokens statt eines festen Farbwerts). */}
      <section className="rounded-3xl bg-primary/5 px-6 py-10 sm:px-10">
        <h2 className="text-center font-display text-2xl font-extrabold">
          Ihre Vorteile
        </h2>
        <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-3">
          {eintrag.vorteile.map((v) => (
            <div key={v.titel} className="flex flex-col items-center gap-3 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-primary/10">
                <Icon icon={v.icon} className="size-5 text-primary" />
              </span>
              <div className="font-display text-base font-extrabold">{v.titel}</div>
              <p className="text-sm leading-relaxed text-muted-foreground">{v.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Einrichtung in drei Schritten, mit Illustrationen */}
      <section className="flex flex-col gap-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <h2 className="font-display text-2xl font-extrabold">
            So verwenden Sie {eintrag.name}
          </h2>
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {eintrag.ueber[1]}
          </p>
        </div>
        <ol className="grid grid-cols-1 gap-10 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-border">
          {eintrag.einrichtung.map((z, i) => {
            const Illu = SCHRITT_ILLUSTRATIONEN[i];
            return (
              <li
                key={z.slice(0, 40)}
                className="flex flex-col items-center gap-3 px-2 text-center sm:px-6"
              >
                {Illu && <Illu className="size-32 text-foreground" />}
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-2xl font-extrabold text-primary">
                    {i + 1}
                  </span>
                  <span className="font-display text-lg font-extrabold">
                    {SCHRITT_TITEL[i] ?? `Schritt ${i + 1}`}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">{z}</p>
              </li>
            );
          })}
        </ol>
      </section>

      {/* Wie es rechnet — der Teil, den Lodgify „Wie unser Preisalgorithmus
          funktioniert" nennt. Bei uns: die tatsächlichen Faktoren, keine
          Marktforschungs-Versprechen. */}
      <section className="flex flex-col items-center gap-4 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-primary/10">
          <Icon icon="lucide:calculator" className="size-5 text-primary" />
        </span>
        <h2 className="font-display text-2xl font-extrabold">
          Was in den Preis einfließt
        </h2>
        <ul className="mx-auto flex max-w-3xl flex-col gap-2 text-left">
          {eintrag.soFunktioniert.map((z) => (
            <li key={z.slice(0, 40)} className="flex gap-2 text-sm text-muted-foreground">
              <Icon
                icon="lucide:check"
                className="mt-0.5 size-4 shrink-0 text-emerald-600"
              />
              <span>{z}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Abschluss */}
      <div className="flex flex-col items-center gap-3 border-t border-border pt-10">
        <Button asChild size="lg">
          <Link href={detail}>Modul ansehen und aktivieren</Link>
        </Button>
        <a
          href={eintrag.links[0]?.href ?? "/hilfe"}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-muted-foreground underline"
        >
          Mehr Infos im Hilfe-Center
        </a>
      </div>
    </div>
  );
}

// Kurztitel über den Schritt-Texten (Lodgify: „1 Aktivieren · 2 Bewertung ·
// 3 Anpassen"). Bei uns die Reihenfolge, die unsere Fläche wirklich hat.
const SCHRITT_TITEL: readonly string[] = ["Aktivieren", "Einstellen", "Prüfen"];
