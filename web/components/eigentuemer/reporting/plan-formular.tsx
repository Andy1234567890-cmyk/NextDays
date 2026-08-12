"use client";

// Geplanten Bericht anlegen und bearbeiten — EIN Formular für beide Wege.
//
// Vier Angaben entscheiden, WANN und WORÜBER gelaufen wird:
//   Rhythmus  · wie oft            (Woche | Monat | Quartal | Jahr)
//   Am Tag    · wann in der Periode (erster | letzter Tag)
//   Zeitraum  · was ausgewertet wird (vergangene | laufende Periode)
//   Basis     · welches Datum der Buchung zählt
//
// „Am Tag" und „Zeitraum" sind zwei verschiedene Fragen und werden oft
// verwechselt: ein Lauf AM ERSTEN über die VERGANGENE Periode ist die normale
// Monatsabrechnung; ein Lauf am Ersten über die LAUFENDE Periode wäre ein
// Bericht über einen Monat, der gerade erst begonnen hat.
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import { Input } from "@nextdays/ui/input";
import { Label } from "@nextdays/ui/label";
import { NativeSelect } from "@nextdays/ui/native-select";
import { Switch } from "@nextdays/ui/switch";
import {
  ObjektMehrfachauswahl,
  type ObjektAuswahlEintrag,
} from "@/components/objekt-mehrfachauswahl";
import {
  type AmTag,
  createSchedule,
  type PlanZeitraum,
  type ReportBasis,
  type Rhythmus,
  type Schedule,
  updateSchedule,
} from "@/lib/owner-reporting";

const RHYTHMEN: readonly Rhythmus[] = ["woche", "monat", "quartal", "jahr"];
const TAGE: readonly AmTag[] = ["erste", "letzte"];
const ZEITRAEUME: readonly PlanZeitraum[] = ["vergangener", "laufender"];
const BASEN: readonly ReportBasis[] = ["check_in", "check_out", "booked"];

export function PlanFormular({
  objekte,
  objekteError,
  waehrungen,
  empfaenger,
  plan = null,
}: {
  objekte: ObjektAuswahlEintrag[];
  objekteError: string | null;
  waehrungen: string[];
  empfaenger: { id: string; name: string; hat_vertrag: boolean }[];
  plan?: Schedule | null;
}) {
  const t = useTranslations("ownerReporting.scheduleForm");
  const router = useRouter();
  const bearbeiten = plan !== null;

  const [name, setName] = useState(plan?.name ?? "");
  const [mitDatum, setMitDatum] = useState(plan?.name_mit_datum ?? true);
  const [aktiv, setAktiv] = useState(plan?.aktiv ?? true);
  const [rhythmus, setRhythmus] = useState<Rhythmus>(plan?.rhythmus ?? "monat");
  const [amTag, setAmTag] = useState<AmTag>(plan?.am_tag ?? "erste");
  const [zeitraum, setZeitraum] = useState<PlanZeitraum>(
    plan?.zeitraum ?? "vergangener",
  );
  const [currency, setCurrency] = useState(
    plan?.currency ?? waehrungen[0] ?? "",
  );
  const [basis, setBasis] = useState<ReportBasis>(plan?.basis ?? "check_in");
  const [ids, setIds] = useState<string[]>(plan?.property_ids ?? []);
  const [suche, setSuche] = useState("");
  const [recipients, setRecipients] = useState<string[]>(
    plan?.recipient_ids ?? [],
  );
  const [busy, setBusy] = useState(false);

  const gueltig =
    name.trim().length > 0 && currency.length === 3 && ids.length > 0;

  async function submit() {
    if (!gueltig) return;
    setBusy(true);
    const eingabe = {
      name: name.trim(),
      name_mit_datum: mitDatum,
      aktiv,
      rhythmus,
      am_tag: amTag,
      zeitraum,
      currency,
      basis,
      property_ids: ids,
      recipient_ids: recipients,
    };
    const res = bearbeiten
      ? await updateSchedule(plan.id, eingabe)
      : await createSchedule(eingabe);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(bearbeiten ? t("updated") : t("created"));
    router.push("/eigentuemer/reporting/geplant");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl font-extrabold">
        {bearbeiten ? t("editTitle") : t("newTitle")}
      </h1>

      <Card className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col">
            <span className="text-sm font-medium">{t("fields.active")}</span>
            <span className="text-xs text-muted-foreground">
              {t("hints.active")}
            </span>
          </div>
          <Switch checked={aktiv} onCheckedChange={setAktiv} />
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="plan-name">{t("fields.name")}</Label>
          <Input
            id="plan-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("placeholders.name")}
            autoFocus={!bearbeiten}
          />
          <label className="mt-1 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={mitDatum}
              onChange={(e) => setMitDatum(e.target.checked)}
            />
            {t("fields.nameWithDate")}
          </label>
          <p className="text-xs text-muted-foreground">
            {t("hints.nameWithDate")}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="plan-rhythmus">{t("fields.frequency")}</Label>
            <NativeSelect
              id="plan-rhythmus"
              value={rhythmus}
              onChange={(e) => setRhythmus(e.target.value as Rhythmus)}
            >
              {RHYTHMEN.map((r) => (
                <option key={r} value={r}>
                  {t(`frequency.${r}`)}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="plan-tag">{t("fields.onDay")}</Label>
            <NativeSelect
              id="plan-tag"
              value={amTag}
              onChange={(e) => setAmTag(e.target.value as AmTag)}
            >
              {TAGE.map((d) => (
                <option key={d} value={d}>
                  {t(`onDay.${d}`)}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="plan-zeitraum">{t("fields.period")}</Label>
            <NativeSelect
              id="plan-zeitraum"
              value={zeitraum}
              onChange={(e) => setZeitraum(e.target.value as PlanZeitraum)}
            >
              {ZEITRAEUME.map((z) => (
                <option key={z} value={z}>
                  {t(`period.${z}`)}
                </option>
              ))}
            </NativeSelect>
            <p className="text-xs text-muted-foreground">
              {t(`periodHint.${zeitraum}`)}
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="plan-currency">{t("fields.currency")}</Label>
            {waehrungen.length === 0 ? (
              <p className="rounded-(--radius) border border-destructive/40 p-3 text-sm text-destructive">
                {t("errors.noCurrency")}
              </p>
            ) : (
              <NativeSelect
                id="plan-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                {waehrungen.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </NativeSelect>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="plan-basis">{t("fields.basis")}</Label>
          <NativeSelect
            id="plan-basis"
            value={basis}
            onChange={(e) => setBasis(e.target.value as ReportBasis)}
          >
            {BASEN.map((b) => (
              <option key={b} value={b}>
                {t(`basis.${b}`)}
              </option>
            ))}
          </NativeSelect>
        </div>
      </Card>

      <Card className="flex flex-col gap-3 p-6">
        <span className="text-sm font-medium">{t("fields.properties")}</span>
        {objekteError ? (
          <p className="rounded-(--radius) border border-destructive/40 p-4 text-sm text-destructive">
            {objekteError}
          </p>
        ) : (
          <ObjektMehrfachauswahl
            objekte={objekte}
            selected={ids}
            onChange={setIds}
            suche={suche}
            onSucheChange={setSuche}
            disabled={busy}
            emptyText={t("errors.noProperties")}
          />
        )}
      </Card>

      <Card className="flex flex-col gap-3 p-6">
        <span className="text-sm font-medium">{t("fields.recipients")}</span>
        <p className="text-xs text-muted-foreground">
          {t("hints.recipients")}
        </p>
        {empfaenger.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("errors.noRecipients")}
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {empfaenger.map((e) => (
              <label
                key={e.id}
                className="flex items-start gap-2 text-sm"
              >
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 accent-primary"
                  checked={recipients.includes(e.id)}
                  onChange={(ev) =>
                    setRecipients((prev) =>
                      ev.target.checked
                        ? [...prev, e.id]
                        : prev.filter((x) => x !== e.id),
                    )
                  }
                />
                <span className="flex flex-col">
                  {e.name}
                  {!e.hat_vertrag && (
                    // Ohne Vertrag entsteht beim Lauf zwar der Bericht, aber
                    // keine Zahlung für ihn. Das steht hier, statt später nur
                    // im Server-Protokoll aufzutauchen.
                    <span className="text-xs text-destructive">
                      {t("noTerms")}
                    </span>
                  )}
                </span>
              </label>
            ))}
          </div>
        )}
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => router.back()} disabled={busy}>
          {t("cancel")}
        </Button>
        <Button onClick={() => void submit()} disabled={busy || !gueltig}>
          {busy ? (
            <Icon icon="ph:spinner" className="size-4 animate-spin" />
          ) : null}
          {bearbeiten ? t("update") : t("create")}
        </Button>
      </div>
    </div>
  );
}
