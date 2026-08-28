// Website → Ebenen: KEINE eigene Seite, sondern ein Panel im Editor.
//
// Es gibt EINEN Editor. Die Bereichsleiste wechselt darin das Panel, sie
// wechselt nicht die Seite — genauso hält es Hostaway. Ein zweiter Bildschirm
// mit derselben Vorschau daneben wäre eine zweite Wahrheit über denselben
// Arbeitsstand: man könnte dort etwas auswählen, während im Editor etwas
// anderes ausgewählt ist.
//
// Diese Route bleibt trotzdem bestehen, weil die Leiste eine ADRESSE braucht
// (ein Link ohne Ziel ist kein Link) und weil ein Lesezeichen darauf zeigen
// kann. Sie leitet in den Editor der Startseite und öffnet das Panel dort.
import { redirect } from "next/navigation";

import { ladeBaukasten } from "../daten";
import { KeinZugriff } from "../kein-zugriff";

export const dynamic = "force-dynamic";

export default async function EbenenSeite() {
  const { keinZugriff, pages } = await ladeBaukasten();
  if (keinZugriff) return <KeinZugriff />;
  const ziel = pages.find((p) => p.is_home) ?? pages[0] ?? null;
  // Ohne Seite gibt es nichts zu zeigen — dann in die Seitenliste, wo man eine
  // anlegt. Ein Editor ohne Seite wäre ein leerer Bildschirm ohne Ausweg.
  redirect(ziel ? `/website/seiten/${ziel.id}?panel=ebenen` : "/website/seiten");
}
