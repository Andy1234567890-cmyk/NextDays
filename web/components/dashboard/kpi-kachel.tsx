"use client";

// Die umschaltbaren Kacheln der Startseite. Jede trägt statt eines festen
// „Letzte 30 Tage"-Abzeichens einen Zeitraum-Selektor und lädt beim Wechsel
// NUR ihren eigenen Wert nach — nicht die ganze Seite.
//
// Warum Client-Komponenten: die Startseite rendert serverseitig, ein Selektor
// braucht aber Zustand. Nur diese Kacheln sind deshalb Client, der Rest der
// Seite bleibt Server-gerendert.
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";

import { Card, CardContent } from "@nextdays/ui/card";
import { formatCurrency } from "@/lib/currency";
import type { NachrichtenKennzahl } from "@/lib/inbox";
import { getNachrichtenKennzahlen } from "@/lib/inbox";
import type {
  DashboardKpi,
  DashboardKpiMetrik,
  Zeitraum,
} from "@/lib/reservations";
import { getDashboardKpi } from "@/lib/reservations";

// Die Menge stammt aus dem Backend (`core.zeitraum.ZEITRAEUME`). Hier steht
// nur die Reihenfolge für die Auswahlliste — ein hier erfundener fünfter Wert
// würde vom Server mit 422 abgewiesen.
const ZEITRAEUME: Zeitraum[] = ["7d", "30d", "3m", "12m"];

export const STANDARD_ZEITRAUM: Zeitraum = "30d";

function ChangeBadge({ change }: { change: number | null }) {
  if (change === null) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }
  const up = change >= 0;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-sm font-semibold ${
        up ? "text-emerald-600" : "text-red-600"
      }`}
    >
      {up ? "+" : ""}
      {change} %
      <Icon
        icon={up ? "ph:trend-up" : "ph:trend-down"}
        className="size-4"
        aria-hidden
      />
    </span>
  );
}

/**
 * Der Zeitraum-Selektor an der Stelle, an der vorher das Abzeichen stand.
 *
 * Bewusst ein natives `<select>` im Pill-Kleid und kein nachgebautes Menü: es
 * ist per Tastatur bedienbar, öffnet auf dem Telefon die System-Auswahl und
 * braucht kein zusätzliches Overlay in einer Karte, die ohnehin scrollt.
 */
export function ZeitraumSelektor({
  wert,
  onWechsel,
  laedt,
  label,
}: {
  wert: Zeitraum;
  onWechsel: (neu: Zeitraum) => void;
  laedt: boolean;
  label: string;
}) {
  const t = useTranslations("reservations");
  const id = useId();
  return (
    <span className="relative shrink-0">
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        value={wert}
        disabled={laedt}
        onChange={(e) => onWechsel(e.target.value as Zeitraum)}
        className="cursor-pointer appearance-none rounded-full bg-secondary py-1 pl-3 pr-7 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-wait disabled:opacity-60"
      >
        {ZEITRAEUME.map((z) => (
          <option key={z} value={z}>
            {t(`dashboard.zeitraum.${z}`)}
          </option>
        ))}
      </select>
      <Icon
        icon={laedt ? "ph:circle-notch" : "ph:caret-down"}
        className={`pointer-events-none absolute right-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground ${
          laedt ? "animate-spin" : ""
        }`}
        aria-hidden
      />
    </span>
  );
}

// Gemeinsames Kartengerüst beider Kachelarten: Kopf mit Icon, Titel und
// Selektor, darunter Wert, Beschriftung und Veränderung.
function KachelRahmen({
  icon,
  title,
  zeitraum,
  onWechsel,
  laedt,
  display,
  unitLabel,
  change,
  fehler,
}: {
  icon: string;
  title: string;
  zeitraum: Zeitraum;
  onWechsel: (neu: Zeitraum) => void;
  laedt: boolean;
  display: string;
  unitLabel: string;
  change: number | null;
  fehler: string | null;
}) {
  const t = useTranslations("reservations");
  return (
    <Card>
      <CardContent className="flex h-full flex-col gap-4 p-6">
        <div className="flex items-start justify-between gap-3">
          {/* `min-w-0` + `truncate`: ohne beides bricht der Titel zwischen
              Icon und Selektor um („Ø gesendet" stand zweizeilig) und zieht
              die Kopfzeile in die Höhe — die Karten einer Reihe waren dann
              unterschiedlich hoch. Gekürzt wird sichtbar mit „…", der volle
              Text steht im `title`-Attribut. */}
          <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
            <Icon icon={icon} className="size-5 shrink-0" />
            <h3
              title={title}
              className="truncate whitespace-nowrap font-semibold text-foreground"
            >
              {title}
            </h3>
          </div>
          <ZeitraumSelektor
            wert={zeitraum}
            onWechsel={onWechsel}
            laedt={laedt}
            label={t("dashboard.zeitraum.label", { kachel: title })}
          />
        </div>
        <div className="mt-auto flex items-end justify-between gap-3">
          <div className="min-w-0">
            {/* Kein `truncate`: ein Betrag mit Tausendern und Währungskürzel
                („246.307,02 DKK") lief in der Vierer-Reihe sonst ins „…" —
                eine abgeschnittene Zahl ist keine Zahl. */}
            <p className="font-display text-3xl font-extrabold leading-none tabular-nums">
              {display}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{unitLabel}</p>
          </div>
          <ChangeBadge change={change} />
        </div>
        {/* Ein fehlgeschlagenes Nachladen wird GESAGT. Stillschweigend den
            alten Wert unter dem neuen Zeitraum stehen zu lassen wäre die
            plausible Falschaussage: die Kachel behauptete „12 Monate" und
            zeigte 30 Tage (Wurzel 5). */}
        {fehler ? (
          <p className="text-xs text-destructive">{fehler}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

/**
 * Eine Reservierungs-Kennzahl (Check-ins, Umsatz, Ø Umsatz, Bestätigt).
 *
 * Der Startwert kommt aus der Server-Antwort der Seite — die Kachel steht
 * also sofort da und lädt erst beim Umschalten nach.
 */
export function KpiKachel({
  icon,
  title,
  unitLabel,
  metrik,
  kpi,
  currency,
  istBetrag,
}: {
  icon: string;
  title: string;
  unitLabel: string;
  metrik: DashboardKpiMetrik;
  kpi: DashboardKpi;
  currency: string;
  // Betragskacheln werden über `formatCurrency` gerendert, Zählkacheln nicht.
  // Die Entscheidung gehört nicht in die Kachel: `formatCurrency` auf eine
  // Anzahl anzuwenden hieße, „54" ein Währungskürzel anzuhängen.
  istBetrag: boolean;
}) {
  const t = useTranslations("reservations");
  const locale = useLocale();
  const [zeitraum, setZeitraum] = useState<Zeitraum>(STANDARD_ZEITRAUM);
  const [wert, setWert] = useState<DashboardKpi | null>(kpi);
  const [waehrung, setWaehrung] = useState(currency);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laedt, starten] = useTransition();

  const wechsel = (neu: Zeitraum) => {
    setZeitraum(neu);
    starten(async () => {
      const antwort = await getDashboardKpi(metrik, neu);
      if (!antwort.ok) {
        setFehler(antwort.error);
        setWert(null);
        return;
      }
      setFehler(null);
      setWert(antwort.data.kpi);
      setWaehrung(antwort.data.currency);
    });
  };

  const display =
    wert === null
      ? "—"
      : istBetrag
        ? formatCurrency(wert.value, waehrung)
        : new Intl.NumberFormat(locale).format(wert.value);

  return (
    <KachelRahmen
      icon={icon}
      title={title}
      zeitraum={zeitraum}
      onWechsel={wechsel}
      laedt={laedt}
      display={display}
      unitLabel={unitLabel}
      change={wert?.change_pct ?? null}
      fehler={fehler ? t("dashboard.zeitraum.ladefehler") : null}
    />
  );
}

/** Welcher der drei Nachrichten-Werte gezeigt wird. */
export type NachrichtenMetrik = "gesendet" | "empfangen" | "automation";

/**
 * Eine Nachrichten-Kennzahl — entweder die Summe oder ihr Tagesschnitt.
 *
 * Beide Varianten hängen an DERSELBEN Antwort (`/inbox/kennzahlen` liefert
 * Wert und Schnitt zusammen); getrennte Kacheln bekommen sie, weil sie
 * getrennt umschaltbar sein sollen.
 */
export function NachrichtenKachel({
  icon,
  title,
  unitLabel,
  metrik,
  variante,
  kennzahl,
}: {
  icon: string;
  title: string;
  unitLabel: string;
  metrik: NachrichtenMetrik;
  variante: "summe" | "schnitt";
  kennzahl: NachrichtenKennzahl;
}) {
  const t = useTranslations("reservations");
  const locale = useLocale();
  const [zeitraum, setZeitraum] = useState<Zeitraum>(STANDARD_ZEITRAUM);
  const [wert, setWert] = useState<NachrichtenKennzahl | null>(kennzahl);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laedt, starten] = useTransition();

  const wechsel = (neu: Zeitraum) => {
    setZeitraum(neu);
    starten(async () => {
      const antwort = await getNachrichtenKennzahlen(neu);
      if (!antwort.ok) {
        setFehler(antwort.error);
        setWert(null);
        return;
      }
      setFehler(null);
      setWert(antwort.data[metrik]);
    });
  };

  const display =
    wert === null
      ? "—"
      : variante === "summe"
        ? new Intl.NumberFormat(locale).format(wert.value)
        : // Tagesschnitte tragen eine Nachkommastelle (das Backend rundet
          // darauf) — mehr Stellen wären Genauigkeit, die die Daten nicht
          // hergeben.
          new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(
            wert.per_day,
          );

  return (
    <KachelRahmen
      icon={icon}
      title={title}
      zeitraum={zeitraum}
      onWechsel={wechsel}
      laedt={laedt}
      display={display}
      unitLabel={unitLabel}
      // Auch der Tagesschnitt trägt die Rate: sie ist rechnerisch dieselbe wie
      // die der Summe daneben (gleiche Tageszahl im Nenner). Sie hier
      // wegzulassen sah nicht nach Absicht aus, sondern nach fehlendem Wert —
      // drei Kacheln in einer Reihe zeigten „—".
      change={wert?.change_pct ?? null}
      fehler={fehler ? t("dashboard.zeitraum.ladefehler") : null}
    />
  );
}
