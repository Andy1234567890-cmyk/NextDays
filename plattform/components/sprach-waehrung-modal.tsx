"use client";

// Globus-Menü der Kopfzeile (wie Airbnb): Sprachwahl des Gastes.
//
// Die Auswahl WIRKT: sie schreibt das Sprach-Cookie (`nd_gast_locale`), das
// `i18n/request.ts` liest, und lädt die Server-Komponenten neu. Vorher hielt das
// Modal die Auswahl nur in lokalem State — der Gast klickte „Français" und die
// Seite blieb deutsch. Genau diese Sorte Attrappe schaffen wir ab.
//
// Kein Währungs-Tab: Preise stehen in der Währung der Unterkunft (Wurzel 4 —
// eine Objektwährung, keine Umrechnung ohne echte Kurse). Statt einer Auswahl,
// die nichts umrechnet, steht dort ein Satz, der das erklärt.
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import {
  LOCALES,
  LOCALE_COOKIE,
  LOCALE_LABELS,
  LOCALE_REGIONS,
  type Locale,
} from "@/i18n/locales";

// Ein Jahr — dieselbe Lebensdauer wie im Gastgeber-Dashboard.
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function SprachWaehrungModal({
  variante = "icon",
}: {
  /** `icon` = Globus in der Kopfzeile. `text` = Globus + Sprachname, für die
   *  Fußzeile. EIN Modal, zwei Auslöser — in der Fußzeile stand vorher ein
   *  `<button>` ohne onClick, also eine Attrappe, die eine Sprachwahl versprach. */
  variante?: "icon" | "text";
}) {
  const t = useTranslations("sprache");
  const router = useRouter();
  const aktiv = useLocale();
  const [offen, setOffen] = useState(false);

  // ESC schließt das Modal; Body-Scroll sperren solange offen.
  useEffect(() => {
    if (!offen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOffen(false);
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [offen]);

  function waehle(locale: Locale) {
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
    setOffen(false);
    // Server-Komponenten neu rendern — die Sprache steckt in ihrer Antwort.
    router.refresh();
  }

  return (
    <>
      {variante === "text" ? (
        <button
          type="button"
          onClick={() => setOffen(true)}
          className="flex min-h-11 items-center gap-1.5 text-sm font-medium hover:underline sm:min-h-0"
        >
          <Icon icon="ph:globe" className="size-4" />
          {/* Sprachname als Endonym + Sprachcode — aus dem AKTIVEN Locale, nicht
              als fester Text. Vorher stand hier „Deutsch (DE)" im Code, auch
              wenn die Seite gerade griechisch war. */}
          {LOCALE_LABELS[aktiv as Locale] ?? aktiv} ({aktiv.toUpperCase()})
        </button>
      ) : (
        <button
          type="button"
          aria-label={t("waehlen")}
          onClick={() => setOffen(true)}
          className="flex size-11 items-center justify-center rounded-full transition-colors hover:bg-secondary md:size-10"
        >
          <Icon icon="ph:globe" className="size-5" />
        </button>
      )}

      {offen && (
        // `items-start` ist Pflicht, NICHT `items-stretch`: bei stretch bekommt
        // das Panel die Höhe des Bildschirms zugewiesen, sein Inhalt (24
        // Sprachen einspaltig) ist aber höher — dann läuft die Liste unten aus
        // dem gefärbten Kasten heraus und stand ohne Hintergrund über der Seite
        // (live gesehen am 18.08.2026). `min-h-full` am Panel füllt den
        // Bildschirm, ohne die Höhe zu erzwingen.
        <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto overscroll-contain bg-foreground/40 sm:p-8">
          {/* Klick auf den Backdrop schließt */}
          <button
            type="button"
            aria-label={t("schliessen")}
            onClick={() => setOffen(false)}
            className="fixed inset-0 -z-10 cursor-default"
          />
          <div
            className="relative min-h-full w-full max-w-4xl bg-card shadow-2xl sm:min-h-0 sm:rounded-3xl"
            style={{ paddingBottom: "calc(1rem + var(--safe-b))" }}
          >
            {/* Kopfzeile mobil mitlaufend: einspaltig sind das 24 Einträge, und
                ein Schließen-Knopf, der nach dem ersten Wisch aus dem Bild ist,
                lässt den Gast im Modal sitzen. Ab sm bleibt er wie bisher als
                Kreis in der Ecke. */}
            <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-card px-3 py-2 sm:static sm:border-0 sm:px-8 sm:pb-0 sm:pt-8">
              <button
                type="button"
                aria-label={t("schliessen")}
                onClick={() => setOffen(false)}
                className="flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-secondary sm:size-8"
              >
                <Icon icon="ph:x" className="size-5" />
              </button>
              <h3 className="font-display text-lg font-semibold sm:ml-2 sm:text-xl">
                {t("titel")}
              </h3>
            </div>

            <div className="mt-4 grid gap-2 px-4 sm:mt-6 sm:grid-cols-3 sm:px-8 lg:grid-cols-4">
              {LOCALES.map((locale) => (
                <button
                  key={locale}
                  type="button"
                  onClick={() => waehle(locale)}
                  aria-current={locale === aktiv}
                  className={
                    "min-h-14 rounded-xl border px-4 py-3 text-left transition-colors hover:bg-secondary " +
                    (locale === aktiv ? "border-foreground" : "border-transparent")
                  }
                >
                  <span className="block text-sm font-medium">
                    {LOCALE_LABELS[locale]}
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    {LOCALE_REGIONS[locale]}
                  </span>
                </button>
              ))}
            </div>

            <p className="mx-4 mt-6 border-t border-border pt-4 text-sm text-muted-foreground sm:mx-8">
              <Icon icon="ph:info" className="mr-1 inline size-4" />
              {t("waehrungHinweis")}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
