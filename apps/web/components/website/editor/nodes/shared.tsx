"use client";

// Gemeinsame Node-Helfer: locale-Map lesen/schreiben (Editor-Sprache = de),
// Container-Props und der Leer-Hinweis (gestrichelter Platzhalter in leeren
// Frames/Containern).
import { Icon } from "@iconify/react";

// --- Helfer: locale-Map lesen/schreiben (Editor-Sprache = de) ----------------
export type LocaleMap = Record<string, string>;

export const L = "de";

export function pick(m: unknown): string {
  if (typeof m === "string") return m;
  if (m && typeof m === "object") {
    const map = m as LocaleMap;
    return map[L] ?? Object.values(map).find((v) => typeof v === "string") ?? "";
  }
  return "";
}

export function put(prev: unknown, text: string): LocaleMap {
  const base = prev && typeof prev === "object" ? (prev as LocaleMap) : {};
  return { ...base, [L]: text };
}

// =============================================================================
// LAYOUT-PRIMITIVE (Framer: Frame / Stack / Grid / Masonry)
// Echte Container-Nodes: leer beim Einfügen, nehmen per Drag Kinder auf. Craft
// injiziert die abgelegten Kinder als `children`.
export type ContainerProps = { children?: React.ReactNode };

export function LeerHinweis({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="pointer-events-none flex size-full select-none flex-col items-center justify-center gap-2 text-muted-foreground">
      <Icon icon={icon} className="size-7 opacity-50" />
      <span className="text-sm">{label} — Blöcke hierher ziehen</span>
    </div>
  );
}
