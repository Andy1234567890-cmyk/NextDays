"use client";

// Eine Regelsatz-Karte im rechten Panel (Vorbild: Airbnbs Karten unter „Lege
// deine saisonalen Preise und Verfügbarkeiten fest").
//
// Aufbau dort, Zeile für Zeile nachgebaut:
//   ┌──────────────────────────────────────────┐
//   │ A - sæson +30%                           │  ← Name des Regelsatzes
//   │ 30 % nächtliche Preiserhöhung            │  ← was die Nacht kostet
//   │ 10 % Rabatt · Mindestens 2 Wochen        │  ← was davon abgeht
//   │ Mindestens 7 Nächte                      │  ← Aufenthaltsregel
//   │ +1 weitere Regeln                        │  ← Rest aufklappen
//   │ Bearbeiten                               │  ← öffnet den Editor
//   └──────────────────────────────────────────┘
//
// Bei uns speisen ZWEI Quellen einen Regelsatz, und beide gehören dazu:
//   • die SAISON (`/calendar/seasons`) — Aufschlag in Prozent oder fester
//     Nachtpreis, plus Farbe und Zeiträume,
//   • die RABATTE des Objekts (`/pricing/discounts/{id}`) — Längenrabatt,
//     Frühbucher, Last-Minute, Aktionszeitraum.
// Eine Karte, die nur den Saison-Prozentsatz zeigte, verschwiege die Hälfte
// dessen, was den Tagespreis bestimmt.
//
// Seit 0572 trägt die Saison AUCH die Aufenthaltsregeln des Satzes
// (Mindest-/Höchstaufenthalt, gesperrte An-/Abreisetage) und die Rabatte
// hängen mit `season_id` an ihr. Die Karte zeigt deshalb alle drei Arten von
// Regeln, und „Bearbeiten" öffnet den Editor, der sie gemeinsam speichert.
//
// Der zweite Knopf des Vorbilds heißt dort „Speichern" und heißt hier
// „Anwenden" — am 06.09.2026 gemessen statt geraten: die React-Props der Karte
// sind `onEdit` und `onApply`, daneben stehen die Einführungshinweise
// `showApplyRuleSetsTooltip`/`hasDismissedRuleSetBulkApplyNux`, und Schritt 3
// des Regel-Dialogs sagt wörtlich „Wähle die Reisedaten und Inserate, für die
// die Regel gelten soll, in deinem Kalender aus". Der Knopf speichert also
// nichts, er WENDET den Satz auf die Auswahl an. „Speichern" wäre bei uns eine
// Falschbeschriftung derselben Handlung.
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";

import { formatCurrency } from "@nextdays/currency";

import type { Rabatt, Saison } from "@/lib/kalender";

/** Wie viele Regelzeilen offen stehen, bevor „+N weitere Regeln" einklappt. */
const SICHTBAR = 2;

type Uebersetzer = ReturnType<typeof useTranslations<"kalender">>;

/**
 * Eine Rabattregel als Satz — „10 % Rabatt · Mindestens 2 Wochen".
 *
 * Die Bedingung wird benannt, wie der Gastgeber sie kennt: 7 Nächte sind
 * „wöchentlich", 28 „monatlich", ein durch 30 teilbarer Vorlauf sind Monate.
 * Ein roher Wert („min_nights 28") wäre richtig und trotzdem unlesbar.
 */
export function rabattSatz(
  r: Rabatt,
  t: Uebersetzer,
  waehrung: string | null,
  locale: string,
): string {
  const wert =
    r.discount_kind === "fixed" && r.discount_amount != null
      ? formatCurrency(r.discount_amount, waehrung)
      : `${(r.discount_bps / 100).toLocaleString(locale, {
          maximumFractionDigits: 2,
        })} %`;
  const kopf = t("regelRabatt", { wert });

  let bedingung: string;
  if (r.discount_type === "length_of_stay") {
    const n = r.min_nights ?? 0;
    bedingung =
      n === 7
        ? t("regelWoechentlich")
        : n === 28 || n === 30
          ? t("regelMonatlich")
          : n % 7 === 0
            ? t("regelMindestensWochen", { wochen: n / 7 })
            : t("regelMindestensNaechte", { naechte: n });
  } else if (r.discount_type === "early_booker") {
    const tage = r.lead_min_days ?? 0;
    bedingung =
      tage % 30 === 0 && tage >= 30
        ? t("regelImVorausMonate", { monate: tage / 30 })
        : t("regelImVorausTage", { tage });
  } else if (r.discount_type === "last_minute") {
    bedingung = t("regelLastMinute", { tage: r.lead_max_days ?? 0 });
  } else if (r.stay_ranges.length > 0) {
    const z = r.stay_ranges[0];
    bedingung = t("regelZeitraum", {
      von: z.from,
      bis: z.to,
      weitere: r.stay_ranges.length - 1,
    });
  } else {
    // Eigener Name der Aktion, sonst der rohe Typ — nie ein erfundener Text.
    bedingung = r.name[locale] || r.name.de || r.discount_type;
  }
  return `${kopf} · ${bedingung}`;
}

/** Die Aufenthaltsregeln des Satzes als Zeilen — wie im Vorbild aufgezählt. */
function verfuegbarkeitsZeilen(s: Saison, t: Uebersetzer): string[] {
  const aus: string[] = [];
  if (s.min_stay != null) aus.push(t("regelMindestNaechte", { naechte: s.min_stay }));
  if (s.max_stay != null) aus.push(t("regelHoechstNaechte", { naechte: s.max_stay }));
  if (s.closed_arrival_weekdays.length > 0) {
    aus.push(
      t("regelKeineAnreise", {
        tage: s.closed_arrival_weekdays.map((d) => t(`wochentag_${d}`)).join(", "),
      }),
    );
  }
  if (s.closed_departure_weekdays.length > 0) {
    aus.push(
      t("regelKeineAbreise", {
        tage: s.closed_departure_weekdays.map((d) => t(`wochentag_${d}`)).join(", "),
      }),
    );
  }
  // Mindestaufenthalt je Anreisetag (0576): jeder abweichende Tag bekommt eine
  // eigene Zeile. Sie nur zu zählen („3 Sonderregeln") verschwiege genau das,
  // wonach der Gastgeber hier sucht.
  for (const [tag, naechte] of Object.entries(s.min_stay_by_weekday ?? {})) {
    aus.push(
      t("regelMinJeAnreisetag", {
        tag: t(`wochentag_${Number(tag)}`),
        naechte,
      }),
    );
  }
  return aus;
}

/** Was die Saison mit dem Nachtpreis macht — die erste Zeile der Karte. */
function saisonSatz(
  s: Saison,
  t: Uebersetzer,
  waehrung: string | null,
): string {
  if (s.mode === "fixed") {
    return t("regelFesterPreis", { betrag: formatCurrency(s.amount, waehrung) });
  }
  return s.amount >= 0
    ? t("regelPreiserhoehung", { prozent: s.amount })
    : t("regelPreissenkung", { prozent: Math.abs(s.amount) });
}

export function RegelsatzKarte({
  saison,
  rabatte,
  objektTitel,
  waehrung,
  onBearbeiten,
  onAnwenden,
}: {
  /** Null = Karte ohne Saison: nur die Rabatte des Objekts. */
  saison: Saison | null;
  rabatte: Rabatt[];
  objektTitel: string;
  waehrung: string | null;
  /** Öffnet den Regelsatz-Editor für diese Karte. */
  onBearbeiten: () => void;
  /** Merkt den Satz zum Anwenden vor; die nächste Auswahl bekommt ihn. */
  onAnwenden: () => void;
}) {
  const t = useTranslations("kalender");
  const locale = useLocale();
  const [offen, setOffen] = useState(false);

  const objektId = saison?.property_id ?? rabatte[0]?.property_id ?? "";
  const zeilen = [
    ...(saison ? [saisonSatz(saison, t, waehrung)] : []),
    ...rabatte.map((r) => rabattSatz(r, t, waehrung, locale)),
    ...(saison ? verfuegbarkeitsZeilen(saison, t) : []),
  ];
  const sichtbare = offen ? zeilen : zeilen.slice(0, SICHTBAR);
  const rest = zeilen.length - sichtbare.length;
  return (
    // Maße vom Vorbild abgenommen (06.09.2026): Karte 305 × 160, Radius 12 px,
    // Innenabstand 16/16/8, Rahmen 1 px #ddd, kein Schatten.
    <li className="rounded-xl border border-border px-4 pb-2 pt-4">
      <div className="flex items-start gap-4">
        {/* Der Farbfleck ist dort NICHT die volle Saisonfarbe, sondern
            dieselbe Farbe mit 10 % Deckkraft (24 × 24, Radius 4). Voll
            gesättigt zöge er das Auge von der Regel weg, die daneben steht. */}
        <span
          aria-hidden="true"
          style={saison ? { backgroundColor: `${saison.color}1a` } : undefined}
          className={`mt-0.5 size-6 shrink-0 rounded ${saison ? "" : "bg-muted"}`}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">
            {saison ? saison.name : t("regelsatzRabatte")}
          </p>
          <ul className="mt-1 space-y-0.5">
            {sichtbare.map((z) => (
              <li key={z} className="text-sm text-muted-foreground">
                {z}
              </li>
            ))}
          </ul>
          {rest > 0 && (
            <button
              type="button"
              onClick={() => setOffen(true)}
              className="mt-1 text-xs font-medium underline underline-offset-4 hover:opacity-70"
            >
              {rest === 1
                ? t("regelnEineWeitere")
                : t("regelnWeitere", { anzahl: rest })}
            </button>
          )}
          {offen && zeilen.length > SICHTBAR && (
            <button
              type="button"
              onClick={() => setOffen(false)}
              className="mt-1 block text-sm font-medium underline underline-offset-4 hover:opacity-70"
            >
              {t("regelnWeniger")}
            </button>
          )}
          <p className="mt-1 truncate text-sm text-muted-foreground/80">
            {objektTitel}
            {saison
              ? ` · ${
                  saison.assignments.length === 1
                    ? t("saisonEinZeitraum")
                    : t("saisonZeitraeume", { anzahl: saison.assignments.length })
                }`
              : ""}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-4">
        {saison ? (
          <>
            <button
              type="button"
              onClick={onAnwenden}
              className="text-sm font-medium underline underline-offset-4 hover:opacity-70"
            >
              {t("regelsatzAnwenden")}
            </button>
            <button
              type="button"
              onClick={onBearbeiten}
              className="text-sm font-medium underline underline-offset-4 hover:opacity-70"
            >
              {t("bearbeiten")}
            </button>
          </>
        ) : (
          // Ein Satz ohne Saison ist eine reine Rabatt-Sammlung des Objekts;
          // bearbeitet wird sie dort, wo sie entstanden ist.
          <Link
            href={`/objekte/${objektId}?bereich=preise`}
            className="text-sm font-medium underline underline-offset-4 hover:opacity-70"
          >
            {t("bearbeiten")}
          </Link>
        )}
        {rabatte.some((r) => !r.active) && (
          <span className="ms-auto flex items-center gap-1 text-xs text-muted-foreground">
            <Icon icon="ph:pause-circle" className="size-3.5" aria-hidden="true" />
            {t("regelPausiert")}
          </span>
        )}
      </div>
    </li>
  );
}
