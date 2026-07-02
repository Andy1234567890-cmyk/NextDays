"use client";

// Flow-Container (Stack/Grid/Masonry): stapeln Kinder im Fluss. Vorerst
// einfach; Styles folgen analog zum Frame.
import { useNode } from "@craftjs/core";

import { type ContainerProps, LeerHinweis } from "./shared";

// Flow-Container (stapeln im Fluss). Vorerst einfach; Style folgt analog Frame.
export function useContainer() {
  const {
    connectors: { connect },
    hasChildren,
  } = useNode((node) => ({ hasChildren: node.data.nodes.length > 0 }));
  return { ref: (r: HTMLElement | null) => { if (r) connect(r); }, hasChildren };
}

export function StackNode({ children }: ContainerProps) {
  const { ref, hasChildren } = useContainer();
  return (
    <div ref={ref} className="mx-auto flex min-h-[8rem] w-full max-w-4xl flex-col gap-4 px-6 py-8">
      {hasChildren ? children : <LeerHinweis icon="ph:rows" label="Stack" />}
    </div>
  );
}
StackNode.craft = { displayName: "Stack", rules: { canMoveIn: () => true } };

export function GridNode({ children }: ContainerProps) {
  const { ref, hasChildren } = useContainer();
  return (
    <div ref={ref} className="mx-auto grid min-h-[8rem] w-full max-w-6xl grid-cols-1 gap-4 px-6 py-8 sm:grid-cols-2 lg:grid-cols-3">
      {hasChildren ? children : <div className="col-span-full"><LeerHinweis icon="ph:grid-four" label="Grid" /></div>}
    </div>
  );
}
GridNode.craft = { displayName: "Grid", rules: { canMoveIn: () => true } };

export function MasonryNode({ children }: ContainerProps) {
  const { ref, hasChildren } = useContainer();
  return (
    <div ref={ref} className="mx-auto min-h-[8rem] w-full max-w-6xl px-6 py-8 [column-gap:1rem] sm:[columns:2] lg:[columns:3]">
      {hasChildren ? children : <LeerHinweis icon="ph:squares-four" label="Masonry" />}
    </div>
  );
}
MasonryNode.craft = { displayName: "Masonry", rules: { canMoveIn: () => true } };
