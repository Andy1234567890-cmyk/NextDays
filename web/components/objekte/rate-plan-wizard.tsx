"use client";

// Assistent „Preisplan anlegen" (SiteMinder-Modell, ans myNextDays-Branding
// angeglichen). Vier Schritte: Allgemein → Aufenthalt → Preisgestaltung →
// Prüfen. Ein Plan ist entweder MANUELL (eigener Grundpreis) oder ABGELEITET
// (Preis = Basis-Plan + Betrag, dann Prozent). Datumsgenaue Pflege läuft danach
// im Kalender („Preise & Bestand"), nicht hier.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";
import { NativeSelect } from "@nextdays/ui/native-select";
import { formatCurrency } from "@/lib/currency";
import { createRatePlan, type RatePlan } from "@/lib/rates";

type Step = "general" | "stay" | "pricing" | "review";
const STEPS: Step[] = ["general", "stay", "pricing", "review"];

// Richtung getrennt vom Betrag (SiteMinder: Wert ohne Vorzeichen + Dropdown
// Increase/Decrease) — verhindert das „−-25 = +25"-Missverständnis.
type Direction = "increase" | "decrease";

/** Vorschau-Basis für die Live-Rechnung im Ableitungs-Schritt. */
const PREVIEW_BASE = 100;

/** (basis + betrag) × (1 + prozent/100), kaufmännisch auf 2 Stellen — dieselbe
 *  Reihenfolge wie der Server-Resolver (erst Betrag, dann Prozent). */
export function previewDerived(
  base: number,
  amount: number,
  percent: number,
): number {
  return Math.round((base + amount) * (1 + percent / 100) * 100) / 100;
}

export function RatePlanWizard({
  propertyId,
  plans,
  currency,
  onDone,
  onClose,
}: {
  propertyId: string;
  plans: RatePlan[];
  // Währung des Objekts (aus dem bestehenden Plan) — nie erfunden, nur angezeigt.
  currency: string;
  onDone: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("objects");
  const [step, setStep] = useState<Step>("general");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [minStay, setMinStay] = useState("1");
  // An die Buchungsportale senden. Der Grundpreis geht immer; dieser zusätzliche
  // Preis nur, wenn der Kunde es hier einschaltet.
  const [sendToPortals, setSendToPortals] = useState(false);
  const [derive, setDerive] = useState(false);
  const [basePrice, setBasePrice] = useState("");
  // Nur MANUELLE Pläne können Basis sein — keine Kaskade (Server: 422).
  const manualPlans = useMemo(
    () => plans.filter((p) => p.rate_mode === "manual"),
    [plans],
  );
  const [parentId, setParentId] = useState(manualPlans[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [amountDir, setAmountDir] = useState<Direction>("increase");
  const [percent, setPercent] = useState("");
  const [percentDir, setPercentDir] = useState<Direction>("increase");

  const nameTaken = plans.some(
    (p) => p.name.trim().toLowerCase() === name.trim().toLowerCase(),
  );
  const signedAmount =
    (Number(amount) || 0) * (amountDir === "decrease" ? -1 : 1);
  const signedPercent =
    (Number(percent) || 0) * (percentDir === "decrease" ? -1 : 1);
  const parent = manualPlans.find((p) => p.id === parentId) ?? null;
  const previewOut = previewDerived(PREVIEW_BASE, signedAmount, signedPercent);

  const canNext =
    step === "general"
      ? name.trim().length > 0 && !nameTaken
      : step === "stay"
        ? Number(minStay) >= 1
        : step === "pricing"
          ? derive
            ? !!parentId
            : basePrice !== "" && Number(basePrice) >= 0
          : true;

  const submit = async () => {
    setBusy(true);
    setErr(null);
    const res = await createRatePlan(
      derive
        ? {
            propertyId,
            name: name.trim(),
            // Bei Ableitung erbt das Kind Basis + Währung vom Parent (Server
            // erzwingt) — die Felder sind nur Formalität der API.
            basePrice: 0,
            currency,
            minStay: Number(minStay),
            rateMode: "derived",
            derivedFromRatePlanId: parentId,
            offsetAmount: amount === "" ? null : signedAmount,
            offsetPercent: percent === "" ? null : signedPercent,
            sendToPortals,
          }
        : {
            propertyId,
            name: name.trim(),
            basePrice: Number(basePrice),
            currency,
            minStay: Number(minStay),
            rateMode: "manual",
            sendToPortals,
          },
    );
    setBusy(false);
    if (!res.ok) {
      setErr(res.error);
      return;
    }
    onDone();
  };

  const idx = STEPS.indexOf(step);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col gap-5 overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-extrabold">
            {t("ratePlanWizard.title")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label={t("ratePlanWizard.close")}
          >
            <Icon icon="ph:x" className="size-5" />
          </button>
        </div>

        {/* Schritt-Anzeige */}
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <span
              key={s}
              className={`h-1.5 flex-1 rounded-full ${
                i <= idx ? "bg-accent" : "bg-muted"
              }`}
            />
          ))}
        </div>

        {step === "general" && (
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium" htmlFor="rp-name">
              {t("ratePlanWizard.nameLabel")}
            </label>
            <Input
              id="rp-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("ratePlanWizard.namePlaceholder")}
            />
            {nameTaken && (
              <p className="text-sm text-destructive">
                {t("ratePlanWizard.nameTaken")}
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              {t("ratePlanWizard.nameHint")}
            </p>
          </div>
        )}

        {step === "stay" && (
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium" htmlFor="rp-minstay">
              {t("ratePlanWizard.minStayLabel")}
            </label>
            <Input
              id="rp-minstay"
              type="number"
              min={1}
              value={minStay}
              onChange={(e) => setMinStay(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              {t("ratePlanWizard.minStayHint")}
            </p>

            {/* An die Buchungsportale senden. Der Grundpreis geht immer; dieser
                zusätzliche Preis nur, wenn hier eingeschaltet. */}
            <label className="mt-2 flex items-start gap-3 rounded-(--radius) border border-border p-3">
              <input
                type="checkbox"
                className="mt-1 size-4"
                checked={sendToPortals}
                onChange={(e) => setSendToPortals(e.target.checked)}
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">
                  {t("ratePlanWizard.sendToPortalsLabel")}
                </span>
                <span className="text-sm text-muted-foreground">
                  {t("ratePlanWizard.sendToPortalsHint")}
                </span>
              </span>
            </label>
          </div>
        )}

        {step === "pricing" && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              {t("ratePlanWizard.currencyFixed", { currency })}
            </p>

            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="rp-mode"
                  checked={!derive}
                  onChange={() => setDerive(false)}
                />
                {t("ratePlanWizard.modeManual")}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="rp-mode"
                  checked={derive}
                  disabled={manualPlans.length === 0}
                  onChange={() => setDerive(true)}
                />
                {t("ratePlanWizard.modeDerived")}
              </label>
              {manualPlans.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {t("ratePlanWizard.noParentAvailable")}
                </p>
              )}
            </div>

            {!derive ? (
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium" htmlFor="rp-base">
                  {t("ratePlanWizard.basePriceLabel")}
                </label>
                <Input
                  id="rp-base"
                  type="number"
                  min={0}
                  step="0.01"
                  value={basePrice}
                  onChange={(e) => setBasePrice(e.target.value)}
                />
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium" htmlFor="rp-parent">
                    {t("ratePlanWizard.parentLabel")}
                  </label>
                  <NativeSelect
                    id="rp-parent"
                    value={parentId}
                    onChange={(e) => setParentId(e.target.value)}
                  >
                    {manualPlans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </NativeSelect>
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium">
                    {t("ratePlanWizard.amountLabel")}
                  </span>
                  <div className="flex gap-2">
                    <NativeSelect
                      value={amountDir}
                      onChange={(e) => setAmountDir(e.target.value as Direction)}
                      className="w-auto"
                      aria-label={t("ratePlanWizard.amountLabel")}
                    >
                      <option value="increase">
                        {t("ratePlanWizard.increase")}
                      </option>
                      <option value="decrease">
                        {t("ratePlanWizard.decrease")}
                      </option>
                    </NativeSelect>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium">
                    {t("ratePlanWizard.percentLabel")}
                  </span>
                  <div className="flex gap-2">
                    <NativeSelect
                      value={percentDir}
                      onChange={(e) =>
                        setPercentDir(e.target.value as Direction)
                      }
                      className="w-auto"
                      aria-label={t("ratePlanWizard.percentLabel")}
                    >
                      <option value="increase">
                        {t("ratePlanWizard.increase")}
                      </option>
                      <option value="decrease">
                        {t("ratePlanWizard.decrease")}
                      </option>
                    </NativeSelect>
                    <Input
                      type="number"
                      min={0}
                      step="0.001"
                      value={percent}
                      onChange={(e) => setPercent(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                </div>

                <p className="text-sm text-muted-foreground">
                  {t("ratePlanWizard.orderHint")}
                </p>

                {/* Live-Vorschau: macht „erst Betrag, dann Prozent" greifbar. */}
                <div className="rounded-xl bg-secondary/50 p-3 text-sm">
                  {t("ratePlanWizard.previewLine", {
                    base: formatCurrency(PREVIEW_BASE, currency),
                    result: formatCurrency(previewOut, currency),
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {step === "review" && (
          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">
                {t("ratePlanWizard.nameLabel")}
              </dt>
              <dd className="font-medium">{name}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">
                {t("ratePlanWizard.minStayLabel")}
              </dt>
              <dd className="font-medium">{minStay}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">
                {t("ratePlanWizard.pricingTitle")}
              </dt>
              <dd className="text-right font-medium">
                {derive
                  ? t("ratePlanWizard.reviewDerived", {
                      parent: parent?.name ?? "",
                      result: formatCurrency(previewOut, currency),
                      base: formatCurrency(PREVIEW_BASE, currency),
                    })
                  : formatCurrency(Number(basePrice) || 0, currency)}
              </dd>
            </div>
          </dl>
        )}

        {err && <p className="text-sm text-destructive">{err}</p>}

        <div className="flex justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              idx === 0 ? onClose() : setStep(STEPS[idx - 1] as Step)
            }
            disabled={busy}
          >
            {idx === 0 ? t("ratePlanWizard.cancel") : t("ratePlanWizard.back")}
          </Button>
          {step === "review" ? (
            <Button type="button" onClick={() => void submit()} disabled={busy}>
              {busy ? t("ratePlanWizard.saving") : t("ratePlanWizard.save")}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => setStep(STEPS[idx + 1] as Step)}
              disabled={!canNext || busy}
            >
              {t("ratePlanWizard.next")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
