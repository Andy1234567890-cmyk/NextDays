// Zentraler Block-Renderer: dispatcht den Block-Baum einer Seite auf die
// jeweiligen Render-Komponenten. DER einzige Renderer der white-label Sites —
// der Editor-Canvas in apps/web bettet diese Ausgabe per iframe ein (kein
// Doppel-Renderer).
import type { Block } from "@/lib/site";
import type { SuchParams } from "@/lib/inserate";

import { ButtonBlock, ContactBlock, GalleryBlock, ImageBlock, SpacerBlock } from "./simple-blocks";
import { FeaturedPropertiesBlock, PropertiesGridBlock } from "./properties-grid";
import { HeroBlock } from "./hero";
import { RichTextBlock } from "./rich-text";
import { SearchBlock } from "./search-block";

function bgStyle(settings: Record<string, unknown>): React.CSSProperties {
  const bg = settings.background_color;
  return typeof bg === "string" ? { backgroundColor: bg } : {};
}

async function renderBlock(
  block: Block,
  tenantId: string,
  search?: SuchParams,
): Promise<React.ReactNode> {
  switch (block.type) {
    case "hero":
      return <HeroBlock content={block.content} />;
    case "rich_text":
      return <RichTextBlock content={block.content} />;
    case "image":
      return <ImageBlock content={block.content} />;
    case "gallery":
      return <GalleryBlock content={block.content} />;
    case "button":
      return <ButtonBlock content={block.content} />;
    case "spacer":
      return <SpacerBlock content={block.content} />;
    case "contact":
      return <ContactBlock content={block.content} />;
    case "search":
      return <SearchBlock content={block.content} />;
    case "properties_grid":
      return (
        <PropertiesGridBlock
          content={block.content}
          tenantId={tenantId}
          search={search}
        />
      );
    case "featured_properties":
      return (
        <FeaturedPropertiesBlock content={block.content} tenantId={tenantId} />
      );
    default:
      return null;
  }
}

export async function BlockRenderer({
  blocks,
  tenantId,
  search,
}: {
  blocks: Block[];
  tenantId: string;
  search?: SuchParams;
}) {
  const rendered = await Promise.all(
    blocks.map((b) => renderBlock(b, tenantId, search)),
  );
  return (
    <>
      {blocks.map((block, i) => (
        <div key={i} data-block-index={i} style={bgStyle(block.settings)}>
          {rendered[i]}
        </div>
      ))}
    </>
  );
}
