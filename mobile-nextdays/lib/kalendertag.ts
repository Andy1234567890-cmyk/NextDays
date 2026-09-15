// Kalendertage der App — EINE Quelle für Monatskürzel, Kurzdatum und Nächte.
//
// Heißt bewusst NICHT `datum.ts`: die Schwester-App hat eine gleichnamige Datei
// mit anderem Inhalt (Gast-Eingaben, LOKALE Zeitrechnung, ausgeschriebene
// Monate). Zwei verschiedene `lib/datum.ts` in zwei Apps sind die Vorlage für
// eine falsche Quer-Kopie — der andere Name macht den Unterschied sichtbar.
//
// Vorher stand dieselbe Monatsliste in `HostDashboard`, `HostReservations` und
// `ReservationDetail`, und `naechte` zweimal. Mit der Dashboard-Erweiterung wäre
// daraus die vierte Kopie geworden — und Kopien driften: ein Screen zeigt
// „Mär", der nächste „Mrz", und die Nächte-Rechnung eines Screens rutscht um
// einen Tag, während die anderen richtig bleiben.
//
// Alle Werte hier sind Kalendertage OHNE Zeitzone (`YYYY-MM-DD`), wie sie das
// Backend liefert. Deshalb wird durchweg UTC gerechnet: `new Date("2026-08-01")`
// ist bereits UTC-Mitternacht, jede lokale Umrechnung verschöbe den Tag.

export const MONATE = [
  "Jan",
  "Feb",
  "Mär",
  "Apr",
  "Mai",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Okt",
  "Nov",
  "Dez",
];

export const WOCHENTAGE = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

/**
 * Kurzdatum: „14. Aug" — mit Jahr, sobald es NICHT das laufende ist
 * („14. Aug 2027").
 *
 * WARUM: Ohne Jahr liest sich eine Buchung für den 19.08.2027 wie „heute".
 * Genau so stand es in der Buchungsansicht (gemeldet am 19.08.2026 an einer
 * Buchung für 2027). Das Jahr immer zu zeigen wäre die andere Übertreibung —
 * bei den 95 % Buchungen des laufenden Jahres ist es Rauschen. Dieselbe Regel
 * benutzen Kalender und Mailprogramme.
 *
 * `heuteJahr` ist ein Parameter, damit es testbar ist, ohne die Systemzeit zu
 * verbiegen; im Betrieb bleibt es beim laufenden Jahr.
 */
export function tagKurz(iso: string, heuteJahr = new Date().getFullYear()): string {
  const [y, m, d] = iso.split("-");
  const jahr = Number(y);
  const basis = `${Number(d)}. ${MONATE[Number(m) - 1]}`;
  return Number.isFinite(jahr) && jahr !== heuteJahr ? `${basis} ${jahr}` : basis;
}

/** Kurzdatum, oder null wenn der Tag fehlt — für nullable Datumsfelder. */
export function tagKurzOderNull(iso: string | null): string | null {
  return iso ? tagKurz(iso) : null;
}

/** Wochentag, Tag und Monatskürzel eines Kalendertags. */
export function tagTeile(iso: string): {
  wochentag: string;
  tag: string;
  monat: string;
} {
  const [y, m, d] = iso.split("-").map(Number);
  const wt = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return { wochentag: WOCHENTAGE[wt], tag: String(d), monat: MONATE[m - 1] };
}

/** Nächte zwischen An- und Abreisetag. */
export function naechte(inIso: string, outIso: string): number {
  return Math.max(0, Math.round((Date.parse(outIso) - Date.parse(inIso)) / 86_400_000));
}

/** Der ausgeschriebene heutige Tag für die Kopfzeile: „Mittwoch, 19. August". */
export function heuteLabel(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/**
 * Heute als Kalendertag (YYYY-MM-DD) in LOKALER Zeit.
 *
 * Bewusst nicht `toISOString().slice(0,10)`: das rechnet nach UTC um und liefert
 * abends in Mitteleuropa den Vortag — der Check-out wäre dann einen Tag zu früh
 * „noch nicht erlaubt".
 */
export function heuteIso(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const t = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${t}`;
}

/**
 * Der BEGINN des laufenden Tages BEIM NUTZER, als ISO-Zeitpunkt.
 *
 * Gegenstück: `tagesendeIso`. Mit beiden Grenzen lässt sich „überfällig" (vor
 * dem Beginn) von „heute fällig" (dazwischen) trennen. Mit nur einer Grenze
 * landete eine drei Wochen alte Aufgabe unter „heute" — deshalb verlangt
 * `/tasks/startseite` beide oder keine.
 *
 * Auf dem GERÄT gerechnet und nicht auf dem Server: Der Kalendertag einer
 * Aufgabe hängt an der Zone des Objekts, und live haben 24 von 43 Objekten
 * keine gepflegte Zone — eine dort unterstellte Zone wäre ein erfundener Wert
 * (Wurzel 4).
 *
 * Zwilling zu `web/lib/aufgaben-konstanten.ts`.
 */
export function tagesbeginnIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/** Das ENDE des laufenden Tages beim Nutzer (= Beginn des Folgetages). */
export function tagesendeIso(): string {
  const d = new Date();
  d.setHours(24, 0, 0, 0);
  return d.toISOString();
}
