"use client";

// Arbeitsbereichs-Block des Dienstplans: die Kopfzeile eines einklappbaren
// Personen-Blocks samt der KPI-Zeilen dieses Bereichs (Gastromatic-Bauform).
//
// WELCHE ZEILEN erscheinen, entscheidet NICHT diese Komponente, sondern die
// Betriebsregel `kennzahlen_zeilen` (Vertrag §1.1) — der Betrieb sieht das,
// was er eingestellt hat, in der Reihenfolge der Regel. Zeilen, für die der
// Server keine Werte liefert (fehlendes Recht → `null`, §2.1), fallen weg;
// eine Zeile aus Nullen wäre eine erfundene Aussage (Wurzel 4).
//
// FARBEN wie in der Referenz: Besetzung rot bei Unterbesetzung, amber bei
// Überbesetzung, sonst neutral. Stundenlimit als Balken — grün innerhalb,
// gelb bei Überschreitung.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";

import { formatCurrency } from "@/lib/currency";
import type {
  KennzahlBereichTag,
  KennzahlTag,
  KennzahlZeile,
} from "@/lib/personal-planung-typen";
import type { Arbeitsbereich } from "@/lib/personal-typen";
import { stunden } from "@/lib/personal-typen";

export function BereichKopf({
  bereich,
  offen,
  onToggle,
  anzahlPersonen,
  spalten,
}: {
  /** `null` = der Sammelblock „ohne Arbeitsbereich". */
  bereich: Arbeitsbereich | null;
  offen: boolean;
  onToggle: () => void;
  anzahlPersonen: number;
  /** Anzahl der Tages-Spalten (für colSpan). */
  spalten: number;
}) {
  const t = useTranslations("personal");
  return (
    <tr className="border-b bg-secondary/50">
      <th scope="rowgroup" colSpan={spalten + 2} className="p-0 text-left">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={offen}
          className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-secondary"
        >
          <Icon icon={offen ? "ph:caret-down" : "ph:caret-right"} className="size-3.5" />
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: bereich?.farbe ?? "#64748b" }}
          />
          <span className="font-medium">{bereich?.name ?? t("dienstplan.ohneBereich")}</span>
          <span className="text-xs font-normal text-muted-foreground">
            {t("dienstplan.personenAnzahl", { anzahl: anzahlPersonen })}
          </span>
        </button>
      </th>
    </tr>
  );
}

/** Ein Balken zwischen 0 und 100 % — Farbe sagt „drin" oder „drüber". */
function Balken({ anteil, ueber }: { anteil: number; ueber: boolean }) {
  return (
    <div className="mt-0.5 h-1 rounded bg-secondary">
      <div
        className={`h-1 rounded ${ueber ? "bg-amber-500" : "bg-emerald-500"}`}
        style={{ width: `${Math.min(100, Math.max(0, Math.round(anteil * 100)))}%` }}
      />
    </div>
  );
}

export function BereichKpiZeilen({
  bereichId,
  zeilen,
  tage,
  bereichTage,
  gesamtTage,
  currency,
  heute,
  wochenende,
}: {
  bereichId: string | null;
  /** Reihenfolge und Auswahl aus der Betriebsregel `kennzahlen_zeilen`. */
  zeilen: readonly KennzahlZeile[];
  tage: string[];
  /** Kennzahlen dieses Bereichs je Tag (aus `kennzahlen.bereiche`). */
  bereichTage: Map<string, KennzahlBereichTag>;
  /** Betriebs-Kennzahlen je Tag — Quelle für Kosten/Umsatz/Quote/Budget. */
  gesamtTage: Map<string, KennzahlTag>;
  currency: string;
  heute: string;
  wochenende: (index: number) => boolean;
}) {
  const t = useTranslations("personal");
  if (!bereichId || zeilen.length === 0) return null;

  const geld = (minor: number | null | undefined) =>
    minor === null || minor === undefined ? "—" : formatCurrency(minor / 100, currency);

  const zellKlasse = (tag: string, i: number) =>
    `px-2 py-0.5 text-center text-[11px] tabular-nums ${
      tag === heute ? "bg-primary/5" : wochenende(i) ? "bg-secondary/20" : ""
    }`;

  /** Inhalt einer Zeile je Tag; `null` heisst „diese Zeile hat hier nichts". */
  function inhalt(zeile: KennzahlZeile, tag: string): React.ReactNode {
    const b = bereichTage.get(tag);
    const g = gesamtTage.get(tag);
    switch (zeile) {
      case "besetzung": {
        if (!b) return "—";
        const farbe =
          b.ist_anzahl < b.soll_anzahl
            ? "text-rose-700"
            : b.ist_anzahl > b.soll_anzahl
              ? "text-amber-700"
              : "";
        return (
          <span
            className={farbe}
            title={t("kennzahlen.besetzungTitel", {
              soll: b.soll_anzahl,
              ist: b.ist_anzahl,
            })}
          >
            {b.ist_anzahl}/{b.soll_anzahl}
          </span>
        );
      }
      case "stundenlimit": {
        if (!b || b.stundenlimit_minuten === null) return "—";
        const ueber = b.ist_minuten > b.stundenlimit_minuten;
        return (
          <span className={ueber ? "text-amber-700" : ""}>
            {stunden(b.ist_minuten)}/{stunden(b.stundenlimit_minuten)}
            <Balken
              anteil={b.stundenlimit_minuten ? b.ist_minuten / b.stundenlimit_minuten : 0}
              ueber={ueber}
            />
          </span>
        );
      }
      case "einsaetze":
        return b ? String(b.einsaetze) : "—";
      case "kosten":
        return g ? geld(g.personalkosten_ist_minor ?? g.personalkosten_plan_minor) : "—";
      case "umsatz":
        return g ? geld(g.umsatz_ist_minor ?? g.umsatz_plan_minor) : "—";
      case "produktivitaet":
        return g ? geld(g.produktivitaet_minor_je_stunde) : "—";
      case "quote":
        return g && g.personalkostenquote_pct !== null
          ? `${g.personalkostenquote_pct.toFixed(1)} %`
          : "—";
      case "budget":
        return g
          ? g.budget_minor !== null
            ? geld(g.budget_minor)
            : g.budget_stunden !== null
              ? `${g.budget_stunden} h`
              : "—"
          : "—";
      default:
        return "—";
    }
  }

  /** Eine Zeile fällt weg, wenn sie an keinem Tag einen echten Wert hat. */
  function hatWerte(zeile: KennzahlZeile): boolean {
    return tage.some((tag) => {
      const b = bereichTage.get(tag);
      const g = gesamtTage.get(tag);
      switch (zeile) {
        case "besetzung":
          return !!b;
        case "stundenlimit":
          return !!b && b.stundenlimit_minuten !== null;
        case "einsaetze":
          return !!b;
        case "kosten":
          return !!g && (g.personalkosten_ist_minor ?? g.personalkosten_plan_minor) !== null;
        case "umsatz":
          return !!g && (g.umsatz_ist_minor ?? g.umsatz_plan_minor) !== null;
        case "produktivitaet":
          return !!g && g.produktivitaet_minor_je_stunde !== null;
        case "quote":
          return !!g && g.personalkostenquote_pct !== null;
        case "budget":
          return !!g && (g.budget_minor !== null || g.budget_stunden !== null);
        default:
          return false;
      }
    });
  }

  return (
    <>
      {zeilen.filter(hatWerte).map((zeile) => (
        <tr key={zeile} className="border-b bg-secondary/20">
          <th
            scope="row"
            className="px-2 py-0.5 pl-6 text-left text-[11px] font-normal text-muted-foreground"
          >
            {t(`kennzahlen.zeile.${zeile}`)}
          </th>
          {tage.map((tag, i) => (
            <td key={tag} className={zellKlasse(tag, i)}>
              {inhalt(zeile, tag)}
            </td>
          ))}
          <td />
        </tr>
      ))}
    </>
  );
}
