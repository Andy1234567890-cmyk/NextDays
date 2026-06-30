// Block-Katalog für die Palette + Default-Inhalte. Buchungs-Blöcke sind als
// `booking: true` markiert (im UI grün hervorgehoben — der Vorsprung ggü. reinen
// Website-Buildern).
import type { BlockType } from "@/lib/site-pages";

export type BlockMeta = {
  type: BlockType;
  label: string;
  icon: string;
  booking?: boolean;
  defaultContent: Record<string, unknown>;
};

export const BLOCK_CATALOG: BlockMeta[] = [
  {
    type: "hero",
    label: "Hero",
    icon: "ph:image-square",
    defaultContent: { heading: { de: "Überschrift" }, subheading: { de: "" } },
  },
  {
    type: "rich_text",
    label: "Text",
    icon: "ph:text-aa",
    defaultContent: { html: { de: "<p>Ihr Text …</p>" } },
  },
  {
    type: "image",
    label: "Bild",
    icon: "ph:image",
    defaultContent: { url: "", alt: { de: "" } },
  },
  {
    type: "gallery",
    label: "Galerie",
    icon: "ph:images",
    defaultContent: { images: [] },
  },
  {
    type: "button",
    label: "Button",
    icon: "ph:cursor-click",
    defaultContent: { label: { de: "Mehr erfahren" }, href: "" },
  },
  {
    type: "spacer",
    label: "Abstand",
    icon: "ph:arrows-out-line-vertical",
    defaultContent: { size: "md" },
  },
  {
    type: "contact",
    label: "Kontakt",
    icon: "ph:envelope",
    defaultContent: { headline: { de: "Kontakt" }, show_form: true },
  },
  {
    type: "search",
    label: "Suche",
    icon: "ph:magnifying-glass",
    booking: true,
    defaultContent: { placeholder: { de: "Reiseziel suchen" } },
  },
  {
    type: "properties_grid",
    label: "Objekt-Grid",
    icon: "ph:grid-four",
    booking: true,
    defaultContent: { headline: { de: "Unsere Unterkünfte" } },
  },
  {
    type: "featured_properties",
    label: "Empfohlene Objekte",
    icon: "ph:star",
    booking: true,
    defaultContent: { headline: { de: "Empfohlen" }, property_ids: [] },
  },
];

export const BLOCK_META: Record<BlockType, BlockMeta> = Object.fromEntries(
  BLOCK_CATALOG.map((b) => [b.type, b]),
) as Record<BlockType, BlockMeta>;
