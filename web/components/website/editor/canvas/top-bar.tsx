"use client";

// Obere Toolbar (Framer-Stil): Zurück, Canvas-Chip, Werkzeuge („+" wechselt die
// Sidebar in den Insert-Modus, Auswahl öffnet das Einfügen-Menü), Titel mittig,
// rechts Device-Umschalter + Veröffentlichen.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import Link from "next/link";

import { Button } from "@nextdays/ui/button";
import type { Page } from "@/lib/site-pages";

import { InsertMenu } from "../insert-panel";
import { ToolBtn } from "./chrome";

export type Device = "desktop" | "tablet" | "mobile";

// Device-Umschalter setzt die Frame-Breite (danach frei ziehbar).
export const DEVICE_PX: Record<Device, number> = { desktop: 1200, tablet: 810, mobile: 390 };

export function EditorTopBar({
  page,
  insertOpen,
  onToggleInsert,
  insertMenuOpen,
  onToggleInsertMenu,
  onCloseInsertMenu,
  onDraw,
  device,
  onPickDevice,
  saving,
  onSave,
}: {
  page: Page;
  insertOpen: boolean;
  onToggleInsert: () => void;
  insertMenuOpen: boolean;
  onToggleInsertMenu: () => void;
  onCloseInsertMenu: () => void;
  onDraw: () => void;
  device: Device;
  onPickDevice: (d: Device) => void;
  saving: boolean;
  onSave: () => void;
}) {
  const t = useTranslations("website");
  return (
    <header className="flex h-12 items-center justify-between gap-3 border-b border-border px-3">
      <div className="flex items-center gap-2">
        <Link href="/website">
          <Button variant="ghost" size="icon" className="size-8">
            <Icon icon="ph:arrow-left" className="size-4" />
          </Button>
        </Link>
        <span className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium">
          <Icon icon="ph:browser" className="size-3.5 text-primary" />
          Canvas
          <Icon icon="ph:caret-down" className="size-3 text-muted-foreground" />
        </span>
        {/* Werkzeuge — „+" öffnet das Insert-Panel */}
        <div className="ml-1 flex items-center gap-0.5">
          <button
            type="button"
            aria-label={t("editor.addBlock")}
            title={t("editor.addBlock")}
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
          {/* Auswahl-Werkzeug öffnet das Insert-Menü (Frame/Stack/… wie Framer). */}
          <div className="relative">
            <button
              type="button"
              aria-label={t("editor.insert")}
              title={t("editor.insert")}
              onClick={onToggleInsertMenu}
              className={
                "flex size-8 items-center justify-center rounded-md transition " +
                (insertMenuOpen
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground")
              }
            >
              <Icon icon="ph:selection" className="size-4" />
            </button>
            {insertMenuOpen ? (
              <>
                {/* Klick daneben schließt das Menü. */}
                <button
                  type="button"
                  aria-label={t("editor.closeMenu")}
                  onClick={onCloseInsertMenu}
                  className="fixed inset-0 z-40 cursor-default"
                />
                <div className="absolute left-0 top-full z-50 mt-1.5">
                  <InsertMenu onClose={onCloseInsertMenu} onDraw={onDraw} />
                </div>
              </>
            ) : null}
          </div>
          <ToolBtn icon="ph:text-t" label="Text" />
        </div>
      </div>

      {/* Titel mittig */}
      <div className="flex flex-col items-center">
        <span className="text-sm font-semibold">{page.title}</span>
        <span className="text-[0.625rem] text-muted-foreground">
          /{page.slug || ""} · {page.is_published ? "veröffentlicht" : "Entwurf"}
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
              onClick={() => onPickDevice(d)}
              className={
                "flex size-7 items-center justify-center rounded transition " +
                (device === d ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60")
              }
            >
              <Icon
                icon={d === "desktop" ? "ph:desktop" : d === "tablet" ? "ph:device-tablet" : "ph:device-mobile"}
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
