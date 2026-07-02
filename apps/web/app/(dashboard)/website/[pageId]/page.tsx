// Editor einer Seite: lädt Seite + Blöcke und übergibt sie an den Canvas-Editor.
// KEIN Realtime-Refresh hier — der Canvas-Editor hält lokalen Bearbeitungsstand;
// ein Live-Reload würde unbestätigte Änderungen verwerfen.
//
// Der Editor ist VOLLBILD (wie Framer): der CanvasEditor legt sich als
// fixed-Overlay über das gesamte Dashboard (inkl. Sidebar/Topbar) — kein
// Wrapper nötig; „Zurück" im Editor führt zur Seitenliste /website.
import { notFound } from "next/navigation";

import { CanvasEditor } from "@/components/website/editor/canvas-editor";
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
  const page = pagesRes.data.items.find((p) => p.id === pageId);
  if (!page) notFound();

  return (
    <CanvasEditor
      page={page}
      pages={pagesRes.data.items}
      initialBlocks={blocksRes.data.items}
    />
  );
}
