// Rahmen der öffentlichen AGB-Seite dieser App.
//
// ANLASS (29.08.2026): Auf `app.mynextdays.com/agb` standen Logo und
// Sprachumschalter — sonst nichts. Kein Weg zurück, kein Impressum, kein
// Datenschutz. Wer den Link aus dem Registrierungsformular oder aus der
// Zahlungs-Freischaltung öffnete, landete in einer Sackgasse und musste den
// Zurück-Knopf des Browsers suchen. Dieselbe Ursache wie beim Onboarding: die
// Route hatte kein eigenes Layout, erbte also nur das Wurzel-Layout.
//
// WARUM AN DER ROUTE UND NICHT AN DER (public)-GRUPPE: Die Gruppe enthält
// zusätzlich `/marketing`, eine ältere Kopie der Marketing-Startseite, die
// Nav und Footer bereits selbst mitbringt — dort stünde beides doppelt.
//
// WARUM NICHT `components/marketing/marketing-nav`: Die liegt zwar in dieser
// App, taugt hier aber nicht. Ihre Punkte sind Sprungmarken (`#funktionen`,
// `#preise`) auf eine Seite, die unter `/agb` gar nicht existiert — sie führen
// also ins Leere —, und ihr Knopf zeigt auf `/register`, eine Route, die es in
// dieser App nicht gibt (sie heißt `/signup`).
//
// Stattdessen eine schlanke, ehrliche Leiste: Logo zurück auf die
// Marketing-Startseite, Sprache, und im Fuß die Rechtsdokumente. Die liegen
// bis auf die AGB in der Marketing-App, deshalb absolute Adressen aus
// `lib/marketing-url` (EINE Quelle — sonst wird beim Domainwechsel eine
// vergessen und zeigt still ins Nichts).
import type { ReactNode } from "react";

import { LanguageToggle } from "@/components/language-toggle";
import { Logo } from "@/components/logo";
import { MARKETING_START, RECHTS_LINKS } from "@/lib/marketing-url";

export default function AgbLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
          {/* Externer Link, kein `next/link`: das Ziel liegt in der
              Marketing-App, nicht in dieser. */}
          <a href={MARKETING_START} aria-label="myNextDays">
            <Logo />
          </a>
          <LanguageToggle />
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-6 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} myNextDays</p>
          <nav className="flex flex-wrap gap-x-5 gap-y-2">
            {RECHTS_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="transition-colors hover:text-foreground"
              >
                {l.label}
              </a>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}
