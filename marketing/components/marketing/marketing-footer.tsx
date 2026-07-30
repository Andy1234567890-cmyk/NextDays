// Footer — dunkler Block mit Link-Spalten, App-Store-Badges, Sprache,
// Rechtshinweisen und Social-Links. Figma: schwarzer Footer am Seitenende.
import { Icon } from "@iconify/react";
import Link from "next/link";

import { Logo } from "@/components/logo";
import { AGB_URL, HILFE_URL } from "@/lib/app-url";

const FOOTER_COLUMNS = [
  {
    title: "Produkt",
    links: [
      "Property-Management",
      "Channel-Manager",
      "Direktbuchung",
      "Zahlungen",
      "Mobile App",
    ],
  },
  {
    title: "Lösungen",
    links: ["Hotels", "B&B", "Gästehäuser", "Ferienwohnungen", "Campingplätze"],
  },
  {
    title: "Ressourcen",
    links: ["Blog", "Hilfe-Center", "Webinare", "Leitfäden", "API-Dokumentation"],
  },
  {
    title: "Unternehmen",
    links: ["Über uns", "Karriere", "Partner", "Kontakt", "Presse"],
  },
];

const SOCIALS = [
  { icon: "ph:facebook-logo", label: "Facebook" },
  { icon: "ph:instagram-logo", label: "Instagram" },
  { icon: "ph:youtube-logo", label: "YouTube" },
  { icon: "ph:linkedin-logo", label: "LinkedIn" },
];

// AGB/Hilfe liegen in der Haupt-App (web) → absolute Links (lib/app-url).
// Das Impressum liegt als eigene Route IN dieser App, weil es die
// Anbieterangaben der Marketing-Site selbst sind → relativer Link.
const RECHTLICH: { label: string; href?: string }[] = [
  { label: "AGB", href: AGB_URL },
  { label: "Datenschutz" },
  { label: "Impressum", href: "/impressum" },
  { label: "Cookie-Richtlinie" },
];

export function MarketingFooter() {
  return (
    <footer id="ressourcen" className="bg-primary text-primary-foreground">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-10 lg:grid-cols-[1.5fr_repeat(4,1fr)]">
          <div>
            <Logo heightRem={2.25} dark />
            <p className="mt-4 max-w-xs text-sm text-primary-foreground/70">
              Eine starke Plattform für kleine Unterkünfte – mehr Buchungen,
              weniger Arbeit.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <p className="text-sm font-medium">App herunterladen</p>
              <div className="flex flex-wrap gap-3">
                <span className="flex items-center gap-2 rounded-lg border border-primary-foreground/20 px-3 py-2 text-xs">
                  <Icon icon="ph:apple-logo-fill" className="size-5" />
                  App Store
                </span>
                <span className="flex items-center gap-2 rounded-lg border border-primary-foreground/20 px-3 py-2 text-xs">
                  <Icon icon="ph:google-play-logo-fill" className="size-5" />
                  Google Play
                </span>
              </div>
            </div>
          </div>

          {FOOTER_COLUMNS.map((col) => (
            <div key={col.title}>
              <p className="text-sm font-semibold">{col.title}</p>
              <ul className="mt-4 flex flex-col gap-3">
                {col.links.map((link) => {
                  // Nur echte Ziele verlinken; alles andere bleibt Platzhalter (#).
                  const href = link === "Hilfe-Center" ? HILFE_URL : "#";
                  return (
                    <li key={link}>
                      <Link
                        href={href}
                        className="text-sm text-primary-foreground/70 transition-colors hover:text-primary-foreground"
                      >
                        {link}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-6 border-t border-primary-foreground/15 pt-8 sm:flex-row">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-primary-foreground/60">
            <span>© 2026 myNextDays. Alle Rechte vorbehalten.</span>
            {RECHTLICH.map((r) => (
              <span key={r.label} className="flex items-center gap-2">
                <span aria-hidden>·</span>
                {r.href ? (
                  <Link
                    href={r.href}
                    className="transition-colors hover:text-primary-foreground hover:underline"
                  >
                    {r.label}
                  </Link>
                ) : (
                  <span>{r.label}</span>
                )}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-5">
            <button
              type="button"
              className="flex items-center gap-1.5 text-sm text-primary-foreground/70 transition-colors hover:text-primary-foreground"
            >
              <Icon icon="ph:globe" className="size-4" />
              Deutsch
            </button>
            <div className="flex items-center gap-3">
              {SOCIALS.map((s) => (
                <Link
                  key={s.label}
                  href="#"
                  aria-label={s.label}
                  className="text-primary-foreground/70 transition-colors hover:text-primary-foreground"
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
