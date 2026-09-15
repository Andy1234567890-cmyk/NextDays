"use client";

// Kontenplan → Zahlungsarten: Liste, Anlegen/Bearbeiten im Sheet, Standard
// setzen, Löschen. Zahlungsziel ohne Vorgabe (Wurzel 4: leer = nicht gesetzt).
// Kein Realtime (`payment_methods` gesperrt, 0673) — `router.refresh()`.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import { EmptyState } from "@nextdays/ui/empty-state";
import { InfoHinweis } from "@nextdays/ui/info-hinweis";
import { Input } from "@nextdays/ui/input";
import { Label } from "@nextdays/ui/label";
import { NativeSelect } from "@nextdays/ui/native-select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@nextdays/ui/sheet";
import { Switch } from "@nextdays/ui/switch";
import {
  createPaymentMethod,
  deletePaymentMethod,
  updatePaymentMethod,
} from "@/lib/buchhaltung-kontenplan";
import {
  PAYMENT_METHOD_TYPES,
  type PaymentMethod,
  type PaymentMethodType,
} from "@/lib/buchhaltung-kontenplan-typen";

import { BestaetigenDialog } from "./bestaetigen-dialog";

type Formular = {
  name: string;
  type: PaymentMethodType;
  paymentTermDays: string;
  isDefault: boolean;
  active: boolean;
  notes: string;
};
const LEER: Formular = {
  name: "",
  type: "bank_transfer",
  paymentTermDays: "",
  isDefault: false,
  active: true,
  notes: "",
};

const TYP_ICON: Record<PaymentMethodType, string> = {
  bank_transfer: "ph:bank",
  cash: "ph:money",
  card: "ph:credit-card",
  paypal: "ph:paypal-logo",
  direct_debit: "ph:arrows-left-right",
  other: "ph:dots-three-circle",
};

export function ZahlungsartenTab({ methods }: { methods: PaymentMethod[] }) {
  const t = useTranslations("finance");
  const router = useRouter();
  const [sheet, setSheet] = useState<{ offen: boolean; za: PaymentMethod | null }>({ offen: false, za: null });
  const [form, setForm] = useState<Formular>(LEER);
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [loeschen, setLoeschen] = useState<PaymentMethod | null>(null);

  const typLabel: Record<PaymentMethodType, string> = {
    bank_transfer: t("kontenplanPage.pmBankTransfer"),
    cash: t("kontenplanPage.pmCash"),
    card: t("kontenplanPage.pmCard"),
    paypal: t("kontenplanPage.pmPaypal"),
    direct_debit: t("kontenplanPage.pmDirectDebit"),
    other: t("kontenplanPage.pmOther"),
  };

  function oeffnen(za: PaymentMethod | null) {
    setFehler(null);
    setForm(
      za
        ? {
            name: za.name,
            type: za.type,
            paymentTermDays: za.paymentTermDays === null ? "" : String(za.paymentTermDays),
            isDefault: za.isDefault,
            active: za.active,
            notes: za.notes ?? "",
          }
        : LEER,
    );
    setSheet({ offen: true, za });
  }

  async function speichern() {
    setBusy(true);
    setFehler(null);
    const tage = form.paymentTermDays.trim();
    const body = {
      name: form.name.trim(),
      type: form.type,
      paymentTermDays: tage === "" ? null : Number(tage),
      isDefault: form.isDefault,
      active: form.active,
      notes: form.notes.trim() || null,
    };
    if (body.paymentTermDays !== null && !Number.isInteger(body.paymentTermDays)) {
      setBusy(false);
      setFehler(t("kontenplanPage.paymentTermInvalid"));
      return;
    }
    const res = sheet.za ? await updatePaymentMethod(sheet.za.id, body) : await createPaymentMethod(body);
    setBusy(false);
    if (!res.ok) {
      setFehler(res.error);
      return;
    }
    toast.success(sheet.za ? t("kontenplanPage.saved") : t("kontenplanPage.created"));
    setSheet({ offen: false, za: null });
    router.refresh();
  }

  async function standardSetzen(za: PaymentMethod) {
    const res = await updatePaymentMethod(za.id, { isDefault: true });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    router.refresh();
  }

  async function wirklichLoeschen() {
    if (!loeschen) return;
    setBusy(true);
    const res = await deletePaymentMethod(loeschen.id);
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
          {t("kontenplanPage.newPaymentMethod")}
        </Button>
      </div>
      {methods.length === 0 ? (
        <ZahlungsartenLeer onNeu={() => oeffnen(null)} />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-secondary/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">{t("kontenplanPage.columnName")}</th>
                <th className="px-4 py-3 font-medium">{t("kontenplanPage.columnType")}</th>
                <th className="px-4 py-3 text-right font-medium">{t("kontenplanPage.columnPaymentTerm")}</th>
                <th className="px-4 py-3 font-medium">{t("kontenplanPage.columnDefault")}</th>
                <th className="px-4 py-3 font-medium">{t("kontenplanPage.columnStatus")}</th>
                <th className="px-4 py-3 text-right font-medium">{t("kontenplanPage.columnActions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {methods.map((za) => (
                <ZahlungsartZeile
                  key={za.id}
                  za={za}
                  typLabel={typLabel}
                  onStandard={standardSetzen}
                  onBearbeiten={oeffnen}
                  onLoeschen={setLoeschen}
                />
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <ZahlungsartSheet
        sheet={sheet}
        setSheet={setSheet}
        form={form}
        setForm={setForm}
        busy={busy}
        fehler={fehler}
        typLabel={typLabel}
        onSpeichern={speichern}
      />

      <BestaetigenDialog
        open={loeschen !== null}
        titel={t("kontenplanPage.deletePaymentMethodTitle")}
        text={t("kontenplanPage.deletePaymentMethodText", { name: loeschen?.name ?? "" })}
        bestaetigen={t("kontenplanPage.delete")}
        abbrechen={t("kontenplanPage.cancel")}
        busy={busy}
        onBestaetigen={wirklichLoeschen}
        onClose={() => setLoeschen(null)}
      />
    </div>
  );
}

/** Das Sheet zum Anlegen und Bearbeiten einer Zahlungsart. */
function ZahlungsartSheet({
  sheet,
  setSheet,
  form,
  setForm,
  busy,
  fehler,
  typLabel,
  onSpeichern,
}: {
  sheet: { offen: boolean; za: PaymentMethod | null };
  setSheet: (s: { offen: boolean; za: PaymentMethod | null }) => void;
  form: Formular;
  setForm: React.Dispatch<React.SetStateAction<Formular>>;
  busy: boolean;
  fehler: string | null;
  typLabel: Record<PaymentMethodType, string>;
  onSpeichern: () => void;
}) {
  const t = useTranslations("finance");
  return (
    <Sheet open={sheet.offen} onOpenChange={(o) => !o && setSheet({ offen: false, za: null })}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="border-b">
          <SheetTitle className="font-display text-lg font-extrabold">
            {sheet.za ? t("kontenplanPage.editPaymentMethod") : t("kontenplanPage.newPaymentMethod")}
          </SheetTitle>
          <SheetDescription>{t("kontenplanPage.paymentMethodSheetDescription")}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pm-name">{t("kontenplanPage.columnName")}</Label>
            <Input id="pm-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pm-type">{t("kontenplanPage.columnType")}</Label>
              <NativeSelect id="pm-type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as PaymentMethodType })}>
                {PAYMENT_METHOD_TYPES.map((typ) => (
                  <option key={typ} value={typ}>
                    {typLabel[typ]}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="flex items-center gap-1.5">
                <Label htmlFor="pm-days">{t("kontenplanPage.columnPaymentTerm")}</Label>
                <InfoHinweis ariaLabel={t("kontenplanPage.paymentTermHintAria")} text={t("kontenplanPage.paymentTermHint")} />
              </span>
              <Input id="pm-days" inputMode="numeric" placeholder="—" value={form.paymentTermDays} onChange={(e) => setForm({ ...form, paymentTermDays: e.target.value })} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pm-notes">{t("kontenplanPage.columnNotes")}</Label>
            <Input id="pm-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="flex items-center justify-between rounded-(--radius) border px-3 py-2">
            <Label htmlFor="pm-default">{t("kontenplanPage.isDefault")}</Label>
            <Switch id="pm-default" checked={form.isDefault} onCheckedChange={(v) => setForm({ ...form, isDefault: v })} />
          </div>
          <div className="flex items-center justify-between rounded-(--radius) border px-3 py-2">
            <Label htmlFor="pm-active">{t("kontenplanPage.active")}</Label>
            <Switch id="pm-active" checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
          </div>
          {fehler && <p className="text-sm text-destructive">{fehler}</p>}
        </div>
        <SheetFooter className="border-t">
          <Button variant="outline" onClick={() => setSheet({ offen: false, za: null })}>
            {t("kontenplanPage.cancel")}
          </Button>
          <Button onClick={onSpeichern} disabled={busy || !form.name.trim()}>
            {busy ? t("kontenplanPage.saving") : t("kontenplanPage.save")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/** Eine Zeile der Zahlungsarten-Tabelle. */
function ZahlungsartZeile({
  za,
  typLabel,
  onStandard,
  onBearbeiten,
  onLoeschen,
}: {
  za: PaymentMethod;
  typLabel: Record<PaymentMethodType, string>;
  onStandard: (za: PaymentMethod) => void;
  onBearbeiten: (za: PaymentMethod | null) => void;
  onLoeschen: (za: PaymentMethod) => void;
}) {
  const t = useTranslations("finance");
  return (
                          <tr key={za.id} className={`transition-colors hover:bg-secondary/30 ${za.active ? "" : "text-muted-foreground"}`}>
                <td className="px-4 py-3 font-medium">{za.name}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5">
                    <Icon icon={TYP_ICON[za.type]} className="size-4 text-muted-foreground" />
                    {typLabel[za.type]}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {za.paymentTermDays === null ? "—" : t("kontenplanPage.days", { count: za.paymentTermDays })}
                </td>
                <td className="px-4 py-3">
                  {za.isDefault ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">
                      <Icon icon="ph:star-fill" className="size-3" />
                      {t("kontenplanPage.isDefault")}
                    </span>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => onStandard(za)}>
                      {t("kontenplanPage.setDefault")}
                    </Button>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${za.active ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300" : "bg-muted text-muted-foreground"}`}>
                    {za.active ? t("kontenplanPage.active") : t("kontenplanPage.inactive")}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Button variant="ghost" size="sm" onClick={() => onBearbeiten(za)} aria-label={t("kontenplanPage.edit")}>
                    <Icon icon="ph:pencil-simple" className="size-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => onLoeschen(za)} aria-label={t("kontenplanPage.delete")}>
                    <Icon icon="ph:trash" className="size-4 text-destructive" />
                  </Button>
                </td>
              </tr>
  );
}

/** Leerer Zustand der Zahlungsarten. */
function ZahlungsartenLeer({ onNeu }: { onNeu: () => void }) {
  const t = useTranslations("finance");
  return (
    <EmptyState
      icon="ph:wallet"
      titel={t("kontenplanPage.emptyPaymentMethodsTitle")}
      text={t("kontenplanPage.emptyPaymentMethodsText")}
      aktion={
        <Button className="gap-2" onClick={onNeu}>
          <Icon icon="ph:plus" className="size-4" />
          {t("kontenplanPage.newPaymentMethod")}
        </Button>
      }
    />
  );
}
