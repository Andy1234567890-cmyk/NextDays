// Marketing-Navbar — sticky Kopfzeile der öffentlichen Landingpage.
// Layout aus Figma (Logo links, Menü mittig, Sprache + Login + CTA rechts),
// im NextDays-Look (Schwarz/Rot, Pill-Buttons, Fraunces/Inter, rem).
"use client";

import { Icon } from "@iconify/react";
import Link from "next/link";

import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";

const NAV_LINKS = [
  { label: "Funktionen", href: "#funktionen" },
  { label: "Preise", href: "#preise" },
  { label: "Kanäle", href: "#kanaele" },
  { label: "Kunden", href: "#kunden" },
  { label: "Ressourcen", href: "#ressourcen" },
];

export function MarketingNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-6">
        <Link href="/" className="flex items-center">
          <Logo heightRem={2.25} />
        </Link>

        <ul className="hidden items-center gap-7 md:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="hidden items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:flex"
          >
            <Icon icon="ph:globe" className="size-4" />
            Deutsch
          </button>
          <Link
            href="/login"
            className="hidden text-sm font-medium text-foreground transition-colors hover:text-accent sm:block"
          >
            Anmelden
          </Link>
          <Button asChild variant="accent" size="sm">
            <Link href="/register">Kostenlos starten</Link>
          </Button>
        </div>
      </nav>
    </header>
  );
}
