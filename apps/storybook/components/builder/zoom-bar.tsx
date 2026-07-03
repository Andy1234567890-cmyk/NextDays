"use client";

// Untere schwebende Werkzeugleiste des Page-Builders — Werkstatt-Nachbau.
// Zeiger/Hand (Pan-Modus), Auf-Frame-Einpassen, Zoom-Stufen. Im Produkt hängt
// sie im Screen-Raum über der unendlichen Canvas (Zoom 5–400 %).
import { Icon } from "@iconify/react";

function ToolBtn({
  icon,
  label,
  active,
  onClick,
}: {
  icon: string;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={
        "flex size-8 items-center justify-center rounded-md transition " +
        (active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground")
      }
    >
      <Icon icon={icon} className="size-4" />
    </button>
  );
}

export function ZoomBar({
  panMode = false,
  zoom = 1,
  onPointer,
  onToggleHand,
  onFit,
  onZoomBy,
  onZoomTo,
}: {
  /** Hand-Werkzeug aktiv (Canvas verschieben statt selektieren). */
  panMode?: boolean;
  /** Zoom-Faktor, 1 = 100 %. */
  zoom?: number;
  onPointer?: () => void;
  onToggleHand?: () => void;
  /** Zoom-to-fit über alle Device-Frames. */
  onFit?: () => void;
  onZoomBy?: (factor: number) => void;
  onZoomTo?: (z: number) => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-full border border-border bg-card px-2 py-1.5 shadow-lg">
      <ToolBtn icon="ph:cursor" label="Zeiger" active={!panMode} onClick={onPointer} />
      <ToolBtn icon="ph:hand" label="Hand" active={panMode} onClick={onToggleHand} />
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
      <button
        type="button"
        aria-label="kleiner"
        onClick={() => onZoomBy?.(1 / 1.2)}
        className="flex size-7 items-center justify-center rounded-full hover:bg-secondary"
      >
        <Icon icon="ph:minus" className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onZoomTo?.(1)}
        title="Auf 100 %"
        className="w-11 rounded-full text-center text-xs tabular-nums hover:bg-secondary"
      >
        {Math.round(zoom * 100)}%
      </button>
      <button
        type="button"
        aria-label="größer"
        onClick={() => onZoomBy?.(1.2)}
        className="flex size-7 items-center justify-center rounded-full hover:bg-secondary"
      >
        <Icon icon="ph:plus" className="size-3.5" />
      </button>
    </div>
  );
}
