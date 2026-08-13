"use client";

// Schublade „Notiz bearbeiten" (Lodgify-Gleichzug). Bewusst ein reines
// Textfeld, kein Rich-Text: `reservations.note` ist eine Text-Spalte, die an
// mehreren Stellen als Klartext gerendert wird (Detail, Kalender-Slider,
// Zeitleiste). HTML hineinzuschreiben, machte aus jeder dieser Stellen einen
// HTML-Sink, der serverseitig sanitisiert werden müsste (Wurzel 8) — dafür ist
// eine interne Notiz der falsche Anlass.
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@nextdays/ui/button";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@nextdays/ui/sheet";
import { Textarea } from "@nextdays/ui/textarea";
import { updateReservationNote } from "@/lib/reservations";

export function BookingNoteSheet({
  reservationId,
  note,
  open,
  onClose,
  onSaved,
}: {
  reservationId: string;
  note: string | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("reservations");
  const [text, setText] = useState(note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const speichern = async () => {
    setBusy(true);
    setError(null);
    const res = await updateReservationNote(reservationId, text);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      console.debug("[BookingNoteSheet] Speichern fehlgeschlagen:", res.error);
      return;
    }
    console.debug("[BookingNoteSheet] gespeichert", reservationId, {
      leer: !text.trim(),
    });
    onSaved();
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t("noteSheet.title")}</SheetTitle>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-4">
          <Textarea
            autoFocus
            rows={10}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("noteSheet.placeholder")}
          />
          <p className="text-xs text-muted-foreground">
            {t("noteSheet.hint")}
          </p>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <SheetFooter className="flex-row justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            {t("noteSheet.cancel")}
          </Button>
          <Button type="button" onClick={speichern} disabled={busy}>
            {busy ? t("noteSheet.saving") : t("noteSheet.save")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
