"use client";

// Setup-Assistent fürs Hotel-Onboarding. Führt durch:
//  1) Willkommen
//  2) Verzweigung: "Schon auf Buchungsportalen aktiv?" (ja/nein)
//  3) Erstes Objekt anlegen (legt echtes Objekt an → Auto-Sync zum Provider)
//  4) Preis setzen (Basispreis je Nacht)
//  5) Kanäle: Neu → verbinden | Bestand → Portale verbinden + importieren
// Business-Logik im Backend; hier nur Orchestrierung (lib/properties, lib/channex).
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { type FirmenProfil, saveFirmenProfil } from "@/lib/firmenprofil";
import {
  LAENDER,
  befreiungFuerLand,
  rechtsformLabel,
  rechtsformenFuerLand,
  vatBeispielFuerLand,
} from "@/lib/laender";
import type { OnboardingStatus } from "@/lib/onboarding";
import { updateOnboarding } from "@/lib/onboarding";
import { cn } from "@/lib/utils";

// Onboarding = NUR Unternehmen anlegen (Firmendaten/Admin-Konto). Unterkünfte
// (Channex-Property/Room-Type/Rate-Plan, Kanäle) werden danach im Objekte-Bereich
// gepflegt — das ist bewusst getrennt vom Onboarding.
type Step = "welcome" | "company" | "done";

export function OnboardingWizard({
  initialStatus,
  loginEmail,
}: {
  initialStatus?: OnboardingStatus;
  loginEmail?: string | null;
}) {
  const router = useRouter();
  const t = useTranslations("onboarding");
  const tc = useTranslations("common");
  const tCountry = useTranslations("countries");
  const tLegal = useTranslations("legalForms");
  const tExempt = useTranslations("exemption");
  const [pending, startTransition] = useTransition();

  // Startschritt anhand des gespeicherten Fortschritts wählen (Wiederaufnahme).
  function firstOpenStep(s?: OnboardingStatus): Step {
    if (!s) return "welcome";
    // Firmendaten sind der einzige Pflichtschritt. Danach ist das Onboarding
    // abgeschlossen; Unterkünfte legt der Kunde im Objekte-Bereich an.
    if (!s.company_data_set) return "welcome";
    return "done";
  }

  const [step, setStep] = useState<Step>(firstOpenStep(initialStatus));
  const [error, setError] = useState<string | null>(null);

  // Firmendaten (länderneutral, DACH + EU). Pflicht: A (Firma/Adresse/Kontakt)
  // + B (Steuer). C (Register/GF/Bank) optional/aufklappbar.
  const [firma, setFirma] = useState<FirmenProfil>({
    companyCountry: "DE",
    legalForm: "Einzelunternehmen",
    // Rechnungs-/Firmen-E-Mail mit der Login-E-Mail vorbelegen (editierbar).
    email: loginEmail ?? undefined,
  });
  const [smallBusiness, setSmallBusiness] = useState(false);
  const [showOptional, setShowOptional] = useState(false);

  function setF<K extends keyof FirmenProfil>(key: K, value: FirmenProfil[K]) {
    setFirma((prev) => ({ ...prev, [key]: value }));
  }

  // Rechtsformen folgen dem Land. Die Befreiungs-FAKTEN (Regime-Name, ob es
  // überhaupt eins gibt) folgen dem Firmensitz-Land; der angezeigte TEXT kommt
  // aus dem i18n-System in der UI-Sprache.
  const land = firma.companyCountry ?? "DE";
  const rechtsformen = rechtsformenFuerLand(land);
  const befreiung = befreiungFuerLand(land);
  // Land ohne nationales Befreiungsregime (z. B. ES): keine Checkbox.
  const kleinunternehmerMoeglich = befreiung.exists;
  // Checkbox-Text + Hinweis in UI-Sprache; mit Regime-Name, falls vorhanden.
  const kleinunternehmer = {
    label: befreiung.scheme
      ? tExempt("labelNamed", { scheme: befreiung.scheme })
      : tExempt("labelGeneric"),
    hinweis: befreiung.scheme
      ? tExempt("hintNamed", { scheme: befreiung.scheme })
      : tExempt("hintGeneric"),
  };
  // Wenn keine Befreiung möglich ist, gilt smallBusiness als false (USt-ID nötig).
  const istKleinunternehmer = kleinunternehmerMoeglich && smallBusiness;
  function setLand(code: string) {
    setFirma((prev) => {
      const formen = rechtsformenFuerLand(code);
      const legalForm =
        prev.legalForm && formen.includes(prev.legalForm)
          ? prev.legalForm
          : formen[0];
      return { ...prev, companyCountry: code, legalForm };
    });
  }

  // Fortschritt im Hintergrund speichern (best-effort; blockiert die UI nicht).
  function persist(patch: Partial<OnboardingStatus>) {
    void updateOnboarding(patch);
  }

  // Firmendaten speichern (Pflichtfelder prüfen) → tenant_billing_profile +
  // Status-Flag. Danach ist das Onboarding inhaltlich fertig (nur Unternehmen).
  function saveCompany() {
    setError(null);
    const required: [string | undefined, string][] = [
      [firma.companyName, t("company.field.companyName")],
      [firma.companyStreet, t("company.field.street")],
      [firma.companyHouseNumber, t("company.field.houseNumber")],
      [firma.companyPostalCode, t("company.field.postalCode")],
      [firma.companyCity, t("company.field.city")],
      [firma.companyCountry, t("company.field.country")],
      [firma.email, t("company.field.email")],
      [firma.phoneNumber, t("company.field.phone")],
    ];
    const missing = required.filter(([v]) => !v?.trim()).map(([, l]) => l);
    if (!istKleinunternehmer && !firma.vatId?.trim() && !firma.taxNumber?.trim()) {
      missing.push(t("company.field.vatOrTax"));
    }
    if (missing.length > 0) {
      setError(t("company.missing", { fields: missing.join(", ") }));
      return;
    }
    startTransition(async () => {
      const res = await saveFirmenProfil({
        ...firma,
        isSmallBusiness: istKleinunternehmer,
      });
      if (res.ok) {
        persist({ company_data_set: true });
        setStep("done");
      } else {
        setError(res.error);
      }
    });
  }

  function finish() {
    // Onboarding abschließen → Dashboard zeigt danach die normale Übersicht.
    // Unterkünfte legt der Kunde anschließend im Objekte-Bereich an.
    startTransition(async () => {
      await updateOnboarding({ completed: true });
      router.replace("/");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <ProgressBar step={step} />

      {step === "welcome" && (
        <Card>
          <Icon icon="ph:hand-waving" className="size-10 text-accent" />
          <h1 className="font-display text-2xl font-extrabold">
            {t("welcome.title")}
          </h1>
          <p className="text-muted-foreground">{t("welcome.text")}</p>
          <Button onClick={() => setStep("company")} className="self-start">
            {t("welcome.cta")}
          </Button>
        </Card>
      )}

      {step === "company" && (
        <Card>
          <h1 className="font-display text-2xl font-extrabold">
            {t("company.title")}
          </h1>
          <p className="text-muted-foreground">{t("company.text")}</p>

          {/* Durchgehendes 12-Spalten-Raster: alle Feldkanten fluchten. */}
          <div className="grid grid-cols-1 gap-x-3 gap-y-4 sm:grid-cols-12">
            {/* Firma */}
            <Field className="sm:col-span-6" label={t("company.companyName")}>
              <Input
                value={firma.companyName ?? ""}
                onChange={(e) => setF("companyName", e.target.value)}
                placeholder={t("company.companyNamePlaceholder")}
              />
            </Field>
            <Field className="sm:col-span-6" label={t("company.legalForm")}>
              <NativeSelect
                value={firma.legalForm ?? ""}
                onChange={(e) => setF("legalForm", e.target.value)}
              >
                {rechtsformen.map((r) => (
                  <option key={r} value={r}>
                    {rechtsformLabel(r, tLegal)}
                  </option>
                ))}
              </NativeSelect>
            </Field>

            {/* Adresse */}
            <Field className="sm:col-span-8" label={t("company.street")}>
              <Input
                value={firma.companyStreet ?? ""}
                onChange={(e) => setF("companyStreet", e.target.value)}
              />
            </Field>
            <Field className="sm:col-span-4" label={t("company.houseNumber")}>
              <Input
                value={firma.companyHouseNumber ?? ""}
                onChange={(e) => setF("companyHouseNumber", e.target.value)}
              />
            </Field>
            <Field className="sm:col-span-3" label={t("company.postalCode")}>
              <Input
                value={firma.companyPostalCode ?? ""}
                onChange={(e) => setF("companyPostalCode", e.target.value)}
              />
            </Field>
            <Field className="sm:col-span-6" label={t("company.city")}>
              <Input
                value={firma.companyCity ?? ""}
                onChange={(e) => setF("companyCity", e.target.value)}
              />
            </Field>
            <Field className="sm:col-span-3" label={t("company.country")}>
              <NativeSelect
                value={firma.companyCountry ?? "DE"}
                onChange={(e) => setLand(e.target.value)}
              >
                {LAENDER.map((l) => (
                  <option key={l.code} value={l.code}>
                    {tCountry(l.code)}
                  </option>
                ))}
              </NativeSelect>
            </Field>

            {/* Kontakt — Rechnungs-/Firmen-E-Mail (kann von Login abweichen) */}
            <Field className="sm:col-span-6" label={t("company.billingEmail")}>
              <Input
                type="email"
                value={firma.email ?? ""}
                onChange={(e) => setF("email", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {t("company.billingEmailHint")}
              </p>
            </Field>
            <Field className="sm:col-span-6" label={t("company.phone")}>
              <Input
                value={firma.phoneNumber ?? ""}
                onChange={(e) => setF("phoneNumber", e.target.value)}
              />
            </Field>
          </div>

          {/* B — Steuer (Bezeichnung folgt dem Land; ES hat kein Regime) */}
          {kleinunternehmerMoeglich && (
            <div className="flex flex-col gap-1">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={smallBusiness}
                  onChange={(e) => setSmallBusiness(e.target.checked)}
                />
                {kleinunternehmer.label}
              </label>
              <p className="pl-6 text-xs text-muted-foreground">
                {kleinunternehmer.hinweis}
              </p>
            </div>
          )}
          {!istKleinunternehmer && (
            <div className="grid grid-cols-1 gap-x-3 gap-y-4 sm:grid-cols-12">
              <Field className="sm:col-span-6" label={t("company.vatId")}>
                <Input
                  value={firma.vatId ?? ""}
                  onChange={(e) => setF("vatId", e.target.value)}
                  placeholder={`z. B. ${vatBeispielFuerLand(land)}`}
                />
              </Field>
              <Field className="sm:col-span-6" label={t("company.taxNumber")}>
                <Input
                  value={firma.taxNumber ?? ""}
                  onChange={(e) => setF("taxNumber", e.target.value)}
                />
              </Field>
            </div>
          )}

          {/* C — Optional */}
          <button
            type="button"
            onClick={() => setShowOptional((v) => !v)}
            className="flex items-center gap-1 self-start text-sm text-muted-foreground hover:text-foreground"
          >
            <Icon
              icon={showOptional ? "ph:caret-up" : "ph:caret-down"}
              className="size-4"
            />
            {t("company.moreOptional")}
          </button>
          {showOptional && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("company.website")}>
                <Input
                  value={firma.website ?? ""}
                  onChange={(e) => setF("website", e.target.value)}
                />
              </Field>
              <Field label={t("company.companyRegister")}>
                <Input
                  value={firma.companyRegister ?? ""}
                  onChange={(e) => setF("companyRegister", e.target.value)}
                />
              </Field>
              <Field label={t("company.districtCourt")}>
                <Input
                  value={firma.districtCourt ?? ""}
                  onChange={(e) => setF("districtCourt", e.target.value)}
                />
              </Field>
              <Field label={t("company.iban")}>
                <Input
                  value={firma.iban ?? ""}
                  onChange={(e) => setF("iban", e.target.value)}
                />
              </Field>
            </div>
          )}

          {error && <ErrorText>{error}</ErrorText>}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep("welcome")}>
              {tc("back")}
            </Button>
            <Button onClick={saveCompany} disabled={pending}>
              {pending ? t("company.saving") : tc("next")}
            </Button>
          </div>
        </Card>
      )}

      {step === "done" && (
        <Card>
          <span className="flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <Icon icon="ph:check-bold" className="size-6" />
          </span>
          <h1 className="font-display text-2xl font-extrabold">
            {t("done.title")}
          </h1>
          <p className="text-muted-foreground">{t("done.text")}</p>
          <Button onClick={finish} className="self-start">
            {t("done.toDashboard")}
          </Button>
        </Card>
      )}
    </div>
  );
}

// --- Hilfskomponenten -------------------------------------------------------
function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-2xl border border-border bg-card p-8 shadow-sm">
      {children}
    </div>
  );
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-(--radius) bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {children}
    </p>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label className="text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}

function ProgressBar({ step }: { step: Step }) {
  const tc = useTranslations("common");
  const order: Step[] = ["welcome", "company", "done"];
  const idx = order.indexOf(step);
  const pct = Math.round((idx / (order.length - 1)) * 100);
  return (
    <div className="w-full">
      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-accent transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {tc("stepOf", { current: idx + 1, total: order.length })}
      </p>
    </div>
  );
}
