// Website → Mediathek: der Medienbestand als EIGENE Seite (0479).
//
// Bis hierhin war die Mediathek nur aus einem Bildfeld heraus erreichbar. Wer
// ein Bild umbenennen, Alt-Texte nachtragen oder Ordner sortieren wollte,
// musste erst irgendeinen Block mit Bildfeld öffnen — ein Bestand ohne eigene
// Tür. Deshalb steht sie jetzt in der Leiste (unter „Blog") und hat diese Route.
//
// Die Seite lädt selbst KEINE Medien: das tut der Manager im Browser, weil er
// nach Art, Ordner, Suche und Sortierung filtert und diese Zustände nicht in
// der Adresse stehen. Serverseitig geholt würde bei jedem Klick die ganze Seite
// neu gerendert.
import { ladeBaukasten } from "../daten";
import { KeinZugriff } from "../kein-zugriff";
import { MediathekSeite } from "@/components/website/mediathek-seite";

export const dynamic = "force-dynamic";

export default async function MediathekRoute() {
  const { keinZugriff, pages, domains } = await ladeBaukasten();
  if (keinZugriff) return <KeinZugriff />;
  return <MediathekSeite pages={pages} domains={domains} />;
}
