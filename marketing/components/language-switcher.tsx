"use client";

// Sprachumschalter für Navbar und Footer.
//
// UI-Muster: zentriertes Modal wie bei Airbnb („Sprache und Region") — Klick auf
// den Globus öffnet ein Overlay mit Kachel-Raster, die aktive Sprache ist
// umrandet. Kein Dropdown.
//
// Mechanik wie in der web-App (components/language-toggle.tsx): Server-Action
// setzt das nd_locale-Cookie, router.refresh() lädt serverseitig neu, damit
// next-intl die neue Sprache anwendet. Kein URL-Präfix → die Route bleibt.
//
// Eigenes Modal ohne Radix: diese App baut BEWUSST isoliert (ADR-0016) und
// nutzt keine @nextdays/*-Packages.
import { Icon } from "@/components/ui/icon";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { setLocale } from "@/i18n/actions";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/i18n/locales";

export function LanguageSwitcher({ dark = false }: { dark?: boolean }) {
  const locale = useLocale() as Locale;
  const t = useTranslations("nav");
  const tSprachen = useTranslations("sprachen");
  const router = useRouter();
  const [offen, setOffen] = useState(false);
  const [pending, startTransition] = useTransition();

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
        onClick={() => setOffen(true)}
        disabled={pending}
        aria-haspopup="dialog"
        aria-expanded={offen}
        aria-label={t("spracheWaehlen")}
        className={`flex items-center gap-1.5 text-sm font-medium transition-colors disabled:opacity-60 ${trigger}`}
      >
        <Icon icon="ph:globe" className="size-4" />
        {LOCALE_LABELS[locale]}
      </button>

      {offen && (
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

              <ul className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {LOCALES.map((code) => {
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
                        <span className="text-sm font-medium">{LOCALE_LABELS[code]}</span>
                        <span className="text-sm text-muted-foreground">
                          {tSprachen(code)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
