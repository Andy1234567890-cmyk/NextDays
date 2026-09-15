"use client";

// Kontenplan → Buchungskonten: Baum nach Kontenklasse (Erlöse/Aufwand/Aktiva/
// Passiva), Suche, Anlegen/Bearbeiten im Sheet, Standard-Import (SKR03/04).
// Kein Realtime: `booking_accounts` ist für authenticated gesperrt (Wurzel 6,
// 0671) — nach eigener Aktion `router.refresh()`.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@nextdays/ui/dialog";
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
  createBookingAccount,
  deleteBookingAccount,
  importStandardAccounts,
  updateBookingAccount,
} from "@/lib/buchhaltung-kontenplan";
import {
  ACCOUNT_TYPES,
  type AccountType,
  type BookingAccount,
  type Kontenrahmen,
} from "@/lib/buchhaltung-kontenplan-typen";

import { BestaetigenDialog } from "./bestaetigen-dialog";

type Formular = {
  number: string;
  name: string;
  type: AccountType;
  taxRate: string;
  description: string;
  active: boolean;
};

const LEER: Formular = {
  number: "",
  name: "",
  type: "INCOME",
  taxRate: "",
  description: "",
  active: true,
};

const KLASSEN_ICON: Record<AccountType, string> = {
  INCOME: "ph:trend-up",
  EXPENSE: "ph:trend-down",
  ASSET: "ph:bank",
  LIABILITY: "ph:scales",
};

/** Konten je Klasse, nach Nummer sortiert und auf die Suche gefiltert. */
function gruppieren(accounts: BookingAccount[], suche: string) {
  const s = suche.trim().toLowerCase();
  const gefiltert = s
    ? accounts.filter((k) => k.number.toLowerCase().includes(s) || k.name.toLowerCase().includes(s))
    : accounts;
  return ACCOUNT_TYPES.map((typ) => ({
    typ,
    konten: gefiltert
      .filter((k) => k.type === typ)
      .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true })),
  })).filter((g) => g.konten.length > 0 || !s);
}

function ausKonto(konto: BookingAccount): Formular {
  return {
    number: konto.number,
    name: konto.name,
    type: konto.type,
    taxRate: konto.taxRate === null ? "" : String(konto.taxRate),
    description: konto.description ?? "",
    active: konto.active,
  };
}

export function BuchungskontenTab({ accounts }: { accounts: BookingAccount[] }) {
  const t = useTranslations("finance");
  const router = useRouter();
  const [suche, setSuche] = useState("");
  const [zu, setZu] = useState<Record<string, boolean>>({});
  const [sheet, setSheet] = useState<{ offen: boolean; konto: BookingAccount | null }>({
    offen: false,
    konto: null,
  });
  const [form, setForm] = useState<Formular>(LEER);
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [loeschen, setLoeschen] = useState<BookingAccount | null>(null);
  const [importOffen, setImportOffen] = useState(false);
  const [kontenrahmen, setKontenrahmen] = useState<Kontenrahmen>("SKR03");

  const klassenLabel: Record<AccountType, string> = {
    INCOME: t("kontenplanPage.typeIncome"),
    EXPENSE: t("kontenplanPage.typeExpense"),
    ASSET: t("kontenplanPage.typeAsset"),
    LIABILITY: t("kontenplanPage.typeLiability"),
  };

  const gruppen = useMemo(() => gruppieren(accounts, suche), [accounts, suche]);

  function oeffnen(konto: BookingAccount | null) {
    setFehler(null);
    setForm(konto ? ausKonto(konto) : LEER);
    setSheet({ offen: true, konto });
  }

  async function speichern() {
    setBusy(true);
    setFehler(null);
    const body = {
      name: form.name.trim(),
      taxRate: form.taxRate.trim() === "" ? null : form.taxRate.trim(),
      description: form.description.trim() || null,
      active: form.active,
    };
    const res = sheet.konto
      ? await updateBookingAccount(
          sheet.konto.id,
          // Nummer/Typ eines Standardkontos bleiben — der Server lehnt sie ab (409).
          sheet.konto.isSystem ? body : { ...body, number: form.number.trim(), type: form.type },
        )
      : await createBookingAccount({ ...body, number: form.number.trim(), type: form.type });
    setBusy(false);
    if (!res.ok) {
      setFehler(res.error);
      return;
    }
    toast.success(sheet.konto ? t("kontenplanPage.saved") : t("kontenplanPage.created"));
    setSheet({ offen: false, konto: null });
    router.refresh();
  }

  async function aktivSchalten(konto: BookingAccount) {
    const res = await updateBookingAccount(konto.id, { active: !konto.active });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    router.refresh();
  }

  async function wirklichLoeschen() {
    if (!loeschen) return;
    setBusy(true);
    const res = await deleteBookingAccount(loeschen.id);
    setBusy(false);
    setLoeschen(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(t("kontenplanPage.deleted"));
    router.refresh();
  }

  async function importieren() {
    setBusy(true);
    const res = await importStandardAccounts(kontenrahmen);
    setBusy(false);
    setImportOffen(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(
      t("kontenplanPage.importResult", {
        angelegt: res.data.angelegt,
        uebersprungen: res.data.uebersprungen,
      }),
    );
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <KontenLeiste
        suche={suche}
        setSuche={setSuche}
        onImport={() => setImportOffen(true)}
        onNeu={() => oeffnen(null)}
      />

      {accounts.length === 0 ? (
        <KontenLeer onImport={() => setImportOffen(true)} />
      ) : (
        <div className="flex flex-col gap-3">
          {gruppen.map(({ typ, konten }) => (
            <KontenGruppe
              key={typ}
              typ={typ}
              konten={konten}
              zu={zu[typ]}
              label={klassenLabel[typ]}
              onUmschalten={() => setZu((z) => ({ ...z, [typ]: !z[typ] }))}
              onAktiv={aktivSchalten}
              onBearbeiten={oeffnen}
              onLoeschen={setLoeschen}
            />
          ))}
        </div>
      )}

      <KontoSheet
        sheet={sheet}
        setSheet={setSheet}
        form={form}
        setForm={setForm}
        busy={busy}
        fehler={fehler}
        klassenLabel={klassenLabel}
        onSpeichern={speichern}
      />

      <ImportDialog
        offen={importOffen}
        setOffen={setImportOffen}
        rahmen={kontenrahmen}
        setRahmen={setKontenrahmen}
        busy={busy}
        onImport={importieren}
      />

      <BestaetigenDialog
        open={loeschen !== null}
        titel={t("kontenplanPage.deleteAccountTitle")}
        text={t("kontenplanPage.deleteAccountText", { number: loeschen?.number ?? "" })}
        bestaetigen={t("kontenplanPage.delete")}
        abbrechen={t("kontenplanPage.cancel")}
        busy={busy}
        onBestaetigen={wirklichLoeschen}
        onClose={() => setLoeschen(null)}
      />
    </div>
  );
}

/** Das Sheet zum Anlegen und Bearbeiten eines Buchungskontos. */
function KontoSheet({
  sheet,
  setSheet,
  form,
  setForm,
  busy,
  fehler,
  klassenLabel,
  onSpeichern,
}: {
  sheet: { offen: boolean; konto: BookingAccount | null };
  setSheet: (s: { offen: boolean; konto: BookingAccount | null }) => void;
  form: Formular;
  setForm: React.Dispatch<React.SetStateAction<Formular>>;
  busy: boolean;
  fehler: string | null;
  klassenLabel: Record<AccountType, string>;
  onSpeichern: () => void;
}) {
  const t = useTranslations("finance");
  return (
    <Sheet open={sheet.offen} onOpenChange={(o) => !o && setSheet({ offen: false, konto: null })}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="border-b">
          <SheetTitle className="font-display text-lg font-extrabold">
            {sheet.konto ? t("kontenplanPage.editAccount") : t("kontenplanPage.newAccount")}
          </SheetTitle>
          <SheetDescription>{t("kontenplanPage.accountSheetDescription")}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ba-number">{t("kontenplanPage.columnNumber")}</Label>
              <Input
                id="ba-number"
                value={form.number}
                inputMode="numeric"
                disabled={sheet.konto?.isSystem}
                onChange={(e) => setForm({ ...form, number: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ba-type">{t("kontenplanPage.columnType")}</Label>
              <NativeSelect
                id="ba-type"
                value={form.type}
                disabled={sheet.konto?.isSystem}
                onChange={(e) => setForm({ ...form, type: e.target.value as AccountType })}
              >
                {ACCOUNT_TYPES.map((typ) => (
                  <option key={typ} value={typ}>
                    {klassenLabel[typ]}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ba-name">{t("kontenplanPage.columnName")}</Label>
            <Input
              id="ba-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="flex items-center gap-1.5">
              <Label htmlFor="ba-tax">{t("kontenplanPage.columnTaxRate")}</Label>
              <InfoHinweis
                ariaLabel={t("kontenplanPage.taxRateHintAria")}
                text={t("kontenplanPage.taxRateHint")}
              />
            </span>
            <Input
              id="ba-tax"
              value={form.taxRate}
              inputMode="decimal"
              placeholder="—"
              onChange={(e) => setForm({ ...form, taxRate: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ba-desc">{t("kontenplanPage.columnDescription")}</Label>
            <Input
              id="ba-desc"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="flex items-center justify-between rounded-(--radius) border px-3 py-2">
            <Label htmlFor="ba-active">{t("kontenplanPage.active")}</Label>
            <Switch
              id="ba-active"
              checked={form.active}
              onCheckedChange={(v) => setForm({ ...form, active: v })}
            />
          </div>
          {fehler && <p className="text-sm text-destructive">{fehler}</p>}
        </div>
        <SheetFooter className="border-t">
          <Button variant="outline" onClick={() => setSheet({ offen: false, konto: null })}>
            {t("kontenplanPage.cancel")}
          </Button>
          <Button onClick={onSpeichern} disabled={busy || !form.name.trim() || !form.number.trim()}>
            {busy ? t("kontenplanPage.saving") : t("kontenplanPage.save")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/** Der Dialog für den Import eines Standard-Kontenrahmens. */
function ImportDialog({
  offen,
  setOffen,
  rahmen,
  setRahmen,
  busy,
  onImport,
}: {
  offen: boolean;
  setOffen: (v: boolean) => void;
  rahmen: Kontenrahmen;
  setRahmen: (v: Kontenrahmen) => void;
  busy: boolean;
  onImport: () => void;
}) {
  const t = useTranslations("finance");
  return (
    <Dialog open={offen} onOpenChange={(o) => !o && setOffen(false)}>
      <DialogContent className="max-w-md">
        <DialogTitle className="font-display text-lg font-extrabold">
          {t("kontenplanPage.importStandard")}
        </DialogTitle>
        <DialogDescription>{t("kontenplanPage.importDescription")}</DialogDescription>
        <div className="mt-3 flex flex-col gap-1.5">
          <Label htmlFor="ba-rahmen">{t("kontenplanPage.kontenrahmen")}</Label>
          <NativeSelect
            id="ba-rahmen"
            value={rahmen}
            onChange={(e) => setRahmen(e.target.value as Kontenrahmen)}
          >
            <option value="SKR03">SKR03</option>
            <option value="SKR04">SKR04</option>
          </NativeSelect>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOffen(false)} disabled={busy}>
            {t("kontenplanPage.cancel")}
          </Button>
          <Button onClick={onImport} disabled={busy}>
            {busy ? t("kontenplanPage.saving") : t("kontenplanPage.importNow")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Eine Kontenklasse als aufklappbare Karte mit ihrer Kontentabelle. */
function KontenGruppe({
  typ,
  konten,
  zu,
  label,
  onUmschalten,
  onAktiv,
  onBearbeiten,
  onLoeschen,
}: {
  typ: AccountType;
  konten: BookingAccount[];
  zu: boolean;
  label: string;
  onUmschalten: () => void;
  onAktiv: (k: BookingAccount) => void;
  onBearbeiten: (k: BookingAccount | null) => void;
  onLoeschen: (k: BookingAccount) => void;
}) {
  const t = useTranslations("finance");
  return (
                  <Card key={typ} className="overflow-hidden p-0">
            <button
              type="button"
              onClick={onUmschalten}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/40"
              aria-expanded={!zu}
            >
              <Icon
                icon={zu ? "ph:caret-right" : "ph:caret-down"}
                className="size-4 text-muted-foreground"
              />
              <Icon icon={KLASSEN_ICON[typ]} className="size-4 text-accent" />
              <span className="font-display font-extrabold">{label}</span>
              <span className="ml-auto rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                {konten.length}
              </span>
            </button>
            {!zu && (
              <div className="overflow-x-auto border-t">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/40 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 font-medium">{t("kontenplanPage.columnNumber")}</th>
                      <th className="px-4 py-2 font-medium">{t("kontenplanPage.columnName")}</th>
                      <th className="px-4 py-2 text-right font-medium">
                        {t("kontenplanPage.columnTaxRate")}
                      </th>
                      <th className="px-4 py-2 font-medium">{t("kontenplanPage.columnOrigin")}</th>
                      <th className="px-4 py-2 font-medium">{t("kontenplanPage.columnStatus")}</th>
                      <th className="px-4 py-2 text-right font-medium">
                        {t("kontenplanPage.columnActions")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {konten.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-3 text-muted-foreground">
                          {t("kontenplanPage.noAccountsInClass")}
                        </td>
                      </tr>
                    )}
                    {konten.map((k) => (
                      <tr
                        key={k.id}
                        className={`transition-colors hover:bg-secondary/30 ${k.active ? "" : "text-muted-foreground"}`}
                      >
                        <td className="px-4 py-2 font-mono">{k.number}</td>
                        <td className="px-4 py-2">{k.name}</td>
                        <td className="px-4 py-2 text-right">
                          {k.taxRate === null ? "—" : `${k.taxRate} %`}
                        </td>
                        <td className="px-4 py-2 text-xs">
                          {k.isSystem ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-accent">
                              <Icon icon="ph:lock-simple" className="size-3" />
                              {k.kontenrahmen ?? t("kontenplanPage.systemAccount")}
                            </span>
                          ) : (
                            <span className="rounded-full bg-secondary px-2 py-0.5">
                              {t("kontenplanPage.ownAccount")}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          <Switch
                            checked={k.active}
                            onCheckedChange={() => onAktiv(k)}
                            aria-label={t("kontenplanPage.active")}
                          />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <Button variant="ghost" size="sm" onClick={() => onBearbeiten(k)} aria-label={t("kontenplanPage.edit")}>
                            <Icon icon="ph:pencil-simple" className="size-4" />
                          </Button>
                          {!k.isSystem && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onLoeschen(k)}
                              aria-label={t("kontenplanPage.delete")}
                            >
                              <Icon icon="ph:trash" className="size-4 text-destructive" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
  );
}

/** Suchfeld und die zwei Kopfknöpfe des Kontenplans. */
function KontenLeiste({
  suche,
  setSuche,
  onImport,
  onNeu,
}: {
  suche: string;
  setSuche: (v: string) => void;
  onImport: () => void;
  onNeu: () => void;
}) {
  const t = useTranslations("finance");
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="relative w-full max-w-sm">
        <Icon
          icon="ph:magnifying-glass"
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
          placeholder={t("kontenplanPage.searchPlaceholder")}
          className="pl-9"
          aria-label={t("kontenplanPage.searchPlaceholder")}
        />
      </div>
      <div className="flex gap-2">
        <Button variant="outline" className="gap-2" onClick={onImport}>
          <Icon icon="ph:download-simple" className="size-4" />
          {t("kontenplanPage.importStandard")}
        </Button>
        <Button className="gap-2" onClick={onNeu}>
          <Icon icon="ph:plus" className="size-4" />
          {t("kontenplanPage.newAccount")}
        </Button>
      </div>
    </div>
  );
}

/** Leerer Kontenplan: der Weg dorthin führt über den Standard-Import. */
function KontenLeer({ onImport }: { onImport: () => void }) {
  const t = useTranslations("finance");
  return (
    <EmptyState
      icon="ph:tree-structure"
      titel={t("kontenplanPage.emptyAccountsTitle")}
      text={t("kontenplanPage.emptyAccountsText")}
      aktion={
        <Button className="gap-2" onClick={onImport}>
          <Icon icon="ph:download-simple" className="size-4" />
          {t("kontenplanPage.importStandard")}
        </Button>
      }
    />
  );
}
