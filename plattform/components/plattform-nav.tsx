// Sticky-Navigation der Plattform — Layout exakt wie Airbnb: Logo links,
// zentrierte Tab-Zeile (Unterkünfte · Erlebnisse · Services) mit Icons, darunter
// die große Such-Leiste; rechts „für Gastgeber" + Konto-/Login-Menü. Beim
// Scrollen kollabiert die große Leiste zu einer kompakten Pille in der Kopfzeile.
"use client";

import { Icon } from "@iconify/react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Logo } from "./logo";
import { SprachWaehrungModal } from "./sprach-waehrung-modal";
import { SuchLeiste } from "./such-leiste";

// Ziel des "myBestDays für Gastgeber"-Buttons: die Marketing-/Gastgeber-Seite.
const GASTGEBER_URL =
  process.env.NEXT_PUBLIC_GASTGEBER_URL ??
  "https://mynextdays.com";

// Tab-Zeile wie Airbnb (All / Homes / Experiences / Services) mit Icon.
const TABS = [
  { icon: "ph:squares-four", label: "Unterkünfte" },
  { icon: "ph:sparkle", label: "Erlebnisse" },
  { icon: "ph:concierge-bell", label: "Services" },
];

export function PlattformNav({ kontoSlot }: { kontoSlot?: React.ReactNode }) {
  // Gescrollt? Dann kollabiert die große Such-Leiste zur kompakten Pille.
  const [gescrollt, setGescrollt] = useState(false);
  // Manuell wieder aufgeklappt (Klick auf die kompakte Pille im gescrollten
  // Zustand) — zeigt die große Leiste, ohne nach oben zu scrollen.
  const [manuellOffen, setManuellOffen] = useState(false);

  useEffect(() => {
    function pruefe() {
      const y = window.scrollY || document.documentElement.scrollTop || 0;
      setGescrollt(y > 40);
    }
    pruefe();
    window.addEventListener("scroll", pruefe, { passive: true });
    return () => window.removeEventListener("scroll", pruefe);
  }, []);

  useEffect(() => {
    if (!gescrollt) setManuellOffen(false);
  }, [gescrollt]);

  // Große Leiste sichtbar, wenn oben ODER manuell aufgeklappt.
  const grossOffen = !gescrollt || manuellOffen;

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background">
      {/* Backdrop: schließt die als Overlay aufgeklappte Leiste bei Klick daneben */}
      {gescrollt && manuellOffen ? (
        <button
          type="button"
          aria-label="Suche schließen"
          onClick={() => setManuellOffen(false)}
          className="fixed inset-0 -z-10 cursor-default"
        />
      ) : null}

      {/* Kopfzeile: Logo links · Tabs+Suche mittig · Gastgeber+Konto rechts */}
      <div className="relative flex h-20 w-full items-center justify-between gap-4 px-6 md:px-10 2xl:px-20">
        <Link href="/" className="flex shrink-0 items-center">
          <Logo />
        </Link>

        {/* Mitte: Tab-Zeile (oben) — kompakte Such-Pille erscheint hier beim Scrollen */}
        <div className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 md:block">
          <AnimatePresence mode="wait" initial={false}>
            {grossOffen ? (
              <motion.nav
                key="tabs"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-8"
              >
                {TABS.map((tab, i) => (
                  <button
                    key={tab.label}
                    type="button"
                    className={
                      "flex items-center gap-2 border-b-2 pb-1 pt-1 text-sm font-medium transition-colors " +
                      (i === 0
                        ? "border-foreground text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground")
                    }
                  >
                    <Icon icon={tab.icon} className="size-6" />
                    {tab.label}
                  </button>
                ))}
              </motion.nav>
            ) : (
              <motion.button
                key="pille"
                type="button"
                onClick={() => setManuellOffen(true)}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-4 rounded-full border border-border bg-card py-2 pl-6 pr-2 text-sm font-medium shadow-md transition-shadow hover:shadow-lg"
              >
                <span>Reiseziel</span>
                <span className="h-6 w-px bg-border" />
                <span className="text-muted-foreground">Datum</span>
                <span className="h-6 w-px bg-border" />
                <span className="text-muted-foreground">Gäste</span>
                <span className="flex size-8 items-center justify-center rounded-full bg-accent text-accent-foreground">
                  <Icon icon="ph:magnifying-glass" className="size-4" />
                </span>
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={GASTGEBER_URL}
            className="hidden rounded-full px-4 py-2 text-sm font-medium hover:bg-secondary sm:block"
          >
            myBestDays für Gastgeber
          </Link>
          {/* Globus: Sprache & Währung (wie Airbnb). */}
          <SprachWaehrungModal />
          {/* Konto-/Login-Menü (serverseitig gerendert, HttpOnly-Session). */}
          {kontoSlot}
        </div>
      </div>

      {/* Große Such-Leiste unter der Kopfzeile (Airbnb: zentriert, breit). */}
      <AnimatePresence initial={false}>
        {grossOffen ? (
          <motion.div
            key="suche"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={
              gescrollt
                ? "absolute inset-x-0 top-full border-b border-border bg-background shadow-md"
                : ""
            }
          >
            <div className="mx-auto max-w-4xl px-6 pb-6 pt-2">
              <SuchLeiste />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
