"use client";

/* Craft.js-Nodes — Fassade. Die Implementierung liegt in ./nodes/*:
 *  - shared:          locale-Helfer + LeerHinweis
 *  - block-nodes:     Hero/Text/Objekt-Grid/Suche/Bild/Button/Galerie/Kontakt/Abstand
 *  - frame-types:     FrameProps/FrameEffect/FRAME_DEFAULTS
 *  - frame-style:     CSS-/Motion-Ableitung aus den Props
 *  - frame-node:      FrameNode (Canvas-Objekt mit Chrome)
 *  - container-nodes: Stack/Grid/Masonry
 * Externe Importe (canvas-editor/palette/insert-panel/serialize) bleiben
 * unverändert auf "./nodes" zeigen.
 */
import {
  ButtonNode,
  ContactNode,
  GalleryNode,
  HeroNode,
  ImageNode,
  PropertiesGridNode,
  ReviewsNode,
  SearchNode,
  SpacerNode,
  TextNode,
} from "./nodes/block-nodes";

export {
  ButtonNode,
  ContactNode,
  GalleryNode,
  type HeroProps,
  HeroNode,
  ImageNode,
  PropertiesGridNode,
  ReviewsNode,
  SearchNode,
  SpacerNode,
  TextNode,
} from "./nodes/block-nodes";
export { GridNode, MasonryNode, StackNode } from "./nodes/container-nodes";
export { FrameNode } from "./nodes/frame-node";
export {
  FRAME_DEFAULTS,
  type FrameEffect,
  type FramePins,
  type FrameProps,
} from "./nodes/frame-types";

// --- Registry: Block-Typ → Node-Komponente (für Editor + Speichern/Laden) -----
export const NODE_BY_TYPE = {
  hero: HeroNode,
  rich_text: TextNode,
  image: ImageNode,
  gallery: GalleryNode,
  button: ButtonNode,
  spacer: SpacerNode,
  contact: ContactNode,
  search: SearchNode,
  properties_grid: PropertiesGridNode,
  featured_properties: PropertiesGridNode,
  reviews: ReviewsNode,
} as const;

export type EditorBlockType = keyof typeof NODE_BY_TYPE;
