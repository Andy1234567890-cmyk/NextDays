// Draft-Render-Route für den Editor-iframe (apps/web). Rendert eine Seite — AUCH
// unveröffentlicht — nur mit gültigem HMAC-Token (vom Backend signiert). Reiner
// Canvas (kein Header/Footer), plus ein postMessage-Skript, das dem Editor Block-
// Selektion meldet. NICHT für Endkunden; nur für die Live-Vorschau im Editor.
import { notFound } from "next/navigation";

import { BlockRenderer } from "@/components/blocks/block-renderer";
import { CanvasBridge } from "@/components/blocks/canvas-bridge";
import { ladeSeitenEntwurf } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function DraftRenderPage({
  params,
  searchParams,
}: {
  params: Promise<{ pageId: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { pageId } = await params;
  const { token } = await searchParams;
  if (!token) notFound();

  const site = await ladeSeitenEntwurf(pageId, token);
  if (!site) notFound();

  return (
    <div className="min-h-screen bg-background">
      <CanvasBridge />
      <BlockRenderer blocks={site.blocks} tenantId={site.tenant_id} />
    </div>
  );
}
