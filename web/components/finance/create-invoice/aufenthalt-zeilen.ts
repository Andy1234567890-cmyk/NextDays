// Aufenthalt JE POSITION (0702) — pure Helfer, keine React-Abhängigkeit.
//
// Seit 0698 kennt der Belegkopf EINEN Aufenthalt; eine Rechnung über zwei
// Zimmer oder zwei Zeiträume war damit nicht darstellbar. Ab hier trägt jede
// Übernachtungszeile ihr eigenes Objekt und ihren eigenen Zeitraum; der Kopf
// bleibt die Vorbelegung und gilt weiter für Zeilen ohne eigenen Zeitraum.

import { naechteAus } from '@/lib/positions-basis';
import type { QuoteItem } from '@/services/quoteService';

/**
 * Nächte je Zeile: eigener Zeitraum vor dem der Übernachtung, an der die Zeile
 * hängt, vor dem Belegkopf. So folgt eine Zusatzleistung „je Nacht" den Nächten
 * IHRER Übernachtung, nicht denen des Kopfes.
 */
export function naechteJeZeile(
  items: readonly QuoteItem[],
  kopfNaechte: number,
): Map<string, number> {
  const eigen = new Map<string, number>();
  for (const it of items) {
    const n = naechteAus(it.checkIn, it.checkOut);
    if (n > 0) eigen.set(it.id, n);
  }
  const ergebnis = new Map<string, number>();
  for (const it of items) {
    const vomEltern = it.parentItemId ? eigen.get(it.parentItemId) : undefined;
    ergebnis.set(it.id, eigen.get(it.id) ?? vomEltern ?? kopfNaechte);
  }
  return ergebnis;
}

/**
 * Was einer Übernachtungszeile fehlt. Kein Ersatzwert (Wurzel 4) — die
 * Oberfläche markiert das Feld rot, wie sie es beim Steuersatz tut.
 */
export function aufenthaltFehlt(item: QuoteItem): { objekt: boolean; zeitraum: boolean } {
  return {
    objekt: !item.propertyId,
    zeitraum: naechteAus(item.checkIn, item.checkOut) <= 0,
  };
}

/**
 * Anzeige-Zustand einer Aufenthaltszeile. Rot wird nur, was wirklich falsch
 * ist: fehlendes Objekt/Zeitraum erst, wenn die Zeile schon einen Preis trägt
 * (also echt ist), ein Zeitraum sofort, wenn Abreise ≤ Anreise.
 */
export function aufenthaltZustand(item: QuoteItem): {
  naechte: number;
  verdreht: boolean;
  objektFehlt: boolean;
  zeitraumFehlt: boolean;
} {
  const fehlt = aufenthaltFehlt(item);
  const naechte = naechteAus(item.checkIn, item.checkOut);
  const verdreht = !!item.checkIn && !!item.checkOut && naechte <= 0;
  const mahnen = item.unitPrice !== 0 || verdreht;
  return {
    naechte,
    verdreht,
    objektFehlt: mahnen && fehlt.objekt,
    zeitraumFehlt: mahnen && fehlt.zeitraum,
  };
}
