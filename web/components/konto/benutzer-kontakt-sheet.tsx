"use client";

// Konto → Benutzer → Detailseite: Kontaktdaten bearbeiten.
//
// Vor-/Nachname sind hier ZWEI Felder, gespeichert wird ein `full_name` — so
// wie der Anlege-Wizard es auch macht. Warum nicht zwei Spalten: `users` trägt
// EINEN Namen, und jeder Weg (Registrierung, OAuth, Einladung, Portal) schreibt
// ihn. Zwei Spalten müssten überall mitgezogen werden und wären dort leer, wo
// der Name aus einem OAuth-Profil kommt („Susanne Marie Ravn" lässt sich nicht
// zuverlässig aufteilen). Die Aufteilung passiert daher nur für die EINGABE:
// letztes Wort = Nachname, der Rest = Vorname. Das ist umkehrbar und erfindet
// keine Struktur, die die Daten nicht haben.
//
// Die E-Mail ist das Login und wird hier NICHT geändert: sie ist der
// Wiederherstellungsweg des Kontos. Ein Wechsel läuft über den eigenen,
// abgesicherten Weg mit Doppel-Opt-in an die neue Adresse (Wurzel 7) — ihn hier
// als weiteres Textfeld zu wiederholen wäre eine zweite, ungesicherte Tür.
import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { Checkbox } from "@nextdays/ui/checkbox";
import { Input } from "@nextdays/ui/input";
import { Label } from "@nextdays/ui/label";
import { PhoneInput } from "@nextdays/ui/phone-input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@nextdays/ui/sheet";
import { type TenantUser, updateManagedUser } from "@/lib/account";

/** Anzeigename in Vor-/Nachname zerlegen (letztes Wort = Nachname). */
export function namenTeilen(fullName: string | null): {
  vorname: string;
  nachname: string;
} {
  const teile = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (teile.length === 0) return { vorname: "", nachname: "" };
  if (teile.length === 1) return { vorname: teile[0], nachname: "" };
  return {
    vorname: teile.slice(0, -1).join(" "),
    nachname: teile[teile.length - 1],
  };
}

export function BenutzerKontaktSheet({
  user,
  land,
  onClose,
}: {
  user: TenantUser;
  /** Land des Betriebs (ISO-2) — Vorbelegung der Vorwahl, kein Hardcode. */
  land: string | null;
  onClose: () => void;
}) {
  const t = useTranslations("account");
  const start = namenTeilen(user.full_name);
  const [vorname, setVorname] = useState(start.vorname);
  const [nachname, setNachname] = useState(start.nachname);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [phone2, setPhone2] = useState(user.additional_phone ?? "");
  const [hidePhones, setHidePhones] = useState(Boolean(user.hide_phones));
  const [busy, setBusy] = useState(false);

  async function speichern() {
    const name = `${vorname.trim()} ${nachname.trim()}`.trim();
    if (!name) {
      toast.error(t("userDetail.nameRequired"));
      return;
    }
    setBusy(true);
    // Telefonnummern IMMER mitschicken — auch leer. Ein weggelassenes Feld
    // heißt serverseitig „unverändert"; eine gelöschte Nummer käme also nie
    // weg (Wurzel 1: der Gegenzustand muss erreichbar sein).
    const res = await updateManagedUser(user.user_id, {
      full_name: name,
      phone: phone.trim(),
      additional_phone: phone2.trim(),
      hide_phones: hidePhones,
    });
    setBusy(false);
    if (res.ok) {
      toast.success(t("users.updated"));
      onClose();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex h-full w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle className="font-display text-lg font-extrabold">
            {t("userDetail.editContact")}
          </SheetTitle>
          <SheetDescription className="sr-only">
            {t("userDetail.editContact")}
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bk-first">
              {t("userWizard.firstName")}
              <span className="text-destructive"> *</span>
            </Label>
            <Input
              id="bk-first"
              value={vorname}
              onChange={(e) => setVorname(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bk-last">{t("userWizard.lastName")}</Label>
            <Input
              id="bk-last"
              value={nachname}
              onChange={(e) => setNachname(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bk-mail">{t("userWizard.email")}</Label>
            <Input id="bk-mail" value={user.email ?? ""} disabled />
            <p className="text-xs text-muted-foreground">
              {t("userDetail.emailLocked")}
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bk-phone">{t("userWizard.phone")}</Label>
            <PhoneInput
              id="bk-phone"
              value={phone}
              onChange={setPhone}
              defaultCountry={land ?? undefined}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bk-phone2">{t("userWizard.extraPhone")}</Label>
            <PhoneInput
              id="bk-phone2"
              value={phone2}
              onChange={setPhone2}
              defaultCountry={land ?? undefined}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={hidePhones}
              onCheckedChange={(v) => setHidePhones(Boolean(v))}
            />
            {t("userWizard.hidePhones")}
          </label>
        </div>

        <div className="flex items-center justify-end gap-3 border-t p-4">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t("userWizard.cancel")}
          </Button>
          <Button onClick={speichern} disabled={busy}>
            {busy ? t("userDetail.saving") : t("userDetail.save")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
