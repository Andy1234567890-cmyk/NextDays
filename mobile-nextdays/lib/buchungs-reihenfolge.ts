// In welcher Reihenfolge eine Buchungsliste gelesen wird.
//
// ANLASS (23.08.2026, live gemeldet): Die Liste öffnete mit „19.–22. Aug 2027".
// Sortiert wurde absteigend nach `check_in` — damit stand oben, was am
// WEITESTEN WEG ist. Bei 546 Buchungen von 2024 bis Aug 2027 musste man an 40
// Buchungen des Folgejahres vorbeiscrollen, um zu sehen, wer diese Woche kommt.
// Der Betrieb liest diese Liste, um zu arbeiten; oben gehört hin, was ansteht.
//
// Der Umschalter hieß dazu „Neueste zuerst" — eine Falschaussage: `check_in` ist
// der ANREISETAG, nicht der Zeitpunkt der Buchung. „Neu" hieß dort „reist spät
// an". Wer wirklich die zuletzt eingegangenen Buchungen sehen will, braucht den
// Buchungszeitpunkt aus der QUELLE (`booked_at`, Wurzel 5b) — und der ist etwas
// anderes als der Anreisetag.
//
// Deshalb zwei benannte Reihenfolgen statt eines Richtungs-Schalters:
//   anstehend  Was kommt (und wer ist im Haus), nächste Anreise zuerst;
//              Vergangenes darunter, das Jüngste davon oben.
//   gebucht    Wann der Gast gebucht hat, zuletzt gebucht zuerst.
// Es wird nichts ausgeblendet — beide Reihenfolgen zeigen dieselbe Menge.

/** Was zum Sortieren gebraucht wird — bewusst schmal, damit die Funktion mit
 *  jeder Buchungsform arbeitet (Liste, Panel, Test). */
export type Sortierbar = {
  check_in: string;
  check_out: string;
  /** Buchungszeitpunkt aus der QUELLE. Fehlt er, wird NICHT auf `created_at`
   *  ausgewichen — unsere Uhr ist nicht der Zeitpunkt der fremden Handlung
   *  (Wurzel 5b). Die Zeile rutscht dann ans Ende. */
  booked_at: string | null;
};

export type Reihenfolge = "anstehend" | "gebucht";

export const REIHENFOLGE_LABEL: Record<Reihenfolge, string> = {
  anstehend: "Anstehend zuerst",
  gebucht: "Zuletzt gebucht zuerst",
};

/**
 * „Anstehend" heißt: noch nicht abgereist. Eine Buchung, die heute im Haus ist
 * (angereist gestern, Abreise morgen), gehört nach oben und nicht in die
 * Vergangenheit — deshalb entscheidet `check_out`, nicht `check_in`.
 * Der Abreisetag selbst zählt noch dazu: an diesem Tag ist Arbeit.
 */
export function istAnstehend(b: Sortierbar, heuteIso: string): boolean {
  return b.check_out >= heuteIso;
}

/**
 * Die Liste in der gewählten Reihenfolge — eine neue Liste, die Eingabe bleibt
 * unberührt.
 *
 * `heuteIso` ist ein Parameter und kein `new Date()` hier: dieselbe Liste muss
 * sich testen lassen, ohne die Systemzeit zu verbiegen (Muster wie
 * `aufgabeTon`).
 */
export function sortiereBuchungen<T extends Sortierbar>(
  liste: readonly T[],
  reihenfolge: Reihenfolge,
  heuteIso: string,
): T[] {
  const kopie = [...liste];
  if (reihenfolge === "gebucht") {
    return kopie.sort((a, b) => {
      // Ohne Quell-Zeitstempel ans Ende — nicht an den Anfang und nicht mit
      // einem erfundenen Datum dazwischen (Wurzel 4).
      if (!a.booked_at && !b.booked_at) return a.check_in.localeCompare(b.check_in);
      if (!a.booked_at) return 1;
      if (!b.booked_at) return -1;
      return b.booked_at.localeCompare(a.booked_at) || a.check_in.localeCompare(b.check_in);
    });
  }
  return kopie.sort((a, b) => {
    const aAn = istAnstehend(a, heuteIso);
    const bAn = istAnstehend(b, heuteIso);
    if (aAn !== bAn) return aAn ? -1 : 1;
    // Anstehendes aufsteigend (die nächste Anreise oben), Vergangenes
    // absteigend (die jüngste Vergangenheit oben) — in beiden Fällen ist das
    // Nächstliegende zuerst, gemessen von heute aus.
    return aAn
      ? a.check_in.localeCompare(b.check_in)
      : b.check_in.localeCompare(a.check_in);
  });
}
