"use client";

// Einfügen-Menü des Page-Builders — Werkstatt-Nachbau des Framer-artigen
// „Layout"-Dropdowns: Frame · Stack · Grid · Masonry — Image · Video, mit
// Original-Icons (Inline-SVG) und Tastatur-Shortcuts. Im Produkt fügt der
// Klick einen craft.js-Node ein; hier meldet er nur das Label nach oben.
import type { ReactElement } from "react";

type MenuIcon = () => ReactElement;

const FrameIcon: MenuIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20">
    <path
      d="M 2.5 5.5 C 2.5 3.843 3.843 2.5 5.5 2.5 L 14.5 2.5 C 16.157 2.5 17.5 3.843 17.5 5.5 L 17.5 14.5 C 17.5 16.157 16.157 17.5 14.5 17.5 L 5.5 17.5 C 3.843 17.5 2.5 16.157 2.5 14.5 Z"
      fill="currentColor"
      fillOpacity="0.15"
    />
    <path d="M 7.5 3 L 6 3 C 4.343 3 3 4.343 3 6 L 3 7.5" fill="transparent" strokeWidth="2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M 12.5 3 L 14 3 C 15.657 3 17 4.343 17 6 L 17 7.5" fill="transparent" strokeWidth="2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M 12.5 17 L 14 17 C 15.657 17 17 15.657 17 14 L 17 12.5" fill="transparent" strokeWidth="2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M 7.5 17 L 6 17 C 4.343 17 3 15.657 3 14 L 3 12.5" fill="transparent" strokeWidth="2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const StackIcon: MenuIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20">
    <path
      d="M 3 6 C 3 4.343 4.343 3 6 3 L 14 3 C 15.657 3 17 4.343 17 6 L 17 14 C 17 15.657 15.657 17 14 17 L 6 17 C 4.343 17 3 15.657 3 14 Z"
      fill="currentColor"
      fillOpacity="0.15"
      strokeWidth="2"
      stroke="currentColor"
    />
    <path d="M 10 4 L 10 16" fill="transparent" strokeWidth="2" stroke="currentColor" />
  </svg>
);
const GridIcon: MenuIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20">
    <path
      d="M 3 6 C 3 4.343 4.343 3 6 3 L 14 3 C 15.657 3 17 4.343 17 6 L 17 14 C 17 15.657 15.657 17 14 17 L 6 17 C 4.343 17 3 15.657 3 14 Z"
      fill="currentColor"
      fillOpacity="0.15"
      strokeWidth="2"
      stroke="currentColor"
    />
    <path d="M 4 10 L 16 10" fill="transparent" strokeWidth="2" stroke="currentColor" />
    <path d="M 10 4 L 10 16" fill="transparent" strokeWidth="2" stroke="currentColor" />
  </svg>
);
const MasonryIcon: MenuIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20">
    <path
      d="M 3 6 C 3 4.343 4.343 3 6 3 L 14 3 C 15.657 3 17 4.343 17 6 L 17 14 C 17 15.657 15.657 17 14 17 L 6 17 C 4.343 17 3 15.657 3 14 Z"
      fill="currentColor"
      fillOpacity="0.15"
      strokeWidth="2"
      stroke="currentColor"
    />
    <path d="M 4 10 L 16 10" fill="transparent" strokeWidth="2" stroke="currentColor" />
    <path d="M 8 4 L 8 9" fill="transparent" strokeWidth="2" stroke="currentColor" />
    <path d="M 12 11 L 12 16" fill="transparent" strokeWidth="2" stroke="currentColor" />
  </svg>
);
const ImageIcon: MenuIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none">
    <path d="M3 6a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3Z" fill="transparent" stroke="currentColor" strokeWidth="2" />
    <path d="M3 13c3.402-4.859 10.598-4.859 14 0v1a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="2" />
  </svg>
);
const VideoIcon: MenuIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20">
    <path
      d="M 4.5 4.304 C 4.5 3.519 5.364 3.04 6.03 3.456 L 15.143 9.152 C 15.77 9.544 15.77 10.456 15.143 10.848 L 6.03 16.544 C 5.364 16.96 4.5 16.481 4.5 15.696 Z"
      fill="currentColor"
      fillOpacity="0.15"
      strokeWidth="2"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const INSERT_MENU: { label: string; Icon: MenuIcon; shortcut: string; trenner?: boolean }[] = [
  { label: "Frame", Icon: FrameIcon, shortcut: "F" },
  { label: "Stack", Icon: StackIcon, shortcut: "S" },
  { label: "Grid", Icon: GridIcon, shortcut: "⇧G" },
  { label: "Masonry", Icon: MasonryIcon, shortcut: "⇧M" },
  { label: "Image", Icon: ImageIcon, shortcut: "⇧I", trenner: true },
  { label: "Video", Icon: VideoIcon, shortcut: "⇧V" },
];

export function InsertMenu({ onPick }: { onPick?: (label: string) => void }) {
  return (
    <div
      role="menu"
      className="w-52 overflow-hidden rounded-xl border border-border bg-card p-1 shadow-xl shadow-black/10"
    >
      {INSERT_MENU.map((it) => (
        <div key={it.label}>
          {it.trenner ? <div className="my-1 h-px bg-border" /> : null}
          <button
            type="button"
            role="menuitem"
            onClick={() => onPick?.(it.label)}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm transition hover:bg-secondary"
          >
            <span className="flex size-5 items-center justify-center text-foreground/80">
              <it.Icon />
            </span>
            <span className="flex-1">{it.label}</span>
            <span className="text-xs tracking-widest text-muted-foreground">{it.shortcut}</span>
          </button>
        </div>
      ))}
    </div>
  );
}
