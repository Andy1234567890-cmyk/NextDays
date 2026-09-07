"use client";

// „Als Vorlage speichern" (ADR-0024): die Saisons + Zeiträume DIESES Objekts
// werden zur tenant-weiten Saison-Vorlage, die sich unter
// /einstellungen/saison-vorlagen auf beliebig viele Objekte anwenden lässt.
// Gleicher Vorlagenname → die Vorlage wird aktualisiert (Wurzel 2).
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@nextdays/ui/dialog";
import { Input } from "@nextdays/ui/input";
import { Label } from "@nextdays/ui/label";
import { saveSeasonTemplateFromProperty } from "@/lib/calendar";

export function AlsVorlageSpeichern({
  propertyId,
  disabled,
}: {
  propertyId: string;
  /** Ohne Saisons gibt es nichts zu sichern — der Server antwortet 422. */
  disabled: boolean;
}) {
  const t = useTranslations("kalender.vorlagen");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!name.trim()) {
      toast.error(t("nameFehlt"));
      return;
    }
    setSaving(true);
    const res = await saveSeasonTemplateFromProperty({
      property_id: propertyId,
      name: name.trim(),
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(t("ausObjektGespeichert", { name: res.data.name }));
    setName("");
    setOpen(false);
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="w-full gap-1.5"
        disabled={disabled}
        title={disabled ? t("ausObjektOhneSaisons") : undefined}
        onClick={() => setOpen(true)}
      >
        <Icon icon="ph:bookmark-simple" className="size-4" />
        {t("ausObjektKnopf")}
      </Button>
      {open && (
        <Dialog open onOpenChange={(o) => !o && setOpen(false)}>
          <DialogContent>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <DialogTitle>{t("ausObjektTitel")}</DialogTitle>
                <DialogDescription>{t("ausObjektHinweis")}</DialogDescription>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="vorlage-name">{t("name")}</Label>
                <Input
                  id="vorlage-name"
                  value={name}
                  placeholder={t("namePlatzhalter")}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {t("ausObjektVerwaltenPrefix")}
                <Link href="/einstellungen/saison-vorlagen" className="underline underline-offset-4">
                  {t("ausObjektVerwaltenLink")}
                </Link>
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
                  {t("abbrechen")}
                </Button>
                <Button onClick={submit} disabled={saving}>
                  {saving ? t("speichert") : t("speichern")}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
