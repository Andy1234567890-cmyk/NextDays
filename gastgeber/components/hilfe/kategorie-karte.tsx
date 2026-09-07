"use client";

// Kategorie-Karte des Hilfe-Centers. Eigene Client-Insel, weil @iconify/react
// im Browser laeuft — die Seite selbst bleibt eine Server Component.
import { Icon } from "@iconify/react";
import Link from "next/link";

export function KategorieKarte({
  slug,
  titel,
  beschreibung,
  icon,
  anzahl,
}: {
  slug: string;
  titel: string;
  beschreibung: string;
  icon: string;
  anzahl: number;
}) {
  return (
    <Link
      href={`/hilfe/${slug}`}
      className="rounded-2xl border border-border p-5 transition-colors hover:border-foreground"
    >
      <Icon icon={icon} className="mb-3 size-7" />
      <p className="font-medium">{titel}</p>
      <p className="mt-1 text-sm text-muted-foreground">{beschreibung}</p>
      <p className="mt-3 text-sm text-muted-foreground">
        {anzahl} {anzahl === 1 ? "Artikel" : "Artikel"}
      </p>
    </Link>
  );
}
