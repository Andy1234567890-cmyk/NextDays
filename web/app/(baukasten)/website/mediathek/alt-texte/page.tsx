// Website → Mediathek → Alle Alt-Texte (0479, Punkt 6 des Vorbilds).
//
// Eine Seite, die EINE Frage beantwortet: welchen Bildern fehlt der
// Alternativtext? In der Mediathek selbst steht der Alt-Text je Bild in der
// Detailspalte — man sieht ihn also nur für das Bild, das man gerade angeklickt
// hat. Bei 65 Bildern ist „welche fehlen noch" damit eine Frage, die 65 Klicks
// kostet.
//
// Warum das zählt: der Alt-Text ist die Bildbeschreibung für Screenreader UND
// das, was Suchmaschinen vom Bild lesen. Ein fehlender Alt-Text ist kein
// Fehler, den irgendetwas meldet — er ist einfach nicht da.
import { ladeBaukasten } from "../../daten";
import { KeinZugriff } from "../../kein-zugriff";
import { AltTexteSeite } from "@/components/website/mediathek/alt-texte-seite";

export const dynamic = "force-dynamic";

export default async function AltTexteRoute() {
  const { keinZugriff, pages, domains } = await ladeBaukasten();
  if (keinZugriff) return <KeinZugriff />;
  return <AltTexteSeite pages={pages} domains={domains} />;
}
