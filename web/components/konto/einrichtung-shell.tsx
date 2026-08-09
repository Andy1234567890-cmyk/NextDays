"use client";

// Gemeinsames Sheet-Gerüst der Einrichtungs-Assistenten (TOTP, SMS, Passkey).
// Liegt bewusst getrennt, damit alle Assistenten identisch aussehen und
// dieselbe Fokus-/Schließ-Logik erben.
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@nextdays/ui/sheet";

export function EinrichtungShell({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-display text-xl font-extrabold">
            {title}
          </SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <div className="flex flex-col gap-4 p-4">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
