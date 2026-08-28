// Die Adresse eines Beitrags in die Form bringen, die der Server annimmt.
//
// WARUM ES DAS IM FRONTEND GIBT
// =============================
// Der Server SÄUBERT nicht, er PRÜFT: `slug_pruefen` in
// `apps/api/src/features/site_config/basis.py` wirft 422, sobald etwas anderes
// als a–z, 0–9 und `-` darin steht. Wer in der Zelle „Mein Beitrag" tippt,
// bekäme also eine Fehlermeldung statt einer Adresse.
//
// Deshalb formt diese Funktion die Eingabe VOR dem Senden — und zwar sichtbar:
// die Zelle zeigt anschließend den geformten Wert. Das ist kein erfundener
// Ersatzwert (Wurzel 4), sondern die Normalisierung einer Eingabe, deren
// Ergebnis der Nutzer sofort sieht.
//
// WAS SIE AUSDRÜCKLICH NICHT TUT
// ==============================
// Die gesperrten Sprachkürzel (`de`, `da`, `es`, … — 0476) prüft sie NICHT.
// Diese Liste steht im Backend und in `web/i18n/locales.ts`; eine dritte Kopie
// hier wäre die Stelle, die beim nächsten Sprachzuwachs vergessen wird
// (Wurzel 2). Ein reserviertes Kürzel geht also hinaus und kommt als 422 mit
// dem Text des Servers zurück — der erklärt den Grund besser als wir hier.
//
// Sie erfindet auch KEINEN Slug aus dem Titel, wenn die Eingabe leer ist: eine
// leere Adresse ist ein Fehler, den der Aufrufer meldet. Eine stillschweigend
// aus dem Titel erzeugte Adresse wäre bei einem veröffentlichten Beitrag eine
// Änderung an einem Link, den jemand geteilt hat.

/** Umlaute und Sonderzeichen, die eine deutsche Eingabe wahrscheinlich trägt.
 *  `normalize("NFKD")` erledigt den Rest — es zerlegt `é` in `e` + Akzent,
 *  und die Akzente fallen als Nicht-ASCII weg. `ß` hat keine Zerlegung und
 *  steht deshalb hier. */
const ERSATZ: Record<string, string> = {
  ä: "ae",
  ö: "oe",
  ü: "ue",
  ß: "ss",
  æ: "ae",
  ø: "oe",
  å: "aa",
};

export function slugSaeubern(roh: string): string {
  const klein = roh.trim().toLowerCase();
  const ersetzt = [...klein].map((c) => ERSATZ[c] ?? c).join("");
  return (
    ersetzt
      // NFKD zerlegt Buchstabe + Akzent; die Akzente sind kombinierende
      // Zeichen und fallen im nächsten Schritt als Nicht-ASCII weg.
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
  );
}
