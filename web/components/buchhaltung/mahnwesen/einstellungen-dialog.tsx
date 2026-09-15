"use client";

// Einstellungen des Mahnwesens: drei Stufen (Frist, Gebühr, Titel, Text),
// Verzugszinssatz, Schalter für den Überfälligkeits-Lauf. Alle Felder Pflicht —
// der Server kennt keinen Ersatzwert (0641, Wurzel 4). Hilfetexte NUR im ℹ.
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@nextdays/ui/dialog";
import { InfoHinweis } from "@nextdays/ui/info-hinweis";
import { Input } from "@nextdays/ui/input";
import { Label } from "@nextdays/ui/label";
import { Switch } from "@nextdays/ui/switch";
import { Textarea } from "@nextdays/ui/textarea";
import { saveReminderSettings } from "@/lib/buchhaltung-mahnwesen";
import type {
  ReminderLevel,
  ReminderSettings,
  StufenEinstellung,
} from "@/lib/buchhaltung-mahnwesen-typen";

type StufeForm = { days: string; fee: string; title: string; text: string };
const LEVELS: readonly ReminderLevel[] = [1, 2, 3];

function ausSettings(s: StufenEinstellung | null): StufeForm {
  return {
    days: s ? String(s.days) : "",
    fee: s?.fee ?? "",
    title: s?.title ?? "",
    text: s?.text ?? "",
  };
}

export function EinstellungenDialog({
  settings,
  open,
  onClose,
}: {
  settings: ReminderSettings | null;
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("finance");
  const router = useRouter();
  const [stufen, setStufen] = useState<Record<ReminderLevel, StufeForm>>({
    1: ausSettings(settings?.level1 ?? null),
    2: ausSettings(settings?.level2 ?? null),
    3: ausSettings(settings?.level3 ?? null),
  });
  const [zins, setZins] = useState(settings?.interestRate ?? "");
  const [auto, setAuto] = useState(settings?.autoMarkOverdue ?? false);
  const [pending, setPending] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const setFeld = (lvl: ReminderLevel, feld: keyof StufeForm, wert: string) =>
    setStufen((alt) => ({ ...alt, [lvl]: { ...alt[lvl], [feld]: wert } }));

  const vollstaendig =
    zins.trim() !== "" &&
    LEVELS.every((l) => stufen[l].days.trim() !== "" && stufen[l].fee.trim() !== "" && stufen[l].title.trim() !== "");

  async function speichern() {
    setPending(true);
    setFehler(null);
    const stufe = (l: ReminderLevel): StufenEinstellung => ({
      days: Number(stufen[l].days),
      fee: stufen[l].fee.replace(",", "."),
      title: stufen[l].title.trim(),
      text: stufen[l].text.trim() || null,
    });
    const res = await saveReminderSettings({
      level1: stufe(1),
      level2: stufe(2),
      level3: stufe(3),
      interestRate: zins.replace(",", "."),
      autoMarkOverdue: auto,
    });
    setPending(false);
    if (!res.ok) {
      setFehler(res.error);
      toast.error(t("mahnwesenPage.saveError"));
      return;
    }
    toast.success(t("mahnwesenPage.saved"));
    router.refresh();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogTitle>{t("mahnwesenPage.settingsTitle")}</DialogTitle>
        <DialogDescription>{t("mahnwesenPage.settingsDescription")}</DialogDescription>

        <div className="mt-4 flex flex-col gap-6">
          {LEVELS.map((lvl) => (
            <StufenFelder key={lvl} lvl={lvl} stufe={stufen[lvl]} setFeld={setFeld} />
          ))}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="zins" className="flex items-center gap-1">
                {t("mahnwesenPage.interestRate")}
                <InfoHinweis
                  text={t("mahnwesenPage.interestRateHint")}
                  ariaLabel={t("mahnwesenPage.interestRateHintAria")}
                />
              </Label>
              <Input
                id="zins"
                inputMode="decimal"
                value={zins}
                onChange={(e) => setZins(e.target.value)}
              />
            </div>
            <div className="flex items-end justify-between gap-3 rounded-2xl border border-border p-3">
              <Label htmlFor="auto" className="flex items-center gap-1">
                {t("mahnwesenPage.autoMarkOverdue")}
                <InfoHinweis
                  text={t("mahnwesenPage.autoMarkOverdueHint")}
                  ariaLabel={t("mahnwesenPage.autoMarkOverdueHintAria")}
                />
              </Label>
              <Switch id="auto" checked={auto} onCheckedChange={setAuto} />
            </div>
          </div>

          {fehler && <p className="text-sm text-destructive">{fehler}</p>}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={pending}>
            {t("mahnwesenPage.cancel")}
          </Button>
          <Button onClick={speichern} disabled={pending || !vollstaendig}>
            {pending ? t("mahnwesenPage.saving") : t("mahnwesenPage.save")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Die Felder EINER Mahnstufe: Frist, Gebühr, Überschrift und Text. */
function StufenFelder({
  lvl,
  stufe,
  setFeld,
}: {
  lvl: ReminderLevel;
  stufe: StufeForm;
  setFeld: (lvl: ReminderLevel, feld: keyof StufeForm, wert: string) => void;
}) {
  const t = useTranslations("finance");
  return (
                  <fieldset key={lvl} className="rounded-2xl border border-border p-4">
            <legend className="px-2 text-sm font-semibold">
              {t("mahnwesenPage.level", { level: lvl })}
            </legend>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor={`days-${lvl}`} className="flex items-center gap-1">
                  {t("mahnwesenPage.days")}
                  <InfoHinweis
                    text={t("mahnwesenPage.daysHint")}
                    ariaLabel={t("mahnwesenPage.daysHintAria")}
                  />
                </Label>
                <Input
                  id={`days-${lvl}`}
                  type="number"
                  min={0}
                  max={365}
                  inputMode="numeric"
                  value={stufe.days}
                  onChange={(e) => setFeld(lvl, "days", e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor={`fee-${lvl}`} className="flex items-center gap-1">
                  {t("mahnwesenPage.fee")}
                  <InfoHinweis
                    text={t("mahnwesenPage.feeHint")}
                    ariaLabel={t("mahnwesenPage.feeHintAria")}
                  />
                </Label>
                <Input
                  id={`fee-${lvl}`}
                  inputMode="decimal"
                  value={stufe.fee}
                  onChange={(e) => setFeld(lvl, "fee", e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor={`title-${lvl}`}>{t("mahnwesenPage.titleField")}</Label>
                <Input
                  id={`title-${lvl}`}
                  maxLength={120}
                  value={stufe.title}
                  onChange={(e) => setFeld(lvl, "title", e.target.value)}
                />
              </div>
            </div>
            <div className="mt-3 flex flex-col gap-1">
              <Label htmlFor={`text-${lvl}`}>{t("mahnwesenPage.textField")}</Label>
              <Textarea
                id={`text-${lvl}`}
                maxLength={4000}
                rows={3}
                value={stufe.text}
                onChange={(e) => setFeld(lvl, "text", e.target.value)}
              />
            </div>
          </fieldset>
  );
}
