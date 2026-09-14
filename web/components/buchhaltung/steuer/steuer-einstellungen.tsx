"use client";

// Steuer-Parameter des Betriebs: Ertragsteuersatz, Gewerbe-/Kommunalsteuer,
// Meldezeitraum, Rücklagenquote. KEINE Vorbelegung (Wurzel 4): leer heißt
// „keine Schätzung", nicht „19 %". Hilfetexte nur im ℹ-Symbol.
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { Card, CardContent } from "@nextdays/ui/card";
import { InfoHinweis } from "@nextdays/ui/info-hinweis";
import { Input } from "@nextdays/ui/input";
import { Label } from "@nextdays/ui/label";
import { NativeSelect } from "@nextdays/ui/native-select";
import { Textarea } from "@nextdays/ui/textarea";
import { saveTaxSettings } from "@/lib/buchhaltung-steuer";
import type { PeriodKind, TaxSettings } from "@/lib/buchhaltung-steuer-typen";

type Form = {
  incomeTaxRate: string;
  tradeTaxRate: string;
  vatPeriod: PeriodKind | "";
  reserveRate: string;
  note: string;
};

function ausSettings(s: TaxSettings | null): Form {
  return {
    incomeTaxRate: s?.incomeTaxRate ?? "",
    tradeTaxRate: s?.tradeTaxRate ?? "",
    vatPeriod: s?.vatPeriod ?? "",
    reserveRate: s?.reserveRate ?? "",
    note: s?.note ?? "",
  };
}

function prozent(wert: string): string | null | undefined {
  const v = wert.trim().replace(",", ".");
  if (v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 100) return undefined;
  return v;
}

export function SteuerEinstellungen({ settings }: { settings: TaxSettings | null }) {
  const t = useTranslations("finance");
  const router = useRouter();
  const [form, setForm] = useState<Form>(() => ausSettings(settings));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function speichern() {
    const income = prozent(form.incomeTaxRate);
    const trade = prozent(form.tradeTaxRate);
    const reserve = prozent(form.reserveRate);
    if (income === undefined || trade === undefined || reserve === undefined) {
      setError(t("steuerPage.errorRate"));
      return;
    }
    setBusy(true);
    setError(null);
    const res = await saveTaxSettings({
      incomeTaxRate: income,
      tradeTaxRate: trade,
      vatPeriod: form.vatPeriod || null,
      reserveRate: reserve,
      note: form.note.trim() || null,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      toast.error(res.error);
      return;
    }
    toast.success(t("steuerPage.settingsSaved"));
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-5 py-5">
        {settings && (
          <p className="text-sm text-muted-foreground">
            {t("steuerPage.settingsContext", {
              country: settings.country ?? "—",
              currency: settings.currency ?? "—",
            })}
            {settings.smallBusiness && ` · ${t("steuerPage.smallBusiness")}`}
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Feld
            label={t("steuerPage.incomeTaxRate")}
            hint={t("steuerPage.incomeTaxRateHint")}
            value={form.incomeTaxRate}
            onChange={(v) => set("incomeTaxRate", v)}
          />
          <Feld
            label={t("steuerPage.tradeTaxRate")}
            hint={t("steuerPage.tradeTaxRateHint")}
            value={form.tradeTaxRate}
            onChange={(v) => set("tradeTaxRate", v)}
          />
          <Feld
            label={t("steuerPage.reserveRate")}
            hint={t("steuerPage.reserveRateHint")}
            value={form.reserveRate}
            onChange={(v) => set("reserveRate", v)}
          />
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1">
              <Label>{t("steuerPage.vatPeriod")}</Label>
              <InfoHinweis ariaLabel={t("steuerPage.vatPeriod")} text={t("steuerPage.vatPeriodHint")} />
            </div>
            <NativeSelect
              value={form.vatPeriod}
              onChange={(e) => set("vatPeriod", e.target.value as PeriodKind | "")}
            >
              <option value="">{t("steuerPage.notSet")}</option>
              <option value="month">{t("steuerPage.periodMonth")}</option>
              <option value="quarter">{t("steuerPage.periodQuarter")}</option>
              <option value="year">{t("steuerPage.periodYear")}</option>
            </NativeSelect>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>{t("steuerPage.note")}</Label>
          <Textarea rows={3} value={form.note} onChange={(e) => set("note", e.target.value)} />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end">
          <Button className="rounded-full" onClick={speichern} disabled={busy}>
            {busy ? t("steuerPage.saving") : t("steuerPage.save")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Feld({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1">
        <Label>{label}</Label>
        <InfoHinweis ariaLabel={label} text={hint} />
      </div>
      <div className="relative">
        <Input
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pr-8"
          placeholder="—"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          %
        </span>
      </div>
    </div>
  );
}
