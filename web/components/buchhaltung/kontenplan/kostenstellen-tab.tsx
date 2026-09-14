"use client";

// Kontenplan → Kostenstellen: Liste, Anlegen/Bearbeiten im Sheet, Löschen.
// Kein Realtime (`cost_centers` gesperrt, 0672) — `router.refresh()`.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import { EmptyState } from "@nextdays/ui/empty-state";
import { Input } from "@nextdays/ui/input";
import { Label } from "@nextdays/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@nextdays/ui/sheet";
import { Switch } from "@nextdays/ui/switch";
import { createCostCenter, deleteCostCenter, updateCostCenter } from "@/lib/buchhaltung-kontenplan";
import type { CostCenter } from "@/lib/buchhaltung-kontenplan-typen";

import { BestaetigenDialog } from "./bestaetigen-dialog";

type Formular = { number: string; name: string; description: string; active: boolean };
const LEER: Formular = { number: "", name: "", description: "", active: true };

export function KostenstellenTab({ costCenters }: { costCenters: CostCenter[] }) {
  const t = useTranslations("finance");
  const router = useRouter();
  const [sheet, setSheet] = useState<{ offen: boolean; ks: CostCenter | null }>({ offen: false, ks: null });
  const [form, setForm] = useState<Formular>(LEER);
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [loeschen, setLoeschen] = useState<CostCenter | null>(null);

  function oeffnen(ks: CostCenter | null) {
    setFehler(null);
    setForm(ks ? { number: ks.number, name: ks.name, description: ks.description ?? "", active: ks.active } : LEER);
    setSheet({ offen: true, ks });
  }

  async function speichern() {
    setBusy(true);
    setFehler(null);
    const body = {
      number: form.number.trim(),
      name: form.name.trim(),
      description: form.description.trim() || null,
      active: form.active,
    };
    const res = sheet.ks ? await updateCostCenter(sheet.ks.id, body) : await createCostCenter(body);
    setBusy(false);
    if (!res.ok) {
      setFehler(res.error);
      return;
    }
    toast.success(sheet.ks ? t("kontenplanPage.saved") : t("kontenplanPage.created"));
    setSheet({ offen: false, ks: null });
    router.refresh();
  }

  async function wirklichLoeschen() {
    if (!loeschen) return;
    setBusy(true);
    const res = await deleteCostCenter(loeschen.id);
    setBusy(false);
    setLoeschen(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(t("kontenplanPage.deleted"));
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button className="gap-2" onClick={() => oeffnen(null)}>
          <Icon icon="ph:plus" className="size-4" />
          {t("kontenplanPage.newCostCenter")}
        </Button>
      </div>
      {costCenters.length === 0 ? (
        <EmptyState
          icon="ph:squares-four"
          titel={t("kontenplanPage.emptyCostCentersTitle")}
          text={t("kontenplanPage.emptyCostCentersText")}
          aktion={
            <Button className="gap-2" onClick={() => oeffnen(null)}>
              <Icon icon="ph:plus" className="size-4" />
              {t("kontenplanPage.newCostCenter")}
            </Button>
          }
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-secondary/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">{t("kontenplanPage.columnNumber")}</th>
                <th className="px-4 py-3 font-medium">{t("kontenplanPage.columnName")}</th>
                <th className="px-4 py-3 font-medium">{t("kontenplanPage.columnDescription")}</th>
                <th className="px-4 py-3 font-medium">{t("kontenplanPage.columnStatus")}</th>
                <th className="px-4 py-3 text-right font-medium">{t("kontenplanPage.columnActions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {costCenters.map((ks) => (
                <tr key={ks.id} className={`transition-colors hover:bg-secondary/30 ${ks.active ? "" : "text-muted-foreground"}`}>
                  <td className="px-4 py-3 font-mono">{ks.number}</td>
                  <td className="px-4 py-3 font-medium">{ks.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{ks.description || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${ks.active ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300" : "bg-muted text-muted-foreground"}`}>
                      {ks.active ? t("kontenplanPage.active") : t("kontenplanPage.inactive")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" onClick={() => oeffnen(ks)} aria-label={t("kontenplanPage.edit")}>
                      <Icon icon="ph:pencil-simple" className="size-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setLoeschen(ks)} aria-label={t("kontenplanPage.delete")}>
                      <Icon icon="ph:trash" className="size-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Sheet open={sheet.offen} onOpenChange={(o) => !o && setSheet({ offen: false, ks: null })}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
          <SheetHeader className="border-b">
            <SheetTitle className="font-display text-lg font-extrabold">
              {sheet.ks ? t("kontenplanPage.editCostCenter") : t("kontenplanPage.newCostCenter")}
            </SheetTitle>
            <SheetDescription>{t("kontenplanPage.costCenterSheetDescription")}</SheetDescription>
          </SheetHeader>
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ks-number">{t("kontenplanPage.columnNumber")}</Label>
                <Input id="ks-number" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} />
              </div>
              <div className="col-span-2 flex flex-col gap-1.5">
                <Label htmlFor="ks-name">{t("kontenplanPage.columnName")}</Label>
                <Input id="ks-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ks-desc">{t("kontenplanPage.columnDescription")}</Label>
              <Input id="ks-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="flex items-center justify-between rounded-(--radius) border px-3 py-2">
              <Label htmlFor="ks-active">{t("kontenplanPage.active")}</Label>
              <Switch id="ks-active" checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
            </div>
            {fehler && <p className="text-sm text-destructive">{fehler}</p>}
          </div>
          <SheetFooter className="border-t">
            <Button variant="outline" onClick={() => setSheet({ offen: false, ks: null })}>
              {t("kontenplanPage.cancel")}
            </Button>
            <Button onClick={speichern} disabled={busy || !form.name.trim() || !form.number.trim()}>
              {busy ? t("kontenplanPage.saving") : t("kontenplanPage.save")}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <BestaetigenDialog
        open={loeschen !== null}
        titel={t("kontenplanPage.deleteCostCenterTitle")}
        text={t("kontenplanPage.deleteCostCenterText", { number: loeschen?.number ?? "" })}
        bestaetigen={t("kontenplanPage.delete")}
        abbrechen={t("kontenplanPage.cancel")}
        busy={busy}
        onBestaetigen={wirklichLoeschen}
        onClose={() => setLoeschen(null)}
      />
    </div>
  );
}
