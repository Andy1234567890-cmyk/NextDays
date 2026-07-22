"use client";

// Obere Toolbar des Page-Builders (Framer-Stil) — Werkstatt-Nachbau.
// Links: Zurück, Canvas-Chip, Werkzeuge („+" wechselt die Sidebar in den
// Insert-Modus, das Auswahl-Werkzeug öffnet das Einfügen-Menü). Mittig der
// Seitentitel mit Slug/Status, rechts Device-Umschalter + Veröffentlichen.
import { Icon } from "@iconify/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

import { InsertMenu } from "./insert-menu";

export type Device = "desktop" | "tablet" | "mobile";

// Device-Umschalter setzt im Produkt die Frame-Breite (danach frei ziehbar).
export const DEVICE_PX: Record<Device, number> = { desktop: 1200, tablet: 810, mobile: 390 };

export function EditorTopBar({
  title,
  slug,
  published = false,
  device = "desktop",
  insertOpen = false,
  saving = false,
  onBack,
  onToggleInsert,
  onPickDevice,
  onPickInsert,
  onSave,
}: {
  /** Seitentitel (mittig). */
  title: string;
  /** Slug ohne führenden Schrägstrich; leer = Startseite. */
  slug?: string;
  published?: boolean;
  device?: Device;
  /** Ist der Insert-Modus (Sidebar) gerade aktiv? Färbt das „+" ein. */
  insertOpen?: boolean;
  saving?: boolean;
  onBack?: () => void;
  onToggleInsert?: () => void;
  onPickDevice?: (d: Device) => void;
  /** Auswahl im Einfügen-Menü (Frame/Stack/Grid/…). */
  onPickInsert?: (label: string) => void;
  onSave?: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="flex h-12 items-center justify-between gap-3 border-b border-border bg-card px-3">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="size-8" aria-label="Zurück" onClick={onBack}>
          <Icon icon="ph:arrow-left" className="size-4" />
        </Button>
        <span className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium">
          <Icon icon="ph:browser" className="size-3.5 text-primary" />
          Canvas
          <Icon icon="ph:caret-down" className="size-3 text-muted-foreground" />
        </span>

        {/* Werkzeuge — „+" öffnet das Insert-Panel */}
        <div className="ml-1 flex items-center gap-0.5">
          <button
            type="button"
            aria-label="Block hinzufügen"
            title="Block hinzufügen"
            onClick={onToggleInsert}
            className={
              "flex size-8 items-center justify-center rounded-md transition " +
              (insertOpen
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground")
            }
          >
            <Icon icon="ph:plus" className="size-4" />
          </button>

          {/* Auswahl-Werkzeug öffnet das Einfügen-Menü (Frame/Stack/…). */}
          <div className="relative">
            <button
              type="button"
              aria-label="Einfügen"
              title="Einfügen"
              onClick={() => setMenuOpen((v) => !v)}
              className={
                "flex size-8 items-center justify-center rounded-md transition " +
                (menuOpen
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground")
              }
            >
              <Icon icon="ph:selection" className="size-4" />
            </button>
            {menuOpen ? (
              <>
                <button
                  type="button"
                  aria-label="Menü schließen"
                  onClick={() => setMenuOpen(false)}
                  className="fixed inset-0 z-40 cursor-default"
                />
                <div className="absolute left-0 top-full z-50 mt-1.5">
                  <InsertMenu
                    onPick={(label) => {
                      setMenuOpen(false);
                      onPickInsert?.(label);
                    }}
                  />
                </div>
              </>
            ) : null}
          </div>

          <button
            type="button"
            aria-label="Text"
            title="Text"
            className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            <Icon icon="ph:text-t" className="size-4" />
          </button>
        </div>
      </div>

      {/* Titel mittig */}
      <div className="flex flex-col items-center">
        <span className="text-sm font-semibold">{title}</span>
        <span className="text-[0.625rem] text-muted-foreground">
          /{slug || ""} · {published ? "veröffentlicht" : "Entwurf"}
        </span>
      </div>

      {/* Rechts: Device + Veröffentlichen */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5">
          {(["desktop", "tablet", "mobile"] as Device[]).map((d) => (
            <button
              key={d}
              type="button"
              aria-label={d}
              title={`${d} (${DEVICE_PX[d]}px Frame-Breite)`}
              onClick={() => onPickDevice?.(d)}
              className={
                "flex size-7 items-center justify-center rounded transition " +
                (device === d
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:bg-secondary/60")
              }
            >
              <Icon
                icon={
                  d === "desktop"
                    ? "ph:desktop"
                    : d === "tablet"
                      ? "ph:device-tablet"
                      : "ph:device-mobile"
                }
                className="size-4"
              />
            </button>
          ))}
        </div>
        <Button onClick={onSave} disabled={saving} size="sm" className="h-8">
          {saving ? "Speichern …" : "Veröffentlichen"}
        </Button>
      </div>
    </header>
  );
}
