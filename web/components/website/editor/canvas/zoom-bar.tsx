"use client";

// Untere schwebende Leiste (Zeiger/Hand/Einpassen/Zoom) — im Screen-Raum.
import { Icon } from "@iconify/react";

import { ToolBtn } from "./chrome";

export function ZoomBar({
  panMode,
  zoom,
  onPointer,
  onToggleHand,
  onFit,
  zoomBy,
  zoomTo,
}: {
  panMode: boolean;
  zoom: number;
  onPointer: () => void;
  onToggleHand: () => void;
  onFit: () => void;
  zoomBy: (factor: number) => void;
  zoomTo: (z: number) => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
      <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-border bg-card px-2 py-1.5 shadow-lg">
        <ToolBtn
          icon="ph:cursor"
          label="Zeiger"
          active={!panMode}
          onClick={onPointer}
        />
        <ToolBtn
          icon="ph:hand"
          label="Hand"
          active={panMode}
          onClick={onToggleHand}
        />
        <button
          type="button"
          aria-label="Einpassen"
          title="Auf Frame einpassen"
          onClick={onFit}
          className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground"
        >
          <Icon icon="ph:corners-out" className="size-4" />
        </button>
        <span className="mx-1 h-4 w-px bg-border" />
        <button type="button" aria-label="kleiner" onClick={() => zoomBy(1 / 1.2)} className="flex size-7 items-center justify-center rounded-full hover:bg-secondary">
          <Icon icon="ph:minus" className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => zoomTo(1)}
          title="Auf 100 %"
          className="w-11 rounded-full text-center text-xs tabular-nums hover:bg-secondary"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button type="button" aria-label="größer" onClick={() => zoomBy(1.2)} className="flex size-7 items-center justify-center rounded-full hover:bg-secondary">
          <Icon icon="ph:plus" className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
