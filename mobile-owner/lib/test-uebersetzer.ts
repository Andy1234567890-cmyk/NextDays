// Ein Übersetzer für Tests.
//
// Die Datums- und Textformate nehmen seit der Mehrsprachigkeit die
// Übersetzungsfunktion als Parameter. In Tests läuft sie auf DEUTSCH: die
// Erwartungen bleiben damit dieselben wie vor dem Umbau, und ein Test, der
// „Mittwoch, 8. Juli" prüft, prüft weiterhin das Format und nicht die
// Sprachwahl. Wo eine ANDERE Sprache Teil der Aussage ist (Dezimaltrenner),
// steht sie im Test ausdrücklich da.
import { uebersetzen, type TextSchluessel } from "@/lib/sprache";

export const txt = (schluessel: TextSchluessel, werte?: Record<string, string | number>) =>
  uebersetzen("de", schluessel, werte);
