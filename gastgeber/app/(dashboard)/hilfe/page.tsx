// Hilfe-Center des myBestDays-Gastgebers: Suche + Kategorie-Karten.
// Eigene Inhalte, NICHT das Marketing-Hilfe-Center (das ist myNextDays: PMS,
// Kanalmanager, Eigentuemer — fuer einen Marktplatz-Gastgeber die falsche Marke
// und der falsche Stoff).
import type { Metadata } from "next";
import Link from "next/link";

import { alleKategorien } from "@/content/hilfe";

import { KategorieKarte } from "@/components/hilfe/kategorie-karte";
import { HilfeSuchfeld } from "@/components/hilfe/suchfeld";

export const metadata: Metadata = {
  title: "Hilfe · myBestDays",
  description: "Antworten für Gastgeber auf myBestDays.",
};

export default function HilfeSeite() {
  const kategorien = alleKategorien();
  const artikelGesamt = kategorien.reduce((n, k) => n + k.artikel.length, 0);

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="font-sans text-[2rem] font-bold tracking-tight">Hilfe</h1>
      <p className="mt-2 text-muted-foreground">
        {artikelGesamt} Antworten rund ums Vermieten auf myBestDays.
      </p>

      <div className="mt-6">
        <HilfeSuchfeld />
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {kategorien.map((k) => (
          <KategorieKarte
            key={k.slug}
            slug={k.slug}
            titel={k.titel}
            beschreibung={k.beschreibung}
            icon={k.icon}
            anzahl={k.artikel.length}
          />
        ))}
      </div>

      <div className="mt-10 rounded-2xl bg-muted/60 p-5">
        <p className="font-medium">Nichts gefunden?</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Schreib uns über{" "}
          <Link href="/support" className="font-medium underline underline-offset-2">
            Support
          </Link>{" "}
          — wir antworten dir persönlich.
        </p>
      </div>
    </div>
  );
}
