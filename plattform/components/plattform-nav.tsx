// Sticky-Navigation der Plattform: Kopfzeile (Logo + Konto) + große Such-Leiste
// + Kategorie-Leiste als ein zusammenhängender Block. Beim Scrollen kollabiert
// die große Such-Leiste zu einer kompakten Such-Pille, die in die Kopfzeile
// zwischen Logo und "für Gastgeber" wandert (Verhalten wie gängige Buchungs-
// plattformen). Eigenes myNextDays-Design.
"use client";

import { Icon } from "@iconify/react";
import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { SuchLeiste } from "./such-leiste";

const TABS = ["Unterkünfte", "Erlebnisse", "Services"];

const KATEGORIEN = [
  { icon: "ph:buildings", label: "Stadt" },
  { icon: "ph:mountains", label: "Berge" },
  { icon: "ph:waves", label: "Am Wasser" },
  { icon: "ph:tree", label: "Natur" },
  { icon: "ph:house-line", label: "Ferienhaus" },
  { icon: "ph:swimming-pool", label: "Mit Pool" },
  { icon: "ph:fire", label: "Kamin" },
  { icon: "ph:island", label: "Strand" },
  { icon: "ph:tent", label: "Campingplätze" },
];

export function PlattformNav() {
  // Gescrollt? Dann kollabiert die große Such-Leiste zur kompakten Pille.
  // Maßgeblich ist die Scroll-Position des Fensters (> 40px).
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

  // Wenn ganz nach oben gescrollt wird, manuelle Aufklappung zurücksetzen
  // (dann zählt wieder der normale "oben"-Zustand).
  useEffect(() => {
    if (!gescrollt) setManuellOffen(false);
  }, [gescrollt]);

  // Große Leiste sichtbar, wenn oben ODER manuell aufgeklappt.
  const grossOffen = !gescrollt || manuellOffen;

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur">
      {/* Backdrop: schließt die als Overlay aufgeklappte Leiste bei Klick daneben */}
      {gescrollt && manuellOffen ? (
        <button
          type="button"
          aria-label="Suche schließen"
          onClick={() => setManuellOffen(false)}
          className="fixed inset-0 -z-10 cursor-default bg-foreground/10 backdrop-blur-sm"
        />
      ) : null}
      {/* Kopfzeile: Logo · (kompakte Such-Pille beim Scrollen, absolut mittig) · Konto */}
      <div className="relative mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-6">
        <Link href="/" className="flex shrink-0 items-center">
          <Image
            src="/mynextdays-logo.png"
            alt="myNextDays"
            width={1470}
            height={399}
            priority
            className="h-9 w-auto"
          />
        </Link>

        {/* Kompakte Such-Pille — nur im gescrollten Zustand sichtbar.
            Absolut horizontal zentriert (unabhängig von Logo-/Konto-Breite).
            Klick klappt die große Leiste wieder auf (kein Scrollen). */}
        <AnimatePresence>
          {gescrollt && !manuellOffen ? (
            <motion.button
              type="button"
              onClick={() => setManuellOffen(true)}
              initial={{ opacity: 0, scale: 0.9, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="absolute left-1/2 top-1/2 z-10 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-4 rounded-full border border-border bg-card py-2 pl-6 pr-2 text-base font-medium shadow-md transition-shadow hover:shadow-lg md:flex"
            >
              <span>Reiseziel</span>
              <span className="h-6 w-px bg-border" />
              <span className="text-muted-foreground">Datum</span>
              <span className="h-6 w-px bg-border" />
              <span className="text-muted-foreground">Gäste</span>
              <span className="flex size-11 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <Icon icon="ph:magnifying-glass" className="size-5" />
              </span>
            </motion.button>
          ) : null}
        </AnimatePresence>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/"
            className="hidden rounded-full px-4 py-2 text-sm font-medium hover:bg-secondary sm:block"
          >
            myNextDays für Gastgeber
          </Link>
          <button
            type="button"
            className="flex items-center gap-2 rounded-full border border-border py-1.5 pl-3 pr-1.5 hover:shadow-sm"
          >
            <Icon icon="ph:list" className="size-4" />
            <span className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Icon icon="ph:user" className="size-4" />
            </span>
          </button>
        </div>
      </div>

      {/* Tab-Zeile + große Such-Leiste.
          - Oben (nicht gescrollt): im normalen Fluss, schiebt Kategorien/Inhalt.
          - Gescrollt + manuell aufgeklappt: als OVERLAY (absolut) unter der
            Kopfzeile — schiebt nichts, scrollt nicht. */}
      <AnimatePresence initial={false}>
        {grossOffen ? (
          <motion.div
            key="gross"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className={
              "overflow-hidden " +
              (gescrollt
                ? "absolute inset-x-0 top-full border-b border-border bg-background shadow-md"
                : "")
            }
          >
            {/* Tabs: Unterkünfte · Erlebnisse · Services (aktiver unterstrichen) */}
            <div className="mx-auto flex max-w-7xl items-center justify-center gap-8 px-6 pt-2">
              {TABS.map((tab, i) => (
                <button
                  key={tab}
                  type="button"
                  className={
                    "border-b-2 pb-3 pt-1 text-sm font-medium transition-colors " +
                    (i === 0
                      ? "border-foreground text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground")
                  }
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="mx-auto max-w-7xl px-6 pb-5 pt-4">
              <SuchLeiste />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Kategorie-Leiste */}
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl items-center justify-center gap-8 overflow-x-auto px-6 py-4">
          {KATEGORIEN.map((kat, i) => (
            <button
              key={kat.label}
              type="button"
              className={
                "flex shrink-0 flex-col items-center gap-2 border-b-2 pb-2 text-xs font-medium transition-colors " +
                (i === 0
                  ? "border-accent text-foreground"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground")
              }
            >
              <Icon icon={kat.icon} className="size-6" />
              {kat.label}
            </button>
          ))}
        </div>
      </div>
      </header>
    </>
  );
}
