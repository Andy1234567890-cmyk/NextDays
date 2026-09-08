// Abrechnungs-Liste: Titel, Jahre, Summen — reine Funktionen für
// `screens/Abrechnungen.tsx` (Vorlage: Hostaway „Statements": Jahres-Chips,
// „2026 Total" / „Accumulated Total", je Karte „Monthly Owner Statement for
// May 2026 · TOTAL PAYOUT").
//
// SUMMEN JE WÄHRUNG: Ein Betrieb kann Eigentümer in DKK und EUR abrechnen.
// Quer darüber addiert man nicht — die Summe wird deshalb je Währung
// gebildet, und die Oberfläche zeigt je Währung eine Zahl (Wurzel 4: kein
// stilles Zusammenwerfen).
import type { PortalStatement } from "@/lib/ownerPortal";
import { type Uebersetzer, ausIso, monatName, monatsEnde, isoLokal, spanneLesbar } from "@/lib/zeitraum";

/** „Abrechnung September 2026", wenn der Zeitraum genau ein Monat ist; sonst die Spanne. */
export function abrechnungTitel(
  txt: Uebersetzer,
  s: Pick<PortalStatement, "period_from" | "period_to">,
): string {
  const a = ausIso(s.period_from);
  const b = ausIso(s.period_to);
  const ganzerMonat =
    a.getDate() === 1 &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear() &&
    isoLokal(monatsEnde(b.getFullYear(), b.getMonth())) === s.period_to;
  if (ganzerMonat) {
    return txt("abr.abrechnungMonat", { monat: monatName(txt, a.getMonth()), jahr: a.getFullYear() });
  }
  return txt("abr.abrechnungSpanne", { spanne: spanneLesbar(txt, s.period_from, s.period_to) });
}

/** Jahr einer Abrechnung = Jahr des Zeitraum-Endes. */
export function abrechnungJahr(s: Pick<PortalStatement, "period_to">): number {
  return ausIso(s.period_to).getFullYear();
}

/** Alle Jahre, absteigend (neuestes zuerst). */
export function jahreAus(items: readonly Pick<PortalStatement, "period_to">[]): number[] {
  const jahre = new Set(items.map(abrechnungJahr));
  return [...jahre].sort((a, b) => b - a);
}

export type Summe = { currency: string; betrag: number };

/** Summe je Währung, Reihenfolge nach erstem Auftreten. */
export function summenJeWaehrung(
  items: readonly Pick<PortalStatement, "owner_payout" | "currency">[],
): Summe[] {
  const map = new Map<string, number>();
  for (const s of items) map.set(s.currency, (map.get(s.currency) ?? 0) + s.owner_payout);
  return [...map].map(([currency, betrag]) => ({ currency, betrag }));
}

/** Abrechnungen eines Jahres, neueste zuerst. */
export function imJahr(items: readonly PortalStatement[], jahr: number): PortalStatement[] {
  return items
    .filter((s) => abrechnungJahr(s) === jahr)
    .sort((a, b) => (a.period_to < b.period_to ? 1 : -1));
}
