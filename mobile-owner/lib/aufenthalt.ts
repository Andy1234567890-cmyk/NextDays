// Logik des Eigentümer-Aufenthalts („Aufenthalt buchen", Vorlage Hostaway
// „Book your stay"): Zeitraum-Auswahl im Monatsblatt, freie Nächte,
// Umrechnung auf den Sperrantrag.
//
// ZWEI DATUMS-WELTEN, EINE REGEL: Die Oberfläche denkt in Check-in und
// Check-out („22.–26. August, 4 Nächte", Abreisetag frei). Der Sperrantrag
// (`block_requests`) denkt INKLUSIV („vom 1. bis zum 5." belegt beide Tage).
// Die Umrechnung steht hier EINMAL (`alsSperrantrag`): end_date ist der Tag
// vor der Abreise. Wer den Abreisetag mitsperrt, nimmt der nächsten Buchung
// die Anreise weg — die Nacht davor ist frei, der Tag selbst aber gesperrt.
import type { PortalCalendarDay } from "@/lib/ownerPortal";
import { naechte, tagPlus } from "@/lib/zeitraum";

export type Bereich = { von: string; bis: string | null };

/**
 * Nächster Zustand nach Tipp auf einen Tag.
 * - nichts gewählt → Anreise
 * - Anreise gewählt, Tipp danach → Abreise
 * - Tipp davor oder auf denselben Tag → neue Anreise
 * - beides gewählt → neue Anreise
 */
export function bereichWaehlen(bereich: Bereich | null, tag: string): Bereich {
  if (!bereich || bereich.bis !== null) return { von: tag, bis: null };
  if (tag <= bereich.von) return { von: tag, bis: null };
  return { von: bereich.von, bis: tag };
}

/** Ist eine Nacht (Tag des Kalenders) belegbar? Nur `open` ist frei. */
export function nachtFrei(tag: PortalCalendarDay | undefined): boolean {
  if (!tag) return true; // außerhalb der geladenen Monate: nicht als belegt behaupten
  return tag.status === "open" && tag.units_booked < tag.units_total;
}

/**
 * Sind alle Nächte von Check-in bis VOR Check-out frei? Prüft die Nächte
 * `von` … `bis − 1`; der Abreisetag selbst darf belegt sein (jemand reist
 * dort an).
 */
export function bereichFrei(
  tage: ReadonlyMap<string, PortalCalendarDay>,
  von: string,
  bis: string,
): boolean {
  let cur = von;
  while (cur < bis) {
    if (!nachtFrei(tage.get(cur))) return false;
    cur = tagPlus(cur, 1);
  }
  return true;
}

/**
 * Darf dieser Tag als ABREISE gewählt werden, wenn `von` die Anreise ist?
 * Ja, wenn alle Nächte dazwischen frei sind — der Abreisetag selbst muss es
 * nicht sein.
 */
export function alsAbreiseWaehlbar(
  tage: ReadonlyMap<string, PortalCalendarDay>,
  von: string,
  tag: string,
): boolean {
  return tag > von && bereichFrei(tage, von, tag);
}

/** Sperrantrag aus Check-in/Check-out: end_date inklusiv = Tag vor Abreise. */
export function alsSperrantrag(von: string, bis: string): { start_date: string; end_date: string } {
  return { start_date: von, end_date: tagPlus(bis, -1) };
}

/** Check-out aus einem gespeicherten Sperrantrag (inklusives end_date). */
export function checkoutAus(endDateInklusiv: string): string {
  return tagPlus(endDateInklusiv, 1);
}

/** Nächte eines Aufenthalts (Check-in → Check-out). */
export function aufenthaltNaechte(von: string, bis: string): number {
  return naechte(von, bis);
}

/** „2 Erwachsene" / „1 Erwachsener" — null → nicht angegeben. */
export function gaesteText(n: number | null): string {
  if (n === null) return "Nicht angegeben";
  return n === 1 ? "1 Erwachsener" : `${n} Erwachsene`;
}

/** Statusname eines Sperrantrags. Unbekannter Status bleibt der rohe Wert (Wurzel 4). */
export function antragStatusName(status: string): string {
  const NAMEN: Record<string, string> = {
    pending: "Angefragt",
    approved: "Bestätigt",
    rejected: "Abgelehnt",
    withdrawn: "Zurückgezogen",
    cancelled: "Storniert",
  };
  return NAMEN[status] ?? status;
}

/** Bevorstehend = Check-out liegt noch nicht hinter heute. */
export function istBevorstehend(endDateInklusiv: string, heuteIso: string): boolean {
  return checkoutAus(endDateInklusiv) > heuteIso;
}
