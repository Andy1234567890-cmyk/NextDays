"use client";

// Feature-Reiter — das Herzstück einer Funktions-Unterseite.
//
// Referenz-UX (hostaway.com/features/communication/, abgelesen 18.08.2026):
// Unter der Überschrift „Features that bring every conversation together"
// steht dort eine Reihe umrandeter Chips (Unified Inbox · AI Replies ·
// Translations · Automated Messaging · SMS & WhatsApp · Automated Reviews).
// Ein Klick tauscht den Block darunter: links eine gebaute Grafik, rechts
// Eyebrow, Überschrift, ein Absatz und ein CTA.
//
// Warum das besser ist als vier Textblöcke untereinander: eine Funktion hat
// vier bis sechs Teilaspekte, die kaum jemand alle lesen will — der Besucher
// sucht einen davon. Die Chips zeigen in einer Zeile, WAS es gibt, und
// liefern auf Klick genau den einen Abschnitt.
//
// Bedienung: echte Reiter (role="tablist"), mit Pfeiltasten bedienbar. Die
// nicht gewählten Panels bleiben im Markup (`hidden`), damit Suchmaschinen
// alle Inhalte sehen — dieselbe Entscheidung wie beim FAQ-Akkordeon.
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useId, useRef, useState } from "react";

import {
  GrafikBalken,
  GrafikBelegung,
  GrafikCheckliste,
  GrafikKanaele,
  GrafikNachrichten,
  GrafikPreise,
  GrafikZahlung,
  GrafikZeichnung,
} from "@/components/funktionen/funktions-grafiken";
import {
  AppAufnahmenMobilReihe,
  TelefonBuehne,
} from "@/components/marketing/app-aufnahme-mobil";
import { Button } from "@/components/ui/button";
import { SIGNUP_URL } from "@/lib/app-url";

import type { AppMotivMobil } from "@/lib/app-mobil";

/** Welche Grafik ein Reiter zeigt. */
export type GrafikArt =
  | "kanaele"
  | "nachrichten"
  | "checkliste"
  | "balken"
  | "preise"
  | "zahlung"
  | "belegung"
  | "zeichnung";

export type Reiter = {
  key: string;
  grafik: GrafikArt;
  /** Echte Telefon-Aufnahmen; gesetzt schlagen sie die gebaute Grafik. Eine
   *  Aufnahme der Sache ist immer der stärkere Beleg als eine Nachbildung. */
  telefon?: readonly AppMotivMobil[];
};

export function FunktionsReiter({
  gruppe,
  reiter,
}: {
  gruppe: string;
  reiter: readonly Reiter[];
}) {
  const t = useTranslations(`funktionen.${gruppe}.reiter`);
  const tr = useTranslations("funktionen.rahmen");
  const [aktiv, setAktiv] = useState(0);
  const id = useId();
  const knoepfe = useRef<(HTMLButtonElement | null)[]>([]);

  function beiTaste(e: React.KeyboardEvent) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const naechster =
      e.key === "ArrowRight"
        ? (aktiv + 1) % reiter.length
        : (aktiv - 1 + reiter.length) % reiter.length;
    setAktiv(naechster);
    knoepfe.current[naechster]?.focus();
  }

  return (
    <section className="bg-background">
      <div className="mx-auto max-w-7xl px-6 py-20">
        <h2 className="mx-auto max-w-3xl text-center font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
          {tr("reiterHeading")}
        </h2>

        {/* Chip-Reihe */}
        <div
          role="tablist"
          aria-label={tr("reiterHeading")}
          onKeyDown={beiTaste}
          className="mx-auto mt-10 flex max-w-5xl flex-wrap justify-center gap-3"
        >
          {reiter.map((r, i) => (
            <button
              key={r.key}
              ref={(el) => {
                knoepfe.current[i] = el;
              }}
              role="tab"
              type="button"
              id={`${id}-tab-${i}`}
              aria-selected={aktiv === i}
              aria-controls={`${id}-panel-${i}`}
              tabIndex={aktiv === i ? 0 : -1}
              onClick={() => setAktiv(i)}
              className={`rounded-2xl border px-5 py-3 text-sm font-semibold transition-colors ${
                aktiv === i
                  ? "border-accent bg-accent text-accent-foreground shadow-float"
                  : "border-border bg-card text-foreground hover:border-accent/40 hover:bg-surface-warm"
              }`}
            >
              {t(`${r.key}.titel`)}
            </button>
          ))}
        </div>

        {/* Panels */}
        <div className="mt-14">
          {reiter.map((r, i) => (
            <div
              key={r.key}
              role="tabpanel"
              id={`${id}-panel-${i}`}
              aria-labelledby={`${id}-tab-${i}`}
              hidden={aktiv !== i}
              className="grid min-w-0 items-center gap-12 lg:grid-cols-2"
            >
              <div className="order-2 min-w-0 lg:order-1">
                <p className="eyebrow">{t(`${r.key}.titel`)}</p>
                <h3 className="mt-4 font-display text-2xl font-extrabold leading-tight sm:text-3xl">
                  {t(`${r.key}.heading`)}
                </h3>
                <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
                  {t(`${r.key}.text`)}
                </p>
                <Button asChild variant="accent" size="lg" className="mt-7">
                  <Link href={SIGNUP_URL} data-cta="signup">
                    {tr("ctaTesten")}
                  </Link>
                </Button>
              </div>

              {/* Echte Aufnahmen stehen frei auf einer Akzent-Aura (wie die
                  Aufnahmen der Startseite); die GEBAUTE Grafik braucht dagegen
                  ihr getöntes Feld, sonst schwimmt sie in der leeren Spalte. */}
              {r.telefon ? (
                <TelefonBuehne className="order-1 lg:order-2">
                  <AppAufnahmenMobilReihe
                    motive={r.telefon}
                    alt={t(`${r.key}.heading`)}
                  />
                </TelefonBuehne>
              ) : (
                <div className="order-1 min-w-0 rounded-[2rem] bg-surface-warm p-6 sm:p-8 lg:order-2 lg:p-10">
                  <Grafik
                    art={r.grafik}
                    gruppe={gruppe}
                    titel={t(`${r.key}.titel`)}
                    punkte={[
                      t(`${r.key}.punkte.a`),
                      t(`${r.key}.punkte.b`),
                      t(`${r.key}.punkte.c`),
                    ]}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Art → Grafik. Unbekannte Art fällt auf die Zeichnung der Gruppe zurück. */
function Grafik({
  art,
  gruppe,
  titel,
  punkte,
}: {
  art: GrafikArt;
  gruppe: string;
  titel: string;
  punkte: readonly string[];
}) {
  switch (art) {
    case "kanaele":
      return <GrafikKanaele />;
    case "nachrichten":
      return <GrafikNachrichten titel={titel} punkte={punkte} />;
    case "checkliste":
      return <GrafikCheckliste titel={titel} punkte={punkte} />;
    case "balken":
      return <GrafikBalken titel={titel} punkte={punkte} />;
    case "preise":
      return <GrafikPreise titel={titel} punkte={punkte} />;
    case "zahlung":
      return <GrafikZahlung titel={titel} punkte={punkte} />;
    case "belegung":
      return <GrafikBelegung titel={titel} punkte={punkte} />;
    default:
      return <GrafikZeichnung gruppe={gruppe} titel={titel} punkte={punkte} />;
  }
}
