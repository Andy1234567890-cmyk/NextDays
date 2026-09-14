"use client";

// Kleiner Bestätigungsdialog für Löschen/Deaktivieren im Kontenplan —
// statt `window.confirm`, damit Text, Tasten und Fokus zum Rest passen.
import { Button } from "@nextdays/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@nextdays/ui/dialog";

export function BestaetigenDialog({
  open,
  titel,
  text,
  bestaetigen,
  abbrechen,
  busy,
  onBestaetigen,
  onClose,
}: {
  open: boolean;
  titel: string;
  text: string;
  bestaetigen: string;
  abbrechen: string;
  busy?: boolean;
  onBestaetigen: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogTitle className="font-display text-lg font-extrabold">{titel}</DialogTitle>
        <DialogDescription>{text}</DialogDescription>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {abbrechen}
          </Button>
          <Button variant="destructive" onClick={onBestaetigen} disabled={busy}>
            {bestaetigen}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
