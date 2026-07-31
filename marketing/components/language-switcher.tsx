"use client";

// Sprachumschalter für Navbar und Footer.
//
// UI-Muster: zentriertes Modal wie bei Airbnb („Sprache und Region") — Klick auf
// den Globus öffnet ein Overlay mit Kachel-Raster, die aktive Sprache ist
// umrandet. Kein Dropdown.
//
// BEWUSST ohne Währungsreiter: der einzige Preis auf dieser Seite ist der
// Abo-Tarif, den wir tatsächlich in Euro abrechnen. Eine Währungsauswahl müsste
// ihn entweder umrechnen (Kurse, die wir nicht haben) oder gar nichts tun —
// beides wäre eine Falschaussage über den Betrag, den der Kunde zahlt.
//
// Mechanik wie in der web-App (components/language-toggle.tsx): Server-Action
// setzt das nd_locale-Cookie, router.refresh() lädt serverseitig neu, damit
// next-intl die neue Sprache anwendet. Kein URL-Präfix → die Route bleibt.
//
// Eigenes Modal ohne Radix: diese App baut BEWUSST isoliert (ADR-0016) und
// nutzt keine @nextdays/*-Packages.
//
// Das Modal MUSS per Portal an <body>: die Navbar hat `backdrop-blur`, und ein
// Filter/Transform macht das Element zum Containing Block für `position:fixed`.
// Ohne Portal bezieht sich `inset-0` deshalb auf die Navleiste — das Modal klebt
// oben in der Kopfzeile statt in der Bildschirmmitte.
import { Icon } from "@/components/ui/icon";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";

import { setLocale } from "@/i18n/actions";
import {
  LOCALES,
  LOCALE_LABELS,
  LOCALE_REGIONS,
  type Locale,
} from "@/i18n/locales";

/**
 * Vergleich ohne Akzente/Groß-Klein, damit „Cestina" auch „Čeština" findet —
 * sonst ist die Suche für genau die Sprachen unbrauchbar, die Sonderzeichen
 * haben (also für die meisten).
 */
function normalisiere(wert: string): string {
  return wert
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase();
}

export function LanguageSwitcher({ dark = false }: { dark?: boolean }) {
  const locale = useLocale() as Locale;
  const t = useTranslations("nav");
  const router = useRouter();
  const [offen, setOffen] = useState(false);
  const [suche, setSuche] = useState("");
  const [pending, startTransition] = useTransition();
  // Portalziel gibt es erst im Browser — beim Server-Rendern bleibt es null.
  const [montiert, setMontiert] = useState(false);
  useEffect(() => setMontiert(true), []);

  // Escape schließt; solange das Modal offen ist, scrollt die Seite nicht mit.
  useEffect(() => {
    if (!offen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOffen(false);
    }
    document.addEventListener("keydown", onKey);
    const vorher = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = vorher;
    };
  }, [offen]);

  const treffer = useMemo(() => {
    const q = normalisiere(suche.trim());
    if (!q) return LOCALES;
    return LOCALES.filter(
      (code) =>
        normalisiere(LOCALE_LABELS[code]).includes(q) ||
        normalisiere(LOCALE_REGIONS[code]).includes(q),
    );
  }, [suche]);

  function oeffne() {
    // Jeder Aufruf startet mit leerer Suche, nicht mit dem alten Filter.
    setSuche("");
    setOffen(true);
  }

  function waehle(next: Locale) {
    setOffen(false);
    if (next === locale) return;
    startTransition(async () => {
      await setLocale(next);
      router.refresh();
    });
  }

  const trigger = dark
    ? "text-primary-foreground/70 hover:text-primary-foreground"
    : "text-muted-foreground hover:text-foreground";

  return (
    <>
      <button
        type="button"
        onClick={oeffne}
        disabled={pending}
        aria-haspopup="dialog"
        aria-expanded={offen}
        aria-label={t("spracheWaehlen")}
        className={`flex items-center gap-1.5 text-sm font-medium transition-colors disabled:opacity-60 ${trigger}`}
      >
        <Icon icon="ph:globe" className="size-4" />
        {LOCALE_LABELS[locale]}
      </button>

      {offen &&
        montiert &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("sprachModalTitel")}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          >
            {/* Overlay — Klick schließt */}
            <button
              type="button"
              aria-label={t("schliessen")}
              onClick={() => setOffen(false)}
              className="absolute inset-0 cursor-default bg-black/50 backdrop-blur-sm"
            />

            <div className="relative z-10 flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-card shadow-2xl">
              <div className="flex items-center gap-4 px-6 pt-6 pb-2">
                <button
                  type="button"
                  onClick={() => setOffen(false)}
                  aria-label={t("schliessen")}
                  className="flex size-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-secondary"
                >
                  <Icon icon="ph:x" className="size-5" />
                </button>
              </div>

              <div className="border-b border-border px-6">
                <span className="inline-block border-b-2 border-foreground pb-3 text-sm font-medium">
                  {t("sprachModalTitel")}
                </span>
              </div>

              <div className="overflow-y-auto px-6 py-8">
                <h2 className="font-display text-2xl font-semibold tracking-tight">
                  {t("sprachModalHeading")}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("sprachModalHinweis")}
                </p>

                {/* Bei 24 Sprachen ist Suchen schneller als Scannen. */}
                <div className="relative mt-6">
                  <Icon
                    icon="ph:magnifying-glass"
                    aria-hidden
                    className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  />
                  <input
                    type="search"
                    value={suche}
                    onChange={(e) => setSuche(e.target.value)}
                    placeholder={t("suche")}
                    aria-label={t("suche")}
                    className="w-full rounded-full border border-border bg-background py-3 pl-11 pr-4 text-sm outline-none transition-colors focus:border-foreground"
                  />
                </div>

                {treffer.length === 0 ? (
                  <p className="mt-8 text-sm text-muted-foreground">
                    {t("keinTreffer")}
                  </p>
                ) : (
                  <ul className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {treffer.map((code) => {
                      const aktiv = code === locale;
                      return (
                        <li key={code}>
                          <button
                            type="button"
                            onClick={() => waehle(code)}
                            aria-current={aktiv ? "true" : undefined}
                            className={
                              "flex w-full flex-col items-start rounded-xl border px-4 py-3 text-left transition-colors " +
                              (aktiv
                                ? "border-foreground bg-background"
                                : "border-transparent hover:bg-secondary")
                            }
                          >
                            <span className="text-sm font-medium">
                              {LOCALE_LABELS[code]}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              {LOCALE_REGIONS[code]}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
