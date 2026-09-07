// Kategorieseite: alle Artikel einer Kategorie.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { alleKategorien, kategorie } from "@/content/hilfe";

export function generateStaticParams() {
  return alleKategorien().map((k) => ({ kategorie: k.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ kategorie: string }>;
}): Promise<Metadata> {
  const { kategorie: slug } = await params;
  const k = kategorie(slug);
  return { title: k ? `${k.titel} · Hilfe · myBestDays` : "Hilfe · myBestDays" };
}

export default async function KategorieSeite({
  params,
}: {
  params: Promise<{ kategorie: string }>;
}) {
  const { kategorie: slug } = await params;
  const k = kategorie(slug);
  if (!k) notFound();

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link
        href="/hilfe"
        className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
      >
        Hilfe
      </Link>
      <h1 className="mt-3 font-sans text-[2rem] font-bold tracking-tight">{k.titel}</h1>
      <p className="mt-2 text-muted-foreground">{k.beschreibung}</p>

      <div className="mt-8 space-y-3">
        {k.artikel.map((a) => (
          <Link
            key={a.slug}
            href={`/hilfe/${k.slug}/${a.slug}`}
            className="block rounded-2xl border border-border p-5 transition-colors hover:border-foreground"
          >
            <p className="font-medium">{a.titel}</p>
            <p className="mt-1 text-sm text-muted-foreground">{a.auszug}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
