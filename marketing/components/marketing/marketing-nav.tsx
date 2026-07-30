// Marketing-Navbar — EINE Zeile: Logo links, Menü mittig, rechts Sprache,
// Anmelden und der CTA.
//
// Hostaway trennt Sprache/Login in eine eigene Utility-Zeile darüber; das war
// hier kurzzeitig übernommen und ist auf Wunsch zurückgebaut — alles gehört in
// den Header, keine zweite Leiste.
"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";

import { LanguageSwitcher } from "@/components/language-switcher";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
// Login und Registrierung der Gastgeber liegen in der web-App (Dashboard).
import { LOGIN_URL, SIGNUP_URL } from "@/lib/app-url";

// Anker mit führendem "/" — sonst zeigen sie auf Unterseiten (z. B. /impressum)
// ins Nichts, weil die Abschnitte nur auf der Startseite existieren.
const NAV_LINKS = [
  { key: "funktionen", href: "/#funktionen" },
  { key: "preise", href: "/#preise" },
  { key: "kanaele", href: "/#kanaele" },
  { key: "kunden", href: "/#kunden" },
  { key: "ressourcen", href: "/#ressourcen" },
] as const;

export function MarketingNav() {
  const t = useTranslations("nav");

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur">
      <nav className="mx-auto flex h-18 max-w-7xl items-center justify-between gap-6 px-6">
        <Link href="/" className="flex items-center">
          <Logo heightRem={2.25} />
        </Link>

        <ul className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="text-sm font-medium transition-colors hover:text-accent"
              >
                {t(link.key)}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-4">
          <div className="hidden sm:block">
            <LanguageSwitcher />
          </div>
          <Link
            href={LOGIN_URL}
            className="hidden text-sm font-medium transition-colors hover:text-accent sm:block"
          >
            {t("anmelden")}
          </Link>
          <Button asChild variant="accent">
            <Link href={SIGNUP_URL}>{t("kostenlosStarten")}</Link>
          </Button>
        </div>
      </nav>
    </header>
  );
}
