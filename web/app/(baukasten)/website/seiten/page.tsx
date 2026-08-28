// Website → Seiten: KEINE eigene Seite, sondern ein Panel im Editor.
//
// Es gibt EINEN Baukasten. Bis hierher gab es zwei Oberflächen für dieselbe
// Arbeit: diese Route baute mit `SeitenAnsicht` eine eigene Bühne aus
// Seitenliste, Seitenwahl, Gerätewahl und Vorschau — und der Editor unter
// `/website/seiten/<id>` baut dieselben vier Bauteile noch einmal, nur mit
// Bearbeitung. Die Übersicht war also eine schwächere Teilmedaille des
// Editors: sie konnte nichts, was er nicht kann, und teilte sich mit ihm sogar
// die Bauteile (`SeitenLeiste`, `VorschauFlaeche`, `SeitenWahl`).
//
// Zwei Bühnen mit derselben Vorschau nebeneinander sind eine zweite Wahrheit
// über denselben Arbeitsstand: man kann dort eine Seite auswählen, während im
// Editor eine andere offen ist, und beide behaupten, „die Seitenansicht" zu
// sein. Für den Kunden ist es schlicht dieselbe Sache an zwei Adressen.
//
// Dieselbe Entscheidung war für `hinzufuegen`, `blog` und `ebenen` schon
// getroffen und begründet — dort steht wortgleich, warum es EINEN Editor gibt.
// `seiten` war die letzte Route, die noch nicht nachgezogen war.
//
// Die Route BLEIBT bestehen, weil die Bereichsleiste eine Adresse braucht (ein
// Link ohne Ziel ist kein Link), weil Lesezeichen darauf zeigen und weil
// `revalidatePath("/website/seiten")` an zwei Stellen darauf verweist. Sie
// leitet in den Editor der Startseite und öffnet das Seiten-Panel dort.
import { redirect } from "next/navigation";

import { ladeBaukasten } from "../daten";
import { KeinZugriff } from "../kein-zugriff";

export const dynamic = "force-dynamic";

export default async function SeitenSeite() {
  const { keinZugriff, pages } = await ladeBaukasten();
  if (keinZugriff) return <KeinZugriff />;
  // Ein Ziel gibt es IMMER: `listPages` legt die Systemseiten der
  // Buchungsstrecke beim ersten Blick selbst an (`service.list_pages` →
  // `systemseiten.sicherstellen`). Ein Betrieb ohne jede Seite kann hier also
  // nicht ankommen. Der Fallback steht trotzdem da, weil diese Zusicherung im
  // Backend liegt und nicht in dieser Datei — bricht sie, soll hier eine leere
  // Bühne stehen und keine Weiterleitung ins Nichts.
  const ziel = pages.find((p) => p.is_home) ?? pages[0] ?? null;
  if (!ziel) return <KeinZugriff />;
  redirect(`/website/seiten/${ziel.id}?panel=seiten`);
}
