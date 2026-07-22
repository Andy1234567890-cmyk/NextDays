// Globus-Menü der Kopfzeile (wie Airbnb): öffnet ein Modal mit zwei Tabs —
// „Sprache und Region" und „Währung". Auswahl wird lokal gehalten (Anzeige-
// Präferenz); die echte Objektwährung bleibt immer die des Objekts (Wurzel 4).
"use client";

import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";

type Sprache = { name: string; region: string; locale: string };

const SPRACHEN: Sprache[] = [
  { name: "Deutsch", region: "Deutschland", locale: "de-DE" },
  { name: "Deutsch", region: "Österreich", locale: "de-AT" },
  { name: "Deutsch", region: "Schweiz", locale: "de-CH" },
  { name: "English", region: "United States", locale: "en-US" },
  { name: "English", region: "United Kingdom", locale: "en-GB" },
  { name: "Français", region: "France", locale: "fr-FR" },
  { name: "Español", region: "España", locale: "es-ES" },
  { name: "Italiano", region: "Italia", locale: "it-IT" },
  { name: "Nederlands", region: "Nederland", locale: "nl-NL" },
  { name: "Dansk", region: "Danmark", locale: "da-DK" },
  { name: "Polski", region: "Polska", locale: "pl-PL" },
  { name: "Čeština", region: "Česká republika", locale: "cs-CZ" },
];

// ISO-4217-Code + Symbol. Reine Anzeige-Präferenz.
type Waehrung = { code: string; name: string; symbol: string };

const WAEHRUNGEN: Waehrung[] = [
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "CHF", name: "Schweizer Franken", symbol: "CHF" },
  { code: "GBP", name: "Pfund Sterling", symbol: "£" },
  { code: "USD", name: "US-Dollar", symbol: "$" },
  { code: "DKK", name: "Dänische Krone", symbol: "kr" },
  { code: "SEK", name: "Schwedische Krone", symbol: "kr" },
  { code: "NOK", name: "Norwegische Krone", symbol: "kr" },
  { code: "PLN", name: "Polnischer Złoty", symbol: "zł" },
  { code: "CZK", name: "Tschechische Krone", symbol: "Kč" },
  { code: "HUF", name: "Ungarischer Forint", symbol: "Ft" },
  { code: "RON", name: "Rumänischer Leu", symbol: "lei" },
  { code: "BGN", name: "Bulgarischer Lew", symbol: "лв." },
];

export function SprachWaehrungModal() {
  const [offen, setOffen] = useState(false);
  const [tab, setTab] = useState<"sprache" | "waehrung">("sprache");
  const [locale, setLocale] = useState("de-DE");
  const [waehrung, setWaehrung] = useState("EUR");

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

  return (
    <>
      <button
        type="button"
        aria-label="Sprache und Währung"
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
            aria-label="Schließen"
            onClick={() => setOffen(false)}
            className="fixed inset-0 -z-10 cursor-default"
          />
          <div className="relative w-full max-w-4xl rounded-3xl bg-card p-6 shadow-2xl sm:p-8">
            <button
              type="button"
              aria-label="Schließen"
              onClick={() => setOffen(false)}
              className="absolute left-5 top-5 flex size-8 items-center justify-center rounded-full hover:bg-secondary"
            >
              <Icon icon="ph:x" className="size-5" />
            </button>

            {/* Tabs */}
            <div className="mb-8 flex justify-center gap-8 border-b border-border pt-2">
              {([
                { key: "sprache", label: "Sprache und Region" },
                { key: "waehrung", label: "Währung" },
              ] as const).map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={
                    "border-b-2 pb-3 text-sm font-medium transition-colors " +
                    (tab === t.key
                      ? "border-foreground text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground")
                  }
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === "sprache" ? (
              <>
                <h3 className="mb-4 font-display text-xl font-semibold">
                  Sprache und Region wählen
                </h3>
                <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {SPRACHEN.map((s) => (
                    <button
                      key={s.locale}
                      type="button"
                      onClick={() => setLocale(s.locale)}
                      className={
                        "rounded-xl border px-4 py-3 text-left transition-colors hover:bg-secondary " +
                        (locale === s.locale ? "border-foreground" : "border-transparent")
                      }
                    >
                      <span className="block text-sm font-medium">{s.name}</span>
                      <span className="block text-sm text-muted-foreground">
                        {s.region}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <h3 className="mb-4 font-display text-xl font-semibold">
                  Währung wählen
                </h3>
                <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {WAEHRUNGEN.map((w) => (
                    <button
                      key={w.code}
                      type="button"
                      onClick={() => setWaehrung(w.code)}
                      className={
                        "rounded-xl border px-4 py-3 text-left transition-colors hover:bg-secondary " +
                        (waehrung === w.code ? "border-foreground" : "border-transparent")
                      }
                    >
                      <span className="block text-sm font-medium">{w.name}</span>
                      <span className="block text-sm text-muted-foreground">
                        {w.code} – {w.symbol}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
