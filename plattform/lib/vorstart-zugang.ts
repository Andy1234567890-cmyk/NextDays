// Durchlass durch das Vorstart-Tor — für uns, nicht für Besucher.
//
// Ohne diesen Weg wäre der Marktplatz vor dem Start auch für die Entwicklung
// unerreichbar; mit einem im Code stehenden Passwort wäre er faktisch offen
// (jeder liest das Repo-Bundle). Das Geheimnis kommt deshalb AUSSCHLIESSLICH
// aus der Umgebung und ist serverseitig — kein NEXT_PUBLIC_, sonst läge es im
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
import { timingSafeEqual } from "node:crypto";

/** Name des Cookies, das eine freigeschaltete Sitzung markiert. */
export const VORSTART_COOKIE = "nd_vorstart";

/** Query-Parameter, mit dem freigeschaltet wird. */
export const VORSTART_PARAM = "zugang";

const MIN_LAENGE = 16;

/** Der konfigurierte Schlüssel — oder null, wenn keiner brauchbar gesetzt ist. */
export function vorstartSchluessel(): string | null {
  const wert = (process.env.MARKETPLACE_PREVIEW_KEY ?? "").trim();
  return wert.length >= MIN_LAENGE ? wert : null;
}

/** Byteweiser Vergleich ohne Zeitunterschied.
 *
 *  `a === b` bricht beim ersten abweichenden Zeichen ab und verrät über die
 *  Laufzeit, wie viele Zeichen stimmten. Bei ungleicher Länge vergleicht
 *  `timingSafeEqual` nicht, sondern wirft — deshalb die Längenprüfung vorher,
 *  und zwar so, dass sie selbst nichts verrät (die Länge des Geheimnisses ist
 *  kein Geheimnis).
 */
export function schluesselStimmt(eingabe: string | null | undefined): boolean {
  const erwartet = vorstartSchluessel();
  if (!erwartet || !eingabe) return false;
  const a = Buffer.from(eingabe, "utf8");
  const b = Buffer.from(erwartet, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
