"use client";

// Sprachumschalter für Navbar und Footer.
//
// UI-Muster: zentriertes Modal wie bei Airbnb („Sprache und Region") — Klick auf
// den Auslöser öffnet ein Overlay mit Kachel-Raster, die aktive Sprache ist
// umrandet. Kein Dropdown.
//
// Jede Kachel trägt die LÄNDERFLAGGE (components/flagge.tsx), der Auslöser die
// der aktiven Sprache. Bei 24 Zeilen Endonym-Text — „Latviešu", „Lietuvių",
// „Slovenčina", „Slovenščina" — ist die Farbmarke das, woran man seine Zeile
// findet, ohne zu lesen; genau deshalb führen Booking und Airbnb sie ebenfalls.
//
// AUSLÖSER-VARIANTEN: auf dem Telefon steht er NEBEN dem Menü-Knopf in der
// Kopfzeile und zeigt dort nur Flagge + Sprachcode („DE") — der Endonym-Name
// wäre bei 390 px in mehreren Sprachen zu breit für die Zeile, in der schon
// Logo und Menü-Knopf stehen (dieselbe Rechnung, die den CTA mobil aus der
// Kopfzeile genommen hat). Ab `md` steht der volle Name, weil der Platz da ist.
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
import { Flagge } from "@/components/flagge";
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

export function LanguageSwitcher({
  dark = false,
  /**
   * `"kompakt"` = umrandeter Kreis mit Flagge, passend zum Menü-Knopf der
   * Kopfzeile; `"voll"` = Flagge + Sprachname als Textknopf.
   */
  variante = "voll",
}: {
  dark?: boolean;
  variante?: "voll" | "kompakt";
}) {
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

  const kompakt = variante === "kompakt";

  return (
    <>
      <button
        type="button"
        onClick={oeffne}
        disabled={pending}
        aria-haspopup="dialog"
        aria-expanded={offen}
        aria-label={t("spracheWaehlen")}
        className={
          kompakt
            ? "inline-flex size-10 items-center justify-center rounded-full border border-border transition-colors hover:bg-surface-accent disabled:opacity-60"
            : `flex items-center gap-2 text-sm font-medium transition-colors disabled:opacity-60 ${trigger}`
        }
      >
        {/* `dark` nur am AUSLÖSER: das Modal steht immer auf `bg-card`, dort
            wäre eine helle Kante die falsche.

            Kompakt: `h-3.5` (0,875 rem) statt `h-4`. Der Kreis ist mit
            2,5 rem exakt so groß wie der Menü-Knopf daneben, aber eine 4:3-
            Flagge auf 1 rem Höhe ist 1,33 rem BREIT — sie füllte den Kreis
            fast randlos, während das Menü-Icon 1,25 rem quadratisch darin
            steht. Zwei gleich große Kreise sehen dann verschieden groß aus,
            weil die Füllung sie verschieden groß macht. Bei 0,875 rem Höhe
            ist die Flagge 1,17 rem breit und trägt denselben Innenrand. */}
        <Flagge locale={locale} dark={dark} className="h-3.5" />
        {kompakt ? null : LOCALE_LABELS[locale]}
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
                              "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors " +
                              (aktiv
                                ? "border-foreground bg-background"
                                : "border-transparent hover:bg-secondary")
                            }
                          >
                            <Flagge locale={code} className="h-5" />
                            <span className="flex min-w-0 flex-col">
                              <span className="text-sm font-medium">
                                {LOCALE_LABELS[code]}
                              </span>
                              <span className="text-sm text-muted-foreground">
                                {LOCALE_REGIONS[code]}
                              </span>
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
