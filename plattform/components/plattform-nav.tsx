// Sticky-Navigation der Plattform.
//   ab md  — Logo links, zentrierte Tab-Zeile (Unterkünfte · Erlebnisse ·
//            Services), darunter die große Such-Leiste; rechts „für Gastgeber"
//            + Konto-/Login-Menü. Beim Scrollen kollabiert die große Leiste zu
//            einer kompakten Pille in der Kopfzeile.
//   unter md — Logo + Konto in einer schmalen Zeile, darunter die Such-Pille und
//            eine wischbare Chip-Reihe der Kanäle. Beides bleibt beim Scrollen
//            stehen: mobil war die Tab-Zeile `hidden md:block`, also gar nicht
//            vorhanden, und die Suche kollabierte in ein Element, das es unter
//            md ebenfalls nicht gab — der Gast hatte nach dem ersten Scroll
//            keinen Weg zurück in die Suche.
"use client";

import { Icon } from "@iconify/react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { gastgeberRegistrierungUrl } from "@/lib/gastgeber-link";

import { Logo } from "./logo";
import { SprachWaehrungModal } from "./sprach-waehrung-modal";
import { SuchLeiste } from "./such-leiste";

// Kanal-Zeile (Unterkünfte / Erlebnisse / Services) mit Icon. Die Labels kommen
// aus dem `nav`-Namespace — vorher standen sie deutsch im Code, in einer App mit
// 24 Sprachdateien.
const TABS = [
  { icon: "ph:squares-four", key: "unterkuenfte" },
  { icon: "ph:sparkle", key: "erlebnisse" },
  { icon: "ph:concierge-bell", key: "services" },
];

export function PlattformNav({ kontoSlot }: { kontoSlot?: React.ReactNode }) {
  const t = useTranslations("nav");
  // Gescrollt? Dann kollabiert die große Such-Leiste zur kompakten Pille (ab md).
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
          className="fixed inset-0 -z-10 cursor-default md:block"
        />
      ) : null}

      {/* Kopfzeile: Logo links · Tabs+Suche mittig · Gastgeber+Konto rechts */}
      <div className="relative flex h-16 w-full items-center justify-between gap-3 px-4 md:h-20 md:gap-4 md:px-10 2xl:px-20">
        <Link href="/" className="flex min-h-11 shrink-0 items-center">
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
                    key={tab.key}
                    type="button"
                    className={
                      "flex items-center gap-2 border-b-2 pb-1 pt-1 text-sm font-medium transition-colors " +
                      (i === 0
                        ? "border-foreground text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground")
                    }
                  >
                    <Icon icon={tab.icon} className="size-6" />
                    {t(tab.key)}
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
            href={gastgeberRegistrierungUrl()}
            className="hidden rounded-full px-4 py-2 text-sm font-medium hover:bg-secondary lg:block"
          >
            {t("gastgeber")}
          </Link>
          {/* Globus: Sprache & Währung. */}
          <SprachWaehrungModal />
          {/* Konto-/Login-Menü (serverseitig gerendert, HttpOnly-Session).
              Mobil ist es der einzige Weg zu „für Gastgeber" und Hilfe. */}
          {kontoSlot}
        </div>
      </div>

      {/* Such-Leiste unter der Kopfzeile.
          Mobil IMMER sichtbar (`md:hidden` greift nur im kollabierten Zustand),
          ab md kollabierend wie bisher. Die Ein-/Ausblendung läuft als
          CSS-Übergang statt über AnimatePresence, weil dasselbe Element in zwei
          Layouts lebt — ein Exit-Animations-Baum, der mobil nie beendet wird,
          hinterlässt sonst eine leere, aber klickbare Fläche. */}
      <div
        className={
          (grossOffen ? "" : "md:hidden ") +
          (gescrollt
            ? "md:absolute md:inset-x-0 md:top-full md:border-b md:border-border md:bg-background md:shadow-md"
            : "")
        }
      >
        <div className="mx-auto max-w-4xl px-4 pb-2 pt-1 md:px-6 md:pb-6 md:pt-2">
          <SuchLeiste />
        </div>

        {/* Kanal-Chips (nur mobil) — wischbar, mit Schnapp-Punkten. */}
        <nav
          aria-label={t("unterkuenfte")}
          className="band-scroll flex snap-x gap-2 overflow-x-auto px-4 pb-3 md:hidden"
        >
          {TABS.map((tab, i) => (
            <button
              key={tab.key}
              type="button"
              className={
                "flex min-h-11 shrink-0 snap-start items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors " +
                (i === 0
                  ? "border-foreground bg-secondary text-foreground"
                  : "border-border text-muted-foreground")
              }
            >
              <Icon icon={tab.icon} className="size-5" />
              {t(tab.key)}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}
