"use client";

// Kategorien-Verwaltung der Ausgaben (Dialog): Liste, Anlegen, Umbenennen,
// Buchungskonto, Deaktivieren, Löschen. Das alte NewCategoryModal konnte
// eingeben, aber nie speichern (POST lief in 404) — hier gibt es den Endpunkt.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@nextdays/ui/dialog";
import { Input } from "@nextdays/ui/input";
import { Label } from "@nextdays/ui/label";
import { NativeSelect } from "@nextdays/ui/native-select";
import {
  createExpenseCategory,
  deleteExpenseCategory,
  updateExpenseCategory,
} from "@/lib/buchhaltung-ausgaben";
import type { CategoryKind, ExpenseCategory } from "@/lib/buchhaltung-ausgaben-typen";
import { CATEGORY_KINDS } from "@/lib/buchhaltung-ausgaben-typen";

type Entwurf = { name: string; kind: CategoryKind; bookingAccount: string; color: string };
const LEER: Entwurf = { name: "", kind: "betrieb", bookingAccount: "", color: "#6b7280" };

export function KategorienDialog({
  open,
  onOpenChange,
  categories,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: ExpenseCategory[];
}) {
  const t = useTranslations("finance");
  const router = useRouter();
  const [entwurf, setEntwurf] = useState<Entwurf>(LEER);
  const [bearbeitet, setBearbeitet] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  const zuruecksetzen = () => {
    setEntwurf(LEER);
    setBearbeitet(null);
  };

  const speichern = async () => {
    if (!entwurf.name.trim()) return;
    setLaeuft(true);
    const input = {
      name: entwurf.name.trim(),
      kind: entwurf.kind,
      bookingAccount: entwurf.bookingAccount.trim() || null,
      color: entwurf.color || null,
    };
    const res = bearbeitet
      ? await updateExpenseCategory(bearbeitet, input)
      : await createExpenseCategory(input);
    setLaeuft(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(t("ausgabenPage.categorySaved"));
    zuruecksetzen();
    router.refresh();
  };

  const loeschen = async (c: ExpenseCategory) => {
    if (!window.confirm(t("ausgabenPage.categoryDeleteConfirm", { name: c.name }))) return;
    const res = await deleteExpenseCategory(c.id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(t("ausgabenPage.categoryDeleted"));
    router.refresh();
  };

  const umschalten = async (c: ExpenseCategory) => {
    const res = await updateExpenseCategory(c.id, { isActive: !c.isActive });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) zuruecksetzen(); onOpenChange(o); }}>
      <DialogContent className="max-w-2xl">
        <DialogTitle>{t("ausgabenPage.categoriesTitle")}</DialogTitle>
        <DialogDescription>{t("ausgabenPage.categoriesSubtitle")}</DialogDescription>

        <div className="mt-2 grid grid-cols-1 gap-3 rounded-(--radius) border border-border p-3 sm:grid-cols-[1fr_10rem_8rem_3.5rem]">
          <div className="flex flex-col gap-1.5">
            <Label>{t("ausgabenPage.categoryName")}</Label>
            <Input value={entwurf.name} onChange={(e) => setEntwurf((p) => ({ ...p, name: e.target.value }))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("ausgabenPage.categoryKind")}</Label>
            <NativeSelect value={entwurf.kind} onChange={(e) => setEntwurf((p) => ({ ...p, kind: e.target.value as CategoryKind }))}>
              {CATEGORY_KINDS.map((k) => (
                <option key={k} value={k}>{t(`ausgabenPage.kind_${k}`)}</option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("ausgabenPage.fieldBookingAccount")}</Label>
            <Input value={entwurf.bookingAccount} maxLength={20} onChange={(e) => setEntwurf((p) => ({ ...p, bookingAccount: e.target.value }))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("ausgabenPage.categoryColor")}</Label>
            <input
              type="color"
              aria-label={t("ausgabenPage.categoryColor")}
              value={entwurf.color}
              onChange={(e) => setEntwurf((p) => ({ ...p, color: e.target.value }))}
              className="h-10 w-full cursor-pointer rounded-(--radius) border border-border bg-background p-1"
            />
          </div>
          <div className="flex items-center justify-end gap-2 sm:col-span-4">
            {bearbeitet && (
              <Button type="button" variant="ghost" size="sm" onClick={zuruecksetzen}>
                {t("ausgabenPage.cancel")}
              </Button>
            )}
            <Button type="button" size="sm" onClick={speichern} disabled={laeuft || !entwurf.name.trim()}>
              {laeuft && <Icon icon="ph:circle-notch" className="size-4 animate-spin" />}
              {bearbeitet ? t("ausgabenPage.save") : t("ausgabenPage.categoryAdd")}
            </Button>
          </div>
        </div>

        {categories.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t("ausgabenPage.categoriesEmpty")}</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {categories.map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: c.color ?? "#6b7280" }} />
                <span className={`flex-1 truncate ${c.isActive ? "" : "text-muted-foreground line-through"}`}>
                  {c.name}
                </span>
                <span className="hidden text-xs text-muted-foreground sm:inline">{t(`ausgabenPage.kind_${c.kind}`)}</span>
                <span className="hidden w-16 text-xs text-muted-foreground sm:inline">{c.bookingAccount ?? "—"}</span>
                <Button type="button" variant="ghost" size="sm" aria-label={t("ausgabenPage.edit")}
                  onClick={() => { setBearbeitet(c.id); setEntwurf({ name: c.name, kind: c.kind, bookingAccount: c.bookingAccount ?? "", color: c.color ?? "#6b7280" }); }}>
                  <Icon icon="ph:pencil-simple" className="size-4" />
                </Button>
                <Button type="button" variant="ghost" size="sm" aria-label={c.isActive ? t("ausgabenPage.deactivate") : t("ausgabenPage.activate")} onClick={() => umschalten(c)}>
                  <Icon icon={c.isActive ? "ph:eye-slash" : "ph:eye"} className="size-4" />
                </Button>
                <Button type="button" variant="ghost" size="sm" aria-label={t("ausgabenPage.delete")} onClick={() => loeschen(c)}>
                  <Icon icon="ph:trash" className="size-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
