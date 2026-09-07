// Artikelseite.
import { Icon } from "@iconify/react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ArtikelText } from "@/components/hilfe/artikel-text";
import { alleKategorien, artikel } from "@/content/hilfe";

export function generateStaticParams() {
  return alleKategorien().flatMap((k) =>
    k.artikel.map((a) => ({ kategorie: k.slug, artikel: a.slug })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ kategorie: string; artikel: string }>;
}): Promise<Metadata> {
  const { kategorie, artikel: artikelSlug } = await params;
  const treffer = artikel(kategorie, artikelSlug);
  return {
    title: treffer ? `${treffer.artikel.titel} · Hilfe · myBestDays` : "Hilfe · myBestDays",
    description: treffer?.artikel.auszug,
  };
}

export default async function ArtikelSeite({
  params,
}: {
  params: Promise<{ kategorie: string; artikel: string }>;
}) {
  const { kategorie, artikel: artikelSlug } = await params;
  const treffer = artikel(kategorie, artikelSlug);
  if (!treffer) notFound();
  const { kategorie: k, artikel: a } = treffer;
  // „Verwandte Themen": die übrigen Artikel derselben Kategorie. Keine
  // erfundene Ähnlichkeit — wer mehr zum Thema sucht, findet es dort.
  const verwandte = k.artikel.filter((x) => x.slug !== a.slug).slice(0, 3);

  // Die Art des Artikels als Zeile über dem Titel — im Vorbild „So funktioniert
  // es • Gastgeber:in einer Unterkunft". Sie sagt, ob man eine Anleitung oder
  // eine Regel liest.
  const ART_TEXT = {
    anleitung: "So geht es",
    richtlinie: "Regeln und Bedingungen",
    grundlagen: "Grundlagen",
  } as const;

  return (
    // Inhaltsspalte 632 px wie im Vorbild (gemessen 06.09.2026) — schmaler als
    // eine übliche Textspalte, weil ein Hilfeartikel überflogen und nicht
    // gelesen wird.
    <div className="mx-auto max-w-[39.5rem] px-6 py-10">
      {/* Brotkrumen als KETTE, nicht als zwei Links: Hilfe › Kategorie ›
          Artikel. 14/20, grau — die Seite selbst steht am Ende ohne Link. */}
      <nav
        aria-label="Brotkrumen"
        className="flex flex-wrap items-center gap-2 text-sm leading-5 text-muted-foreground"
      >
        <Link href="/hilfe" className="underline underline-offset-2 hover:text-foreground">
          Hilfe
        </Link>
        <Icon icon="ph:caret-right" className="size-3" aria-hidden="true" />
        <Link
          href={`/hilfe/${k.slug}`}
          className="underline underline-offset-2 hover:text-foreground"
        >
          {k.titel}
        </Link>
        <Icon icon="ph:caret-right" className="size-3" aria-hidden="true" />
        <span aria-current="page">{a.titel}</span>
      </nav>

      <p className="mt-8 text-sm font-medium leading-5 text-muted-foreground">
        {ART_TEXT[a.art ?? "anleitung"]}
      </p>
      {/* Titel 32/36 Gewicht 500 — gemessen, nicht geschätzt. */}
      <h1 className="mt-2 text-[2rem] font-medium leading-9">{a.titel}</h1>
      <p className="mt-3 text-base leading-6 text-muted-foreground">{a.auszug}</p>

      <div className="mt-8">
        <ArtikelText bloecke={a.text} />
      </div>

      {/* Fuß wie im Vorbild: erst die Frage, ob es geholfen hat, dann die
          verwandten Artikel, dann der Weg zum Menschen. */}
      <div className="mt-12 border-t border-border pt-8">
        <p className="text-base font-medium">Hat dir dieser Artikel weitergeholfen?</p>
        <p className="mt-2 text-base leading-6 text-muted-foreground">
          Wenn nicht, schreib uns über{" "}
          <Link href="/support" className="font-medium underline underline-offset-2">
            Support
          </Link>
          .
        </p>
      </div>

      {verwandte.length > 0 && (
        <div className="mt-10">
          <h2 className="text-[1.375rem] font-medium leading-[1.625rem]">
            Verwandte Themen
          </h2>
          <ul className="mt-4 space-y-4">
            {verwandte.map((v) => (
              <li key={v.slug}>
                <Link href={`/hilfe/${k.slug}/${v.slug}`} className="group block">
                  <span className="block text-sm font-medium leading-5 text-muted-foreground">
                    {ART_TEXT[v.art ?? "anleitung"]}
                  </span>
                  <span className="mt-1 block text-base font-medium group-hover:underline">
                    {v.titel}
                  </span>
                  <span className="mt-1 block text-base leading-6 text-muted-foreground">
                    {v.auszug}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
