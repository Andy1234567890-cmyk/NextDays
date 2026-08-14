// Auflösung mehrsprachiger Textfelder (Locale → Text), wie sie Katalogdaten
// tragen: Zusatzleistungen, Objekttexte, Ankündigungen.
//
// Eigenes Modul, weil inzwischen zwei Oberflächen dieselbe Wahl treffen —
// die Zusatzleistungen an der Buchung und die Badges im Dashboard. Läge die
// Funktion in einer der beiden Komponenten, zöge die andere sie samt deren
// Abhängigkeiten ins Bundle; eine Kopie würde beim nächsten Sprachfall
// auseinanderlaufen.
//
// KEIN `"use server"`: die Funktion ist synchron und wird im Client gebraucht.

// Reihenfolge der Rückfälle: die Sprache des Betrachters, dann Deutsch (die
// Pflegesprache der meisten Betriebe), dann Englisch, dann irgendein
// gepflegter Wert. Erst wenn gar nichts da ist, greift der Ersatztext — der
// vom Aufrufer kommt und damit übersetzt ist (kein hartkodierter String hier).
export function lokalisiert(
  werte: Record<string, string> | null | undefined,
  locale: string,
  ersatz: string,
): string {
  if (!werte) return ersatz;
  // Nur nicht-leere Werte zählen: ein leerer String ist ein ungepflegtes Feld,
  // kein gültiger Text — sonst stünde bei `{de: ""}` eine leere Zeile statt
  // des Ersatztextes.
  const gepflegt = (s: string | undefined): s is string => Boolean(s?.trim());
  const kurz = locale.split("-")[0];
  const kandidaten = [werte[locale], werte[kurz], werte.de, werte.en];
  return (
    kandidaten.find(gepflegt) ?? Object.values(werte).find(gepflegt) ?? ersatz
  );
}
