"use client";

// shadcn-Dialog (zentriertes Modal-Popup), auf Projekt-Standard umgestellt:
// Icons via Iconify (ph:*) — niemals lucide-react (PROJECT.md §2). Gleiches
// Radix-Fundament wie sheet.tsx, aber mittig statt seitlich.
import { Icon } from "@iconify/react"
import * as React from "react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { cn } from "./utils"

function Dialog({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

// Ein Dialog ist eine SPALTE aus Kopf, scrollendem Mittelteil und Fuss —
// deshalb ist `flex flex-col` hier Grundausstattung und keine Zutat, die jeder
// Aufrufer selbst mitbringt. Vorher war das Element `display: block`: ein Kind
// mit `flex-1 min-h-0` bekam dadurch KEINE Hoehe vom Elternteil und wuchs auf
// seine Inhaltshoehe. Real gemessen im Ankuendigungs-Popup bei 700px Fenster:
// die Inhaltsflaeche wurde 2826px hoch, der Bestaetigungsknopf landete bei
// y=2837 — weit ausserhalb des Bildes. Sichtbar war davon nichts, weil
// `overflow-hidden` den Ueberstand abschnitt: der Dialog SAH heil aus, der
// einzige Ausweg war aber unerreichbar (Sackgasse).
//
// `max-h-[90dvh]` als Vorgabe an derselben Stelle, denn nur wo die Hoehe
// begrenzt ist, kann ein Kind ueberhaupt scrollen. `dvh` statt `vh`, weil `vh`
// die eingeblendete Mobil-Browserleiste mitzaehlt und den Fuss aus dem Fenster
// schiebt.
//
// `overflow-y-auto` und NICHT `overflow-hidden`: die meisten Dialoge bringen
// keinen eigenen Scrollbereich mit (geprueft: 15 Aufrufer, 3 davon ohne). Bei
// `hidden` wuerde deren Inhalt oberhalb von 90dvh einfach abgeschnitten — samt
// Fusszeile. Das waere genau der Fehler, den diese Aenderung beheben soll, nur
// an anderer Stelle. Mit `auto` bleibt im schlimmsten Fall alles erreichbar.
// Dialoge MIT eigenem Scrollbereich (Kopf/Mitte/Fuss) setzen selbst
// `overflow-hidden` — `cn`/twMerge laesst die Klasse des Aufrufers gewinnen.
//
// Fuer solche Dialoge gilt am scrollenden Kind: `min-h-0` ist Pflicht, sonst
// ist dessen Default-Mindesthoehe `auto` = Inhaltshoehe und es schrumpft nie.
function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        data-slot="dialog-overlay"
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
      />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "fixed left-1/2 top-1/2 z-50 flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col overflow-y-auto rounded-3xl bg-background p-6 shadow-xl focus:outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            className="absolute right-5 top-5 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Icon icon="ph:x" className="size-5" />
            <span className="sr-only">Schließen</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "font-display text-2xl font-semibold tracking-tight text-foreground",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogDescription,
}
