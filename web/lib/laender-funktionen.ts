// Welche Werkzeuge in welchem Land etwas taugen.
//
// Manche Funktionen sind an ein nationales Format gebunden und anderswo
// wertlos. DATEV ist das klarste Beispiel: ein deutsches Steuerberater-Format,
// mit dem ein dänischer Revisor nichts anfangen kann.
//
// MASSGEBLICH IST DER FIRMENSITZ (`tenants.country`), NICHT DIE SPRACHE.
// Der Beta-Betrieb sitzt in Dänemark und arbeitet auf Deutsch. Wer die Locale
// als Land liest, blendet ihm ein DATEV ein, das sein Steuerberater nicht
// lesen kann — und nähme es umgekehrt einem deutschen Betrieb weg, der die
// Oberfläche auf Englisch gestellt hat. Das sind zwei verschiedene Fragen:
// „welche Sprache liest der Mensch" und „welchem Finanzamt meldet der Betrieb".
//
// Erweitern: Eintrag hier ergänzen und den Schlüssel in der Navigation
// (`app-sidebar.tsx`, Feld `laender`) setzen. Die Liste bleibt an EINER Stelle,
// damit nicht jede Oberfläche ihre eigene Länderlogik erfindet.

// DATEV ist praktisch ausschließlich deutsch. Österreich und die Schweiz haben
// zwar DATEV-Anbindungen über Partner, aber unser Export erzeugt das deutsche
// Format (SKR03/SKR04, EXTF-Header) — ihn dort anzubieten hieße, eine
// Kompatibilität zu behaupten, die wir nicht geprüft haben. Kommt eine
// belegte Unterstützung dazu, wird das Land hier ergänzt.
const DATEV_LAENDER = ["DE"] as const;

// Schlüssel = `key` des Navigationspunkts.
export const LAENDER_FUNKTIONEN: Readonly<Record<string, readonly string[]>> = {
  datev: DATEV_LAENDER,
};

/**
 * Darf ein Menüpunkt in diesem Land erscheinen?
 *
 * Ohne Eintrag in `LAENDER_FUNKTIONEN` ist ein Punkt länderneutral und immer
 * sichtbar — die Regel ist eine Ausnahmeliste, keine Erlaubnisliste. Sonst
 * verschwände beim nächsten neuen Menüpunkt versehentlich die halbe
 * Navigation.
 *
 * Ist das Land NICHT erfasst (`null`), bleibt ein länderspezifischer Punkt
 * verborgen. Ein DATEV-Export, den der Steuerberater nicht lesen kann, ist
 * schädlicher als ein fehlender Menüpunkt — und ein Land zu raten wäre
 * ohnehin die schlechtere Antwort (Wurzel 4).
 */
export function inLandVerfuegbar(
  key: string,
  land: string | null | undefined,
): boolean {
  const erlaubte = LAENDER_FUNKTIONEN[key];
  if (!erlaubte) return true;
  if (!land) return false;
  return erlaubte.includes(land.toUpperCase());
}
