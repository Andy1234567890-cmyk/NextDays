// Metadaten für die Konto-Löschseite.
//
// Warum als Layout und nicht in der Seite selbst: `page.tsx` ist `"use client"`
// (Formular mit Zustand). Ein `metadata`-Export ist dort wirkungslos — Next
// wertet ihn nur in Server-Komponenten aus. Ohne diese Datei erbte die Seite
// still Titel UND Beschreibung der Startseite: ein Suchtreffer „myNextDays –
// Die Vermieter-Plattform …" ausgerechnet für „Konto löschen". Die Seite steht
// in der Sitemap und wird von Google verlangt (Play-Store-Pflicht, 0413), war
// aber die einzige darin ohne eigene Metadaten.
//
// Titel und Beschreibung kommen aus `kontoLoeschungTexte` — derselben Quelle,
// aus der die Seite ihre Überschrift nimmt. Eine zweite, hier getippte Fassung
// wäre in 24 Sprachen 24 Kopien (Wurzel 4).
import { getLocale } from "next-intl/server";

import { kontoLoeschungTexte } from "@/content/konto-loeschung";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = kontoLoeschungTexte(locale);

  return {
    title: `${t.titel} · myNextDays`,
    description: t.einleitung,
    alternates: { canonical: "/konto-loeschen" },
  };
}

export default function KontoLoeschenLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
