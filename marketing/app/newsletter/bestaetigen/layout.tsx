// Metadaten für die Newsletter-Bestätigung.
//
// Warum als Layout: `page.tsx` ist `"use client"` — ein `metadata`-Export wäre
// dort wirkungslos, Next wertet ihn nur in Server-Komponenten aus.
//
// Zweck ist `noindex` UND ein geleertes `alternates`. Das Ziel eines
// Einmal-Links aus einer E-Mail gehört nicht in den Index: ohne gültiges Token
// zeigt es nur eine Fehlermeldung, als Suchtreffer wäre es ein Ergebnis, das
// nichts kann. Deshalb steht es auch in der robots.txt unter `Disallow` und
// nicht in der Sitemap.
//
// Das leere `alternates` ist der eigentlich wichtige Teil: Seit das
// Root-Layout `alternates: { canonical: "/" }` setzt, vererbt Next diesen Wert
// an jedes Segment, das ihn nicht selbst überschreibt. Ohne diese Datei trüge
// die Seite ein `rel=canonical` auf die STARTSEITE — die Behauptung, sie sei
// die Startseite. Das ist eine stärkere und falsche Aussage; `noindex` allein
// würde sie nicht aufheben.
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Newsletter bestätigen · myNextDays",
  alternates: {},
  robots: { index: false, follow: false },
};

export default function NewsletterBestaetigenLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
