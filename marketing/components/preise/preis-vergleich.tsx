// Vergleichstabelle — unser Preis neben den veröffentlichten Preisen der
// bekanntesten Alternativen, bei derselben Objektzahl.
//
// Warum das auf die Seite gehört: „19,90 € plus Staffel" sagt einem Vermieter
// nichts, solange er nicht weiß, was das Umfeld nimmt. Bei 20 Objekten liegt
// der Unterschied im dreistelligen Bereich pro Monat — das ist das Argument,
// nicht der Einstiegspreis.
//
// Warum es keine Häkchen-Matrix ist (die Referenz hat eine): eine Matrix über
// fremde Funktionsumfänge müssten wir laufend nachpflegen, sonst behauptet sie
// irgendwann Falsches über einen Mitbewerber. Verglichen wird deshalb nur, was
// öffentlich und eindeutig ist: der Preis des Tarifs, der unseren Umfang
// abdeckt — mit Quelle, Rechenweg und Stand (content/wettbewerb.ts).
import { useLocale, useTranslations } from "next-intl";

import { SectionHeading } from "@/components/marketing/section-kit";
import { Icon } from "@/components/ui/icon";
import {
  VERGLEICH_OBJEKTE,
  WETTBEWERB,
  WETTBEWERB_STAND,
} from "@/content/wettbewerb";
import { formatCurrency } from "@/lib/currency";
import type { Preisliste } from "@/lib/preise";
import { staffelPreisCent } from "@/lib/tarif";

export function PreisVergleich({ liste }: { liste: Preisliste | null }) {
  const t = useTranslations("preise.vergleich");
  const locale = useLocale();

  // Unser Preis wird GERECHNET, nicht eingetragen — sonst stünde in der
  // Vergleichszeile eine Zahl, die eine Preisänderung nicht mitbekommt.
  const unsCent = liste ? staffelPreisCent(liste.grundtarif_tiers, VERGLEICH_OBJEKTE) : null;
  if (!liste || unsCent === null) return null;

  // Die Wettbewerbszahlen sind in EUR recherchiert. Steht unsere Preisliste in
  // einer anderen Währung (Stripe-Anker), wäre die Spalte ein Äpfel-Birnen-
  // Vergleich mit implizitem Kurs 1:1 — dann entfällt die Sektion (Wurzel 4).
  if (liste.currency.toUpperCase() !== "EUR") return null;

  // Längster Balken = teuerster veröffentlichter Preis. Zahlen allein lassen
  // einen Faktor 3 nicht sehen; der Balken macht ihn sichtbar, ohne dass wir
  // etwas behaupten müssten, das nicht in der Zahl steht.
  const hoechster = Math.max(
    ...WETTBEWERB.map((w) => w.preis20 ?? 0),
    unsCent / 100,
  );

  // Wie viel günstiger sind wir als der Durchschnitt der veröffentlichten
  // Preise? Eine Prozentzahl sagt mehr als sechs Beträge nebeneinander — sie
  // wird GERECHNET, nicht behauptet.
  const fremdePreise = WETTBEWERB.map((w) => w.preis20).filter(
    (p): p is number => p !== null,
  );
  const schnittFremd =
    fremdePreise.reduce((s, p) => s + p, 0) / fremdePreise.length;
  const unserPreis = unsCent / 100;
  const ersparnisProzent = Math.round((1 - unserPreis / schnittFremd) * 100);

  return (
    <section className="bg-background">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <SectionHeading
          eyebrow={t("eyebrow")}
          heading={t("heading")}
          sub={t("sub", { objekte: VERGLEICH_OBJEKTE })}
        />

        {/* Unsere Zeile als eigene Karte, nicht als erste Tabellenzeile: sie
            ist die Aussage der Sektion, alles Weitere ist der Beleg dafür. */}
        <div className="mt-12 flex flex-col gap-4 rounded-[2rem] border border-accent bg-surface-accent p-8 shadow-float sm:flex-row sm:items-center sm:justify-between sm:gap-8">
          <div>
            <p className="font-display text-xl font-extrabold">myNextDays</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("unsereRechnung")}
            </p>
          </div>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
            <p className="font-display text-4xl font-extrabold tabular-nums text-accent">
              {formatCurrency(unserPreis, "EUR", locale)}
              <span className="ml-1 text-base font-semibold text-muted-foreground">
                {t("proMonat")}
              </span>
            </p>
            {ersparnisProzent > 0 ? (
              <span className="rounded-full bg-accent px-3 py-1.5 text-sm font-semibold text-accent-foreground">
                {t("ersparnis", { prozent: ersparnisProzent })}
              </span>
            ) : null}
          </div>
        </div>

        {/* Die Alternativen als Zeilen-Karten mit Balken. Eine Datentabelle
            wäre hier der falsche Ton — verglichen wird EIN Wert je Anbieter,
            und der Balken macht den Abstand ohne Kopfrechnen sichtbar. */}
        <ul className="mt-6 flex flex-col gap-3">
          {WETTBEWERB.map((w) => (
            <li
              key={w.name}
              className="grid items-center gap-x-6 gap-y-3 rounded-2xl border border-border bg-card px-6 py-5 shadow-card sm:grid-cols-[10rem_1fr_9rem]"
            >
              <div>
                <p className="font-display text-base font-semibold">{w.name}</p>
                <p className="text-sm text-muted-foreground">{w.tarif}</p>
              </div>

              <div>
                {w.preis20 !== null ? (
                  <span
                    aria-hidden
                    className="block h-2.5 rounded-full bg-muted"
                  >
                    <span
                      className="block h-full rounded-full bg-foreground/25"
                      style={{ width: `${(w.preis20 / hoechster) * 100}%` }}
                    />
                  </span>
                ) : null}
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {w.rechnung} · {w.quelle}
                </p>
              </div>

              <p className="text-left font-semibold tabular-nums sm:text-right">
                {w.preis20 === null
                  ? t("ohnePreis")
                  : `${formatCurrency(w.preis20, "EUR", locale)}${t("proMonat")}`}
              </p>
            </li>
          ))}
        </ul>

        <p className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
          <Icon icon="ph:info" className="mt-0.5 size-4 shrink-0" />
          {t("fussnote", {
            stand: new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(
              new Date(WETTBEWERB_STAND),
            ),
          })}
        </p>
      </div>
    </section>
  );
}
