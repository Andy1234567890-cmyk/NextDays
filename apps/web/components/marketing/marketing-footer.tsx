// Footer — dunkler Block mit Link-Spalten, App-Store-Badges, Sprache,
// Rechtshinweisen und Social-Links. Figma: schwarzer Footer am Seitenende.
import { Icon } from "@iconify/react";
import Image from "next/image";
import Link from "next/link";

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

export function MarketingFooter() {
  return (
    <footer id="ressourcen" className="bg-primary text-primary-foreground">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-10 lg:grid-cols-[1.5fr_repeat(4,1fr)]">
          <div>
            <Image
              src="/marketing/brand/mynextdays-logo-light.png"
              alt="myNextDays — powered by AirSmil"
              width={1470}
              height={399}
              className="h-9 w-auto"
            />
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
                {col.links.map((link) => (
                  <li key={link}>
                    <Link
                      href="#"
                      className="text-sm text-primary-foreground/70 transition-colors hover:text-primary-foreground"
                    >
                      {link}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-6 border-t border-primary-foreground/15 pt-8 sm:flex-row">
          <p className="text-sm text-primary-foreground/60">
            © 2026 myNextDays. Alle Rechte vorbehalten.
          </p>
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
