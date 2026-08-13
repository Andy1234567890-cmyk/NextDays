"use client";

// Schublade „Gast bearbeiten" (Lodgify-Gleichzug): Name, Kontakt, Sprache,
// Land und die ERWARTETEN Check-in-/Check-out-Zeiten dieser Buchung.
//
// Wirkt ausschließlich auf die Buchung — die Gästekartei (`guests`) bleibt
// unberührt. Sonst würde eine Tippfehler-Korrektur an EINER Buchung die
// Stammdaten des Gastes und damit die Historie aller seiner Buchungen
// umschreiben. Die Zeiten sind Erwartungswerte, keine Check-in-Tatsachen:
// `checked_in_at` bleibt davon unberührt (0091).
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";
import { Label } from "@nextdays/ui/label";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@nextdays/ui/sheet";
import { updateReservationGuest } from "@/lib/reservations";

export type GuestSheetValues = {
  guest_name: string;
  guest_email: string | null;
  guest_phone: string | null;
  guest_language: string | null;
  guest_country: string | null;
  checkin_time: string | null;
  checkout_time: string | null;
};

export function BookingGuestSheet({
  reservationId,
  values,
  open,
  onClose,
  onSaved,
}: {
  reservationId: string;
  values: GuestSheetValues;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("reservations");
  const [form, setForm] = useState<GuestSheetValues>(values);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setzen = (feld: keyof GuestSheetValues, wert: string) =>
    setForm((f) => ({ ...f, [feld]: wert }));

  const speichern = async () => {
    setBusy(true);
    setError(null);
    const res = await updateReservationGuest(reservationId, {
      guest_name: form.guest_name.trim(),
      guest_email: form.guest_email,
      guest_phone: form.guest_phone,
      guest_language: form.guest_language,
      guest_country: form.guest_country,
      // Leere Zeit = „keine Erwartung hinterlegt", nicht 00:00.
      checkin_time: form.checkin_time || null,
      checkout_time: form.checkout_time || null,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      console.debug("[BookingGuestSheet] Speichern fehlgeschlagen:", res.error);
      return;
    }
    console.debug("[BookingGuestSheet] gespeichert", reservationId);
    onSaved();
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t("guestSheet.title")}</SheetTitle>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4">
          <Feld
            id="guest-name"
            label={t("guestSheet.name")}
            required
            value={form.guest_name}
            onChange={(v) => setzen("guest_name", v)}
          />
          <Feld
            id="guest-email"
            label={t("guestSheet.email")}
            type="email"
            value={form.guest_email ?? ""}
            onChange={(v) => setzen("guest_email", v)}
          />
          <Feld
            id="guest-phone"
            label={t("guestSheet.phone")}
            type="tel"
            value={form.guest_phone ?? ""}
            onChange={(v) => setzen("guest_phone", v)}
          />
          <Feld
            id="guest-language"
            label={t("guestSheet.language")}
            value={form.guest_language ?? ""}
            onChange={(v) => setzen("guest_language", v)}
          />
          <Feld
            id="guest-country"
            label={t("guestSheet.country")}
            value={form.guest_country ?? ""}
            onChange={(v) => setzen("guest_country", v)}
          />
          <Feld
            id="guest-checkin"
            label={t("guestSheet.checkinTime")}
            type="time"
            value={form.checkin_time ?? ""}
            onChange={(v) => setzen("checkin_time", v)}
          />
          <Feld
            id="guest-checkout"
            label={t("guestSheet.checkoutTime")}
            type="time"
            value={form.checkout_time ?? ""}
            onChange={(v) => setzen("checkout_time", v)}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <SheetFooter className="flex-row justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            {t("guestSheet.cancel")}
          </Button>
          <Button
            type="button"
            onClick={speichern}
            disabled={busy || !form.guest_name.trim()}
          >
            {busy ? t("guestSheet.saving") : t("guestSheet.confirm")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function Feld({
  id,
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
