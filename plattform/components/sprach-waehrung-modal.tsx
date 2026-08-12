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

export function SprachWaehrungModal() {
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
      <button
        type="button"
        aria-label={t("waehlen")}
        onClick={() => setOffen(true)}
        className="flex size-10 items-center justify-center rounded-full transition-colors hover:bg-secondary"
      >
        <Icon icon="ph:globe" className="size-5" />
      </button>

      {offen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-foreground/40 p-4 sm:p-8">
          {/* Klick auf den Backdrop schließt */}
          <button
            type="button"
            aria-label={t("schliessen")}
            onClick={() => setOffen(false)}
            className="fixed inset-0 -z-10 cursor-default"
          />
          <div className="relative w-full max-w-4xl rounded-3xl bg-card p-6 shadow-2xl sm:p-8">
            <button
              type="button"
              aria-label={t("schliessen")}
              onClick={() => setOffen(false)}
              className="absolute left-5 top-5 flex size-8 items-center justify-center rounded-full hover:bg-secondary"
            >
              <Icon icon="ph:x" className="size-5" />
            </button>

            <h3 className="mb-6 mt-6 font-display text-xl font-semibold sm:mt-2">
              {t("titel")}
            </h3>

            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {LOCALES.map((locale) => (
                <button
                  key={locale}
                  type="button"
                  onClick={() => waehle(locale)}
                  aria-current={locale === aktiv}
                  className={
                    "rounded-xl border px-4 py-3 text-left transition-colors hover:bg-secondary " +
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

            <p className="mt-6 border-t border-border pt-4 text-sm text-muted-foreground">
              <Icon icon="ph:info" className="mr-1 inline size-4" />
              {t("waehrungHinweis")}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
