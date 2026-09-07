// Suchergebnisse. Ohne Treffer wird das ehrlich gesagt — keine „ähnlichen"
// Artikel erfinden, die die Frage nicht beantworten.
import type { Metadata } from "next";
import Link from "next/link";

import { HilfeSuchfeld } from "@/components/hilfe/suchfeld";
import { suche } from "@/content/hilfe";

export const metadata: Metadata = { title: "Suche · Hilfe · myBestDays" };

export default async function SucheSeite({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const treffer = suche(q);

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link
        href="/hilfe"
        className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
      >
        Hilfe
      </Link>
      <h1 className="mt-3 font-sans text-[2rem] font-bold tracking-tight">Suche</h1>

      <div className="mt-6">
        <HilfeSuchfeld start={q} />
      </div>

      <p className="mt-6 text-sm text-muted-foreground">
        {q
          ? `${treffer.length} ${treffer.length === 1 ? "Treffer" : "Treffer"} für „${q}“`
          : "Gib einen Suchbegriff ein."}
      </p>

      <div className="mt-4 space-y-3">
        {treffer.map(({ kategorie, artikel }) => (
          <Link
            key={`${kategorie.slug}/${artikel.slug}`}
            href={`/hilfe/${kategorie.slug}/${artikel.slug}`}
            className="block rounded-2xl border border-border p-5 transition-colors hover:border-foreground"
          >
            <p className="text-sm text-muted-foreground">{kategorie.titel}</p>
            <p className="mt-1 font-medium">{artikel.titel}</p>
            <p className="mt-1 text-sm text-muted-foreground">{artikel.auszug}</p>
          </Link>
        ))}
      </div>

      {q && treffer.length === 0 && (
        <div className="mt-6 rounded-2xl bg-muted/60 p-5">
          <p className="font-medium">Dazu haben wir noch nichts.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Frag uns direkt über{" "}
            <Link href="/support" className="font-medium underline underline-offset-2">
              Support
            </Link>
            .
          </p>
        </div>
      )}
    </div>
  );
}
