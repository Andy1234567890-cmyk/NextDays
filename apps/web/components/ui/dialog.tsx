// Modal-Dialog (shadcn-Stil) auf Basis von @radix-ui/react-dialog.
// Icons via Iconify — niemals lucide-react (PROJECT.md §2).
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Icon } from "@iconify/react";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

// Wurzel-Komponente: steuert offen/geschlossen.
const Dialog = DialogPrimitive.Root;

// Element, das den Dialog öffnet.
const DialogTrigger = DialogPrimitive.Trigger;

// Portal rendert Overlay + Content außerhalb des DOM-Baums.
const DialogPortal = DialogPrimitive.Portal;

// Element, das den Dialog schließt (z. B. Abbrechen-Button).
const DialogClose = DialogPrimitive.Close;

// Abdunkelnder Hintergrund hinter dem Dialog.
function DialogOverlay({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      className={cn(
        "fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
        className,
      )}
      {...props}
    />
  );
}

// Inhalts-Container: zentriert, mit eingebautem Schließen-Button (Iconify).
function DialogContent({
  className,
  children,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 border border-border bg-background p-6 shadow-lg rounded-(--radius) data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-(--radius) text-muted-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none"
          aria-label="Schließen"
        >
          <Icon icon="ph:x" className="h-4 w-4" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

// Kopfbereich: Titel + Beschreibung, mobil zentriert.
function DialogHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 text-center sm:text-left",
        className,
      )}
      {...props}
    />
  );
}

// Fußbereich: Aktionen, auf Desktop rechtsbündig.
function DialogFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}

// Überschrift des Dialogs.
function DialogTitle({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn(
        "text-lg font-semibold leading-none tracking-tight text-foreground",
        className,
      )}
      {...props}
    />
  );
}

// Erläuternder Text unter dem Titel.
function DialogDescription({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogClose,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
