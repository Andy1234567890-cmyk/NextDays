// Mapping zwischen den site_blocks (Backend) und dem Craft.js-Node-Baum (Editor).
// Eine Seite = flache, geordnete Liste von Blöcken → ein ROOT-Canvas mit den
// Blöcken als Kinder. Wir bauen die Craft-Frame-JSON selbst (deterministisch),
// statt auf <Frame>-Kinder zu setzen, damit Laden/Speichern symmetrisch ist.
import type { Block, BlockType } from "@/lib/site-pages";

import { NODE_BY_TYPE } from "./nodes";

// Craft erwartet für den resolver-Lookup den Funktionsnamen der Node-Komponente.
const RESOLVER_NAME: Record<BlockType, string> = {
  hero: "HeroNode",
  rich_text: "TextNode",
  image: "ImageNode",
  gallery: "GalleryNode",
  button: "ButtonNode",
  spacer: "SpacerNode",
  contact: "ContactNode",
  search: "SearchNode",
  properties_grid: "PropertiesGridNode",
  featured_properties: "PropertiesGridNode",
  reviews: "ReviewsNode",
};

// content+settings eines Blocks → flache Props des Node (1:1, content führt).
function blockProps(block: Block): Record<string, unknown> {
  return { ...block.content, ...block.settings };
}

// Ein serialisierter Craft-Knoten für genau EINEN Block (ohne ROOT-Verkettung).
// Wird im Editor über query.parseSerializedNode(...).toNode() in den existieren-
// den ROOT-Canvas geladen — kein selbst-gebautes ROOT-JSON, das beim Auflösen
// scheitern würde.
export type BlockSerializedNode = {
  type: { resolvedName: string };
  isCanvas: boolean;
  props: Record<string, unknown>;
  displayName: string;
  custom: { blockId: string; blockType: BlockType };
  hidden: boolean;
  nodes: string[];
  linkedNodes: Record<string, string>;
  parent: string | null;
};

/** site_blocks → Liste serialisierter Block-Knoten (Reihenfolge = Array-Index). */
export function blocksToSerializedNodes(blocks: Block[]): BlockSerializedNode[] {
  return blocks.map((block) => ({
    type: { resolvedName: RESOLVER_NAME[block.type] ?? "TextNode" },
    isCanvas: false,
    props: blockProps(block),
    displayName: RESOLVER_NAME[block.type] ?? "Block",
    custom: { blockId: block.id, blockType: block.type },
    hidden: false,
    nodes: [],
    linkedNodes: {},
    parent: null,
  }));
}

const RESOLVER_TO_TYPE: Record<string, BlockType> = Object.fromEntries(
  Object.entries(RESOLVER_NAME).map(([type, name]) => [name, type as BlockType]),
) as Record<string, BlockType>;

export type SerializedBlock = {
  /** vorhandene DB-ID, falls der Block schon gespeichert war (sonst null = neu). */
  blockId: string | null;
  type: BlockType;
  content: Record<string, unknown>;
  settings: Record<string, unknown>;
};

// Welche Prop-Keys sind „settings" (Layout/Style) statt „content" (Inhalt)?
const SETTINGS_KEYS = new Set([
  "background_color",
  "padding",
  "full_width",
  "opacity",
  "visible",
  "radius",
  "rotation",
]);

function splitProps(props: Record<string, unknown>): {
  content: Record<string, unknown>;
  settings: Record<string, unknown>;
} {
  const content: Record<string, unknown> = {};
  const settings: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) {
    if (SETTINGS_KEYS.has(k)) settings[k] = v;
    else content[k] = v;
  }
  return { content, settings };
}

/** Craft-Editor-Query-JSON (serialize()) → geordnete Block-Liste fürs Backend. */
export function craftJsonToBlocks(json: string): SerializedBlock[] {
  const tree = JSON.parse(json) as Record<
    string,
    {
      type: { resolvedName: string };
      props: Record<string, unknown>;
      nodes: string[];
      custom?: { blockId?: string; blockType?: BlockType };
    }
  >;
  const root = tree.ROOT;
  if (!root) return [];
  const out: SerializedBlock[] = [];
  for (const id of root.nodes) {
    const node = tree[id];
    if (!node) continue;
    const type =
      node.custom?.blockType ?? RESOLVER_TO_TYPE[node.type.resolvedName];
    if (!type || !(type in NODE_BY_TYPE)) continue;
    const { content, settings } = splitProps(node.props ?? {});
    out.push({
      blockId: node.custom?.blockId ?? null,
      type,
      content,
      settings,
    });
  }
  return out;
}
