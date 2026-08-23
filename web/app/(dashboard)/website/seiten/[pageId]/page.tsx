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
import { listBlocks, listPages } from "@/lib/site-pages";

export default async function PageEditor({
  params,
}: {
  params: Promise<{ pageId: string }>;
}) {
  const { pageId } = await params;
  const [pagesRes, blocksRes] = await Promise.all([
    listPages(),
    listBlocks(pageId),
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
    />
  );
}
