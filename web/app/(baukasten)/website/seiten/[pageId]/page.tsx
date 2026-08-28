// Editor einer Seite: Abschnittsliste links, Live-Vorschau rechts.
//
// Liegt UNTER dem Seiten-Reiter (`/website/seiten/<id>`), nicht direkt unter
// `/website/<id>`. Zwei Gründe: die Reiterleiste kann daran ablesen, dass
// „Seiten" der aktive Reiter ist, und die flache Form hätte mit `/website/design`
// kollidiert — eine Seite mit dem Slug „design" wäre nicht mehr erreichbar
// gewesen.
//
// KEIN Realtime-Refresh hier — der Editor hält einen lokalen Bearbeitungsstand,
// ein Live-Reload würde ungespeicherte Änderungen verwerfen.
//
// Der Editor liegt IM Dashboard-Layout (Sidebar/Topbar bleiben stehen). Der alte
// Canvas legte sich als Vollbild-Overlay darüber, was den Kunden aus seiner
// gewohnten Umgebung riss — für einen Editor, der nur eine Liste sortiert, ist
// das unnötig.
import { notFound } from "next/navigation";

import { AbschnittsEditor } from "@/components/website/editor/abschnitts-editor";
import {
  getBlogSettings,
  getPostFieldConfig,
  listCustomPostFields,
  listBlocks,
  listPages,
  listSeitenVorlagen,
  listTemplates,
} from "@/lib/site-pages";

import { ladeBaukasten } from "../../daten";

/** Blog-Einstellungen ohne gespeicherten Stand.
 *
 *  Alles auf null bzw. der Spalten-Default — kein erfundener Blogname und kein
 *  geratener RSS-Titel (Wurzel 4). Der Renderer entscheidet dann selbst, was er
 *  ohne Angabe tut. */
const LEERE_BLOG_EINSTELLUNGEN = {
  blog_name: null,
  blog_prev_next: true,
  rss_title: null,
  rss_description: null,
  rss_image_url: null,
};

export default async function PageEditor({
  params,
}: {
  params: Promise<{ pageId: string }>;
}) {
  const { pageId } = await params;
  // Der Editor zeigt inzwischen ALLE Bereiche der Bearbeitungsfläche als Panel
  // (Hinzufügen · Vorlagen · Seiten · Ebenen · Design). Er braucht deshalb
  // deren Daten mit — sonst wäre jeder Bereichswechsel wieder ein Seitenwechsel,
  // und genau das war die Beschwerde: „warum wird der editor immer neu geladen".
  const [
    pagesRes,
    blocksRes,
    baumRes,
    baukasten,
    templatesRes,
    seitenRes,
    blogRes,
    feldKonfigRes,
    eigeneFelderRes,
  ] = await Promise.all([
      listPages(),
      listBlocks(pageId),
      // Dieselben Blöcke MIT den Containern — nur für die Ebenen-Ansicht.
      // Zwei Aufrufe und nicht einer mit Filter im Client: die
      // Abschnittsliste arbeitet auf `position` als Rang IN DER SEITE, und
      // den vergibt der Server nur über die gefilterte Liste. Käme alles in
      // einem Aufruf, müsste der Rang hier neu gerechnet werden — an einer
      // zweiten Stelle, mit derselben Kette Widget → Spalte → Abschnitt
      // (Wurzel 2).
      listBlocks(pageId, true),
      ladeBaukasten(),
      listTemplates(),
      listSeitenVorlagen(),
      // Für das Blog-Panel. Es fährt im Editor von links ein und ist keine
      // eigene Route mehr — die Daten müssen also hier mitkommen, sonst wäre
      // der Bereichswechsel doch wieder ein Seitenwechsel.
      getBlogSettings(),
      // Die Feldkonfiguration des Blog-CMS (0481). Mit im selben Schwung und
      // nicht nachgeladen: das Panel baut seine Spalten daraus, und ein
      // Nachladen ließe die Tabelle einmal mit den eingebauten Namen und
      // gleich darauf mit den eingestellten aufblitzen.
      getPostFieldConfig(),
      // Die EIGENEN Beitragsfelder (0485). Aus demselben Grund hier und nicht
      // nachgeladen: die Tabelle baut ihre Spalten daraus.
      listCustomPostFields(),
    ]);
  if (!pagesRes.ok || !blocksRes.ok) notFound();
  // Die Seite muss in der EIGENEN Seitenliste stehen. Damit hängt der Zugriff am
  // Tenant-Scope des List-Pfads und nicht allein an der ID in der URL (Wurzel 9:
  // derselbe Scope für Liste und Einzelzugriff).
  const page = pagesRes.data.items.find((p) => p.id === pageId);
  if (!page) notFound();

  return (
    <AbschnittsEditor
      page={page}
      pages={pagesRes.data.items}
      initialBlocks={blocksRes.data.items}
      // Schlägt der Baum-Aufruf fehl, bleibt die Ebenen-Ansicht leer statt
      // eine flache Liste als Baum auszugeben (Wurzel 4: kein plausibler
      // Ersatz). Die Abschnittsliste arbeitet davon unberührt weiter.
      baumBlocks={baumRes.ok ? baumRes.data.items : []}
      branding={baukasten.branding}
      templates={templatesRes.ok ? templatesRes.data.templates : []}
      templateKategorien={templatesRes.ok ? templatesRes.data.kategorien : []}
      seitenVorlagen={seitenRes.ok ? seitenRes.data.vorlagen : []}
      blogEinstellungen={
        blogRes.ok ? blogRes.data : LEERE_BLOG_EINSTELLUNGEN
      }
      // Schlägt der Abruf fehl, gilt der Katalog: leere Liste heißt „keine
      // Abweichungen", und die Vorgaben stehen ohnehin im Frontend. Kein
      // erfundener Ersatzsatz (Wurzel 4).
      blogFeldKonfig={feldKonfigRes.ok ? feldKonfigRes.data.felder : []}
      // Dieselbe Regel: schlägt der Abruf fehl, gibt es keine eigenen Felder
      // — und nicht eine erfundene Liste (Wurzel 4).
      blogEigeneFelder={
        eigeneFelderRes.ok ? eigeneFelderRes.data.felder : []
      }
      // Für „Website ansehen" in der Kopfzeile des Editors: die aktive Domain
      // darin ist das Ziel der Live-Fassung.
      domains={baukasten.domains}
    />
  );
}
