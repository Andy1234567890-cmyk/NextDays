// Durchlass durch das Vorstart-Tor — für uns, nicht für Besucher.
//
// Ohne diesen Weg wäre der Marktplatz vor dem Start auch für die Entwicklung
// unerreichbar; mit einem im Code stehenden Passwort wäre er faktisch offen
// (jeder liest das Repo). Das Geheimnis kommt deshalb AUSSCHLIESSLICH aus der
// Umgebung und ist serverseitig — kein NEXT_PUBLIC_, sonst läge es im
// Client-Bundle und damit bei jedem Besucher.
//
// Ablauf: `/?zugang=<schlüssel>` setzt ein httpOnly-Cookie, danach ist die
// Sitzung frei. Ein Aufruf ohne oder mit falschem Schlüssel verhält sich exakt
// wie ein normaler Besuch (Vorab-Seite) — es gibt keine Rückmeldung „falsches
// Passwort", die einem Angreifer bestätigt, dass es ein Tor gibt.
//
// FAIL-CLOSED (Wurzel 5): ist `MARKETPLACE_PREVIEW_KEY` nicht gesetzt oder
// kürzer als 16 Zeichen, gibt es GAR KEINEN Durchlass. Ein leeres Build-Arg
// darf das Tor nicht öffnen — und ein kurzes Geheimnis ist ratbar.
//
// WARUM KEIN `node:crypto`: Diese Datei wird aus der `middleware.ts` importiert,
// und die läuft im EDGE-Runtime. Dort gibt es weder `node:crypto` noch `Buffer`
// — der erste Entwurf nutzte `timingSafeEqual` und riss damit den Docker-Build
// beider Marktplatz-Apps auf (CI 22.08.2026). `tsc` und ESLint sehen das NICHT:
// die Typen von `node:crypto` sind vorhanden, nur das Modul fehlt zur Laufzeit.
// Der Vergleich läuft deshalb über Web-Standards, die im Edge existieren.
export const VORSTART_COOKIE = "nd_vorstart";

/** Query-Parameter, mit dem freigeschaltet wird. */
export const VORSTART_PARAM = "zugang";

const MIN_LAENGE = 16;

/** Der konfigurierte Schlüssel — oder null, wenn keiner brauchbar gesetzt ist. */
export function vorstartSchluessel(): string | null {
  const wert = (process.env.MARKETPLACE_PREVIEW_KEY ?? "").trim();
  return wert.length >= MIN_LAENGE ? wert : null;
}

/** Vergleich ohne verwertbaren Zeitunterschied.
 *
 *  `a === b` bricht beim ersten abweichenden Zeichen ab und verrät über die
 *  Laufzeit, wie viele Zeichen stimmten. Hier wird deshalb IMMER die volle
 *  Länge durchlaufen und das Ergebnis per XOR verrechnet: kein früher Ausstieg,
 *  kein Verzweigen auf dem Wert.
 *
 *  Die Längenprüfung davor ist unkritisch — die Länge des Geheimnisses ist kein
 *  Geheimnis, und ohne sie müsste man auf eine feste Länge auffüllen, was den
 *  Vergleich nur schwerer prüfbar macht.
 */
export function schluesselStimmt(eingabe: string | null | undefined): boolean {
  const erwartet = vorstartSchluessel();
  if (!erwartet || !eingabe) return false;
  if (eingabe.length !== erwartet.length) return false;
  let abweichung = 0;
  for (let i = 0; i < erwartet.length; i += 1) {
    abweichung |= eingabe.charCodeAt(i) ^ erwartet.charCodeAt(i);
  }
  return abweichung === 0;
}
