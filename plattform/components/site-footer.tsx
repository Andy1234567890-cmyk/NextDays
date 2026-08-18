// Plattform-Fußzeile — mehrspaltiger Footer (Aufbau angelehnt an gängige
// Buchungsplattform-Footer: Reise-Inspirationen oben, dann Link-Spalten,
// unten Rechts-/Sprachleiste), umgesetzt im myBestDays-Design.
import { Icon } from "@iconify/react";
import Link from "next/link";

import { gastgeberRegistrierungUrl } from "@/lib/gastgeber-link";

import { ReiseInspirationen } from "./reise-inspirationen";
import { SprachWaehrungModal } from "./sprach-waehrung-modal";

// Link-Spalten. `href` NUR dort, wo das Ziel wirklich existiert — der Rest ist
// bewusst Text ohne Link. Vorher hing an JEDEM Eintrag ein `href="#"`, also 15
// Links, die aussahen wie Navigation und nichts taten (genau das, was der
// Kommentar bei den Rechtslinks unten schon verbot).
const SPALTEN: { titel: string; links: { label: string; href?: string }[] }[] = [
  {
    titel: "Unterstützung",
    links: [
      { label: "Hilfe-Center", href: "/hilfe" },
      { label: "Sicherheitsinformationen" },
      { label: "Stornierungsoptionen", href: "/rechtliches/stornierungsbedingungen" },
      { label: "Barrierefreiheit", href: "/rechtliches/barrierefreiheit" },
      { label: "Problem melden" },
    ],
  },
  {
    titel: "Gastgeben",
    links: [
      // Beide führen zur myBestDays-Gastgeber-Registrierung (gastgeber/,
      // ADR-0015) — nicht auf die myNextDays-Seite (andere Marke, das PMS).
      { label: "Unterkunft inserieren", href: gastgeberRegistrierungUrl() },
      { label: "Erlebnis anbieten" },
      { label: "Bedingungen für Gastgeber", href: "/rechtliches/gastgeber-bedingungen" },
      { label: "Infos für Gastgeber:innen", href: gastgeberRegistrierungUrl() },
      { label: "Community-Forum" },
    ],
  },
  {
    titel: "myBestDays",
    links: [
      { label: "Neuigkeiten" },
      { label: "Pressebereich" },
      { label: "Karriere" },
      { label: "Über uns" },
    ],
  },
  {
    // Die wichtigsten Rechtstexte direkt, der Rest über das Verzeichnis.
    // Alle Ziele existieren 24-sprachig unter /rechtliches/<slug>.
    titel: "Rechtliches",
    links: [
      { label: "Nutzungsbedingungen", href: "/rechtliches/nutzungsbedingungen" },
      { label: "Datenschutzerklärung", href: "/rechtliches/datenschutz" },
      { label: "Gesetz über digitale Dienste", href: "/rechtliches/dsa" },
      { label: "Beschwerden und Streitbeilegung", href: "/rechtliches/beschwerden" },
      { label: "Alle rechtlichen Bestimmungen", href: "/rechtliches" },
    ],
  },
];

// Rechtsleiste unten: alle Ziele existieren (content/legal/<slug>, 24-sprachig).
const RECHTLICH: { label: string; href: string }[] = [
  { label: "Datenschutz", href: "/rechtliches/datenschutz" },
  { label: "Nutzungsbedingungen", href: "/rechtliches/nutzungsbedingungen" },
  { label: "Impressum", href: "/rechtliches/impressum" },
  { label: "Cookie-Richtlinie", href: "/rechtliches/cookies" },
  { label: "Barrierefreiheit", href: "/rechtliches/barrierefreiheit" },
];

const SOCIAL = [
  { icon: "ph:facebook-logo", label: "Facebook" },
  { icon: "ph:x-logo", label: "X" },
  { icon: "ph:instagram-logo", label: "Instagram" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-secondary/40">
      {/* Reise-Inspirationen (Teil des Footers) */}
      <ReiseInspirationen />

      <div className="w-full border-t border-border px-4 py-8 sm:px-6 sm:py-10 md:px-10 2xl:px-20">
        {/* Link-Spalten. Mobil vier zugeklappte Abschnitte statt 19 offener
            Links: einspaltig war die Fußzeile zusammen mit den Reise-
            Inspirationen fast drei Bildschirme lang. */}
        <div className="grid grid-cols-1 gap-2 pb-2 sm:grid-cols-2 sm:gap-8 sm:border-b sm:border-border sm:pb-8 lg:grid-cols-4">
          {SPALTEN.map((spalte) => (
            <FooterSpalte key={spalte.titel} spalte={spalte} />
          ))}
        </div>

        {/* Rechts-/Sprachleiste */}
        <div className="flex flex-col gap-4 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between sm:border-t-0 sm:pt-6">
          <div className="flex flex-col gap-1 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-1 sm:gap-y-2">
            <span>© 2026 myBestDays</span>
            {RECHTLICH.map((link) => (
              <span key={link.label} className="flex items-center gap-1">
                {/* Der Trenner gehört zur Kette — mobil stehen die Links
                    untereinander, dort wäre ein führender Punkt Zierrat. */}
                <span aria-hidden className="hidden sm:inline">
                  ·
                </span>
                <Link
                  href={link.href}
                  className="flex min-h-11 items-center hover:text-foreground hover:underline sm:min-h-0"
                >
                  {link.label}
                </Link>
              </span>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-4 sm:gap-5">
            {/* Sprachwahl: dasselbe Modal wie in der Kopfzeile, nur als
                Textknopf. Vorher standen hier ZWEI `<button>` ohne onClick.
                Der zweite trug „€ EUR" fest im Code — falsch in zwei Richtungen:
                er versprach eine Währungsumschaltung, die es nicht gibt (Preise
                stehen immer in der Währung der Unterkunft, Wurzel 4), und er
                behauptete Euro, während die Startseite DKK zeigt. Ersatzlos weg
                statt durch einen anderen festen Wert ersetzt. */}
            <SprachWaehrungModal variante="text" />
            <div className="flex items-center gap-1 sm:gap-3">
              {SOCIAL.map((s) => (
                <Link
                  key={s.label}
                  href="#"
                  aria-label={s.label}
                  className="flex size-11 items-center justify-center rounded-full text-foreground hover:text-accent sm:size-auto"
                >
                  <Icon icon={s.icon} className="size-5" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

/** Eine Fußzeilen-Spalte. Mobil ein aufklappbarer Abschnitt, ab sm die offene
 *  Liste wie bisher. Zwei Hüllen um EINE Liste — `open` ist ein Attribut, keine
 *  Klasse, es gibt also kein `sm:open`. */
function FooterSpalte({
  spalte,
}: {
  spalte: { titel: string; links: { label: string; href?: string }[] };
}) {
  const liste = (
    <ul className="flex flex-col gap-3">
      {spalte.links.map((link) => (
        <li key={link.label}>
          {link.href ? (
            <Link
              href={link.href}
              className="flex min-h-11 items-center text-sm text-muted-foreground hover:text-foreground hover:underline sm:min-h-0"
            >
              {link.label}
            </Link>
          ) : (
            <span className="flex min-h-11 items-center text-sm text-muted-foreground sm:min-h-0">
              {link.label}
            </span>
          )}
        </li>
      ))}
    </ul>
  );

  return (
    <div>
      <details className="group border-b border-border sm:hidden">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold">
          {spalte.titel}
          <Icon
            icon="ph:caret-down"
            aria-hidden
            className="size-4 text-muted-foreground transition-transform group-open:rotate-180"
          />
        </summary>
        <div className="pb-3">{liste}</div>
      </details>
      <div className="hidden sm:block">
        <p className="text-sm font-semibold">{spalte.titel}</p>
        <div className="mt-4">{liste}</div>
      </div>
    </div>
  );
}
