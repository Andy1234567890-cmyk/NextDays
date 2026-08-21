// Die Provisionssätze für Fließtexte, die NICHT auf der Preisseite stehen.
//
// WOZU DIESE DATEI:
// Auf der Preisseite holt die Server Component `holePreisliste()` und gibt
// `liste` direkt an ihre Karten (`preis-provisionen.tsx`). Dort steht die Zahl
// als Überschrift, ein `null` lässt die ganze Sektion entfallen — das ist dort
// richtig, weil eine Provisions-Sektion ohne Satz nichts aussagt.
//
// Die drei Stellen hier sind anders gelagert: FAQ-Antwort, Stichwortzeile der
// Funktionsgruppe „Direktbuchung" und ein Häkchen-Chip auf der Funktionsseite.
// Sie sind ARGUMENTE, in denen der Satz ein Detail ist — der umgebende Text
// trägt auch ohne ihn. Deshalb liefern die Helfer hier `null` statt zu werfen,
// und die Aufrufer entscheiden je Stelle, was ein fehlender Satz bedeutet
// (siehe die Kommentare an den Aufrufstellen).
//
// Was hier BEWUSST nicht passiert: ein zweiter Aufruf des Endpunkts pro
// Komponente oder ein Fetch im Browser. Die Sätze kommen aus demselben
// `holePreisliste()` wie die Preisseite (Next dedupliziert den Aufruf im
// selben Request, `revalidate: 600`); die Server Component holt sie EINMAL und
// gibt den fertig formatierten String als Prop weiter — auch an die
// Client-Komponenten, die selbst keinen Zugang zum Backend haben.
import { formatProzent, holePreisliste } from "@/lib/preise";

/**
 * Die zwei Sätze, die in Marketing-Fließtexten vorkommen, fertig formatiert
 * in der Sprache des Besuchers — oder `null`, wenn die Preisliste fehlt.
 *
 * `extern` = Provision auf Buchungen über die eigene Buchungsstrecke/Portale
 * (heute 0,5 %), `marktplatz` = der All-in-Satz des myBestDays-Marktplatzes
 * (heute 8 %). Beide Zahlen liegen als benannte Konstanten im
 * subscriptions-Slice und kommen über `/subscriptions/public/pricing` — im
 * Text steht nur der ICU-Platzhalter `{satz}`.
 */
export type Provisionssaetze = {
  extern: string | null;
  marktplatz: string | null;
};

/**
 * Beide Sätze für die Sprache des Besuchers holen.
 *
 * Serverseitig aufzurufen (Server Component / `generateMetadata`), weil
 * `holePreisliste()` den Endpunkt serverseitig anspricht. Fehlt die Preisliste,
 * sind BEIDE Werte `null` — nie ein geratener Ersatzwert (Wurzel 4).
 */
export async function holeProvisionssaetze(
  locale: string,
): Promise<Provisionssaetze> {
  const liste = await holePreisliste();
  if (!liste) return { extern: null, marktplatz: null };
  return {
    extern: formatProzent(liste.commission_external_percent, locale),
    marktplatz: formatProzent(liste.commission_marketplace_percent, locale),
  };
}
