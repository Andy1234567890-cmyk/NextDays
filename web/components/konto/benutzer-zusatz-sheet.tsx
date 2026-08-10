"use client";

// Konto → Benutzer → Detailseite: „Zusätzliche Informationen" bearbeiten.
// Bevorzugte Sprache (= Sprache der E-Mails AN diese Person), gesprochene
// Sprachen und eine interne Anmerkung des Betriebs.
//
// Die Anmerkung ist bewusst intern: `public.users` ist für anon/authenticated
// gesperrt (Wurzel 6, Migration 0337/0356), sie erreicht also weder den
// Eigentümer selbst noch einen Gast. Sie geht auch in keine Mail.
import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { Label } from "@nextdays/ui/label";
import { Textarea } from "@nextdays/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@nextdays/ui/sheet";
import { SprachAuswahl } from "@/components/sprache-auswahl";
import { type TenantUser, updateManagedUser } from "@/lib/account";

import { GesprocheneSprachen } from "./gesprochene-sprachen";

export function BenutzerZusatzSheet({
  user,
  onClose,
}: {
  user: TenantUser;
  onClose: () => void;
}) {
  const t = useTranslations("account");
  // "" = noch nicht gesetzt. KEINE Vorbelegung auf die eigene
  // Oberflächensprache: das würde beim Speichern eine Sprache setzen, die
  // niemand gewählt hat (Wurzel 4).
  const [sprache, setSprache] = useState(user.preferred_language ?? "");
  const [gesprochen, setGesprochen] = useState<string[]>(
    user.spoken_languages ?? [],
  );
  const [notiz, setNotiz] = useState(user.notes ?? "");
  const [busy, setBusy] = useState(false);

  async function speichern() {
    setBusy(true);
    const res = await updateManagedUser(user.user_id, {
      // Leer heißt hier „nicht anfassen": eine erfasste Sprache soll nicht
      // durch das Öffnen des Dialogs verloren gehen. Das Löschen einer Sprache
      // ist kein Anwendungsfall — es gibt keinen Zustand „spricht keine".
      preferred_language: sprache || undefined,
      spoken_languages: gesprochen,
      notes: notiz.trim(),
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
            {t("userDetail.editExtra")}
          </SheetTitle>
          <SheetDescription className="sr-only">
            {t("userDetail.editExtra")}
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-5">
          <SprachAuswahl
            id="bz-lang"
            value={sprache}
            onChange={setSprache}
            label={t("users.emailLanguage")}
            hint={t("users.emailLanguageHint")}
            allowEmpty
          />

          <GesprocheneSprachen value={gesprochen} onChange={setGesprochen} />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bz-notes">{t("userWizard.notes")}</Label>
            <Textarea
              id="bz-notes"
              rows={4}
              value={notiz}
              onChange={(e) => setNotiz(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {t("userDetail.notesHint")}
            </p>
          </div>
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
