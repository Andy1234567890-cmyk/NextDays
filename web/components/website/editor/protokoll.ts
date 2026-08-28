// Ablaufprotokoll des Seiten-Editors — die Spur, an der man einen Bug findet,
// statt ihn zu erraten.
//
// WARUM ES DAS GIBT
// Der Editor hat zwischen Klick und sichtbarer Wirkung sechs Stationen: der
// Klick im Kontextmenü, der lokale Zeilen-Zustand, das entprellte Speichern,
// der Request, die Antwort mit den echten IDs, das Neuladen der Vorschau.
// Bricht die Kette, sieht man von außen an JEDER dieser Stationen dasselbe —
// „nichts passiert". Am 25.08.2026 kostete genau das mehrere Anläufe: erst war
// der Klick tot (`pointer-events-none` über dem Menü), danach das Löschen
// serverseitig unvollständig (die Hülle aus 0472 blieb stehen). Beide Male
// war die Frage „kommt der Klick überhaupt an" ohne Antwort.
//
// EINGESCHALTET WIRD ES BEWUSST, nicht immer:
//   * `NEXT_PUBLIC_EDITOR_DEBUG=1` in `.env.local` (bleibt über Neuladen), oder
//   * `localStorage.setItem("editor-debug", "1")` in der Konsole (sofort, ohne
//     Neustart des Dev-Servers).
// In Produktion ist beides aus. Ein Protokoll, das immer läuft, verrät
// Seiten-IDs und Inhalte in der Konsole jedes Kunden.
//
// Es ersetzt KEIN Backend-Log: was der Server mit dem Request macht, steht in
// `nextdays.site_config.bloecke`. Dieses hier endet am Netzwerkrand.

/** Stationen einer Bearbeitung, in der Reihenfolge des Ablaufs. */
export type Station =
  | "klick" // ein Menü-/Leisten-Eintrag wurde betätigt
  | "zeilen" // der lokale Abschnitts-Zustand hat sich geändert
  | "speichern" // das entprellte Schreiben startet
  | "antwort" // das Backend hat geantwortet
  | "vorschau"; // die Vorschau wird neu geladen

function an(): boolean {
  if (process.env.NEXT_PUBLIC_EDITOR_DEBUG === "1") return true;
  // `try`, weil `localStorage` in einem privaten Fenster oder bei gesperrten
  // Seitendaten schon beim LESEN wirft — ein Protokoll darf die Seite nicht
  // mitreißen.
  try {
    return window.localStorage.getItem("editor-debug") === "1";
  } catch {
    return false;
  }
}

/**
 * Eine Station protokollieren.
 *
 * `daten` steht als Objekt daneben und nicht im Text: so bleibt die Zeile in
 * der Konsole aufklappbar und man sieht Werte, statt sie aus einem Satz zu
 * lesen.
 */
export function protokoll(
  station: Station,
  was: string,
  daten?: Record<string, unknown>,
): void {
  if (!an()) return;
  console.log(
    `%c[editor:${station}]%c ${was}`,
    "color:#b82028;font-weight:600",
    "color:inherit",
    daten ?? "",
  );
}

/**
 * Ein FEHLER in der Kette — anders als `protokoll` immer sichtbar.
 *
 * Ein verschluckter Fehler ist der Grund, warum man ein Protokoll überhaupt
 * braucht (Wurzel 5). Wer den Schalter nicht kennt, soll trotzdem sehen, dass
 * etwas schiefging.
 */
export function protokollFehler(
  station: Station,
  was: string,
  daten?: Record<string, unknown>,
): void {
  console.error(`[editor:${station}] ${was}`, daten ?? "");
}
