// Editor einer Seite: lädt Seite + Blöcke und übergibt sie an den Canvas-Editor.
// Realtime auf site_blocks, damit parallele Änderungen (anderer Tab/Editor) live
// erscheinen.
import { notFound } from "next/navigation";

import { RealtimeRefresh } from "@/components/realtime-refresh";
import { CanvasEditor } from "@/components/website/canvas-editor";
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
    <div className="flex flex-1 flex-col">
      <RealtimeRefresh tables={["site_blocks"]} />
      <CanvasEditor page={page} initialBlocks={blocksRes.data.items} />
    </div>
  );
}
