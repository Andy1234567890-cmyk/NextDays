// Plattform-Fußzeile — mehrspaltiger Footer (Aufbau angelehnt an gängige
// Buchungsplattform-Footer: Reise-Inspirationen oben, dann Link-Spalten,
// unten Rechts-/Sprachleiste), umgesetzt im myNextDays-Design.
import { Icon } from "@iconify/react";
import Link from "next/link";

import { ReiseInspirationen } from "./reise-inspirationen";

const SPALTEN = [
  {
    titel: "Unterstützung",
    links: [
      "Hilfe-Center",
      "Sicherheitsinformationen",
      "Stornierungsoptionen",
      "Barrierefreiheit",
      "Problem melden",
    ],
  },
  {
    titel: "Gastgeben",
    links: [
      "Unterkunft inserieren",
      "Erlebnis anbieten",
      "Schutz für Gastgeber:innen",
      "Infos für Gastgeber:innen",
      "Community-Forum",
    ],
  },
  {
    titel: "myNextDays",
    links: [
      "Neuigkeiten",
      "Pressebereich",
      "Karriere",
      "Geschenkkarten",
      "Über uns",
    ],
  },
];

// Rechtslinks: nur Ziele verlinken, die es wirklich gibt — Platzhalter ohne
// Seite bleiben bewusst ohne href (keine toten "#"-Links vortäuschen).
const RECHTLICH: { label: string; href?: string }[] = [
  { label: "Datenschutz" },
  { label: "Nutzungsbedingungen", href: "/agb" },
  { label: "Impressum" },
  { label: "Cookie-Richtlinie" },
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

      <div className="mx-auto max-w-7xl border-t border-border px-6 py-10">
        {/* Link-Spalten */}
        <div className="grid grid-cols-1 gap-8 border-b border-border pb-8 sm:grid-cols-3">
          {SPALTEN.map((spalte) => (
            <div key={spalte.titel}>
              <p className="text-sm font-semibold">{spalte.titel}</p>
              <ul className="mt-4 flex flex-col gap-3">
                {spalte.links.map((link) => (
                  <li key={link}>
                    <Link
                      href="#"
                      className="text-sm text-muted-foreground hover:text-foreground hover:underline"
                    >
                      {link}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Rechts-/Sprachleiste */}
        <div className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-1 gap-y-2 text-sm text-muted-foreground">
            <span>© 2026 myNextDays</span>
            {RECHTLICH.map((link) => (
              <span key={link.label} className="flex items-center gap-1">
                <span aria-hidden>·</span>
                {link.href ? (
                  <Link
                    href={link.href}
                    className="hover:text-foreground hover:underline"
                  >
                    {link.label}
                  </Link>
                ) : (
                  <span>{link.label}</span>
                )}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-5">
            <button
              type="button"
              className="flex items-center gap-1.5 text-sm font-medium hover:underline"
            >
              <Icon icon="ph:globe" className="size-4" />
              Deutsch (DE)
            </button>
            <button type="button" className="text-sm font-medium hover:underline">
              € EUR
            </button>
            <div className="flex items-center gap-3">
              {SOCIAL.map((s) => (
                <Link
                  key={s.label}
                  href="#"
                  aria-label={s.label}
                  className="text-foreground hover:text-accent"
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
