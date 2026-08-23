// Zentraler Block-Renderer: dispatcht den Block-Baum einer Seite auf die
// jeweiligen Render-Komponenten. DER einzige Renderer der white-label Sites —
// der Editor-Canvas in apps/web bettet diese Ausgabe per iframe ein (kein
// Doppel-Renderer).
import type { Block } from "@/lib/site";
import { type EditierModus, NICHT_EDITIERBAR } from "@/lib/editier-kontext";
import type { SuchParams } from "@/lib/inserate";

import { BewertungenBlock } from "./bewertungen";
import { ButtonBlock, ContactBlock, GalleryBlock, ImageBlock, SpacerBlock } from "./simple-blocks";
import { FeaturedPropertiesBlock, PropertiesGridBlock } from "./properties-grid";
import { HeroBlock } from "./hero";
import { RichTextBlock } from "./rich-text";
import { getSiteContext } from "@/lib/site-context";

import { SearchBlock } from "./search-block";

function bgStyle(settings: Record<string, unknown>): React.CSSProperties {
  const bg = settings.background_color;
  return typeof bg === "string" ? { backgroundColor: bg } : {};
}

async function renderBlock(
  block: Block,
  tenantId: string,
  modus: EditierModus,
  search?: SuchParams,
  aufgeschluesselt = false,
): Promise<React.ReactNode> {
  switch (block.type) {
    case "hero":
      return <HeroBlock content={block.content} modus={modus} />;
    case "rich_text":
      return <RichTextBlock content={block.content} modus={modus} />;
    case "image":
      return <ImageBlock content={block.content} modus={modus} />;
    case "gallery":
      return <GalleryBlock content={block.content} />;
    case "button":
      return <ButtonBlock content={block.content} modus={modus} />;
    case "spacer":
      return <SpacerBlock content={block.content} />;
    case "contact":
      return <ContactBlock content={block.content} modus={modus} />;
    case "search":
      return (
        <SearchBlock
          content={block.content}
          modus={modus}
          aufgeschluesselt={aufgeschluesselt}
        />
      );
    case "properties_grid":
      return (
        <PropertiesGridBlock
          content={block.content}
          tenantId={tenantId}
          search={search}
          modus={modus}
        />
      );
    case "featured_properties":
      return (
        <FeaturedPropertiesBlock
          content={block.content}
          tenantId={tenantId}
          modus={modus}
        />
      );
    case "reviews":
      return (
        <BewertungenBlock
          content={block.content}
          tenantId={tenantId}
          modus={modus}
        />
      );
    default:
      return null;
  }
}

export async function BlockRenderer({
  blocks,
  tenantId,
  search,
  modus = NICHT_EDITIERBAR,
}: {
  blocks: Block[];
  tenantId: string;
  search?: SuchParams;
  /** Editier-Marker nur in der Entwurfs-Vorschau; live bleibt es beim Default. */
  modus?: EditierModus;
}) {
  // Die Anzeige-Einstellung der Website gilt für ALLE Blöcke — sie ist eine
  // Entscheidung über die Seite, nicht über einen Abschnitt. Deshalb einmal hier
  // geholt und nicht in jedem Block noch einmal (ein Fetch pro Block wäre
  // derselbe Wert N-mal).
  const { branding } = await getSiteContext();
  const aufgeschluesselt = branding?.show_guest_breakdown === true;
  const rendered = await Promise.all(
    blocks.map((b) => renderBlock(b, tenantId, modus, search, aufgeschluesselt)),
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
