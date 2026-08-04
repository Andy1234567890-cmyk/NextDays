"use client";

// Onboarding-Assistent. Legt ein Unternehmen VOLLSTÄNDIG an (Firma + erste
// Unterkunft mit allen Channex-Pflichtfeldern). Regel: vollständig oder nichts —
// fehlen Daten, wird kein Unternehmen/keine Property angelegt.
//  1) Willkommen
//  2) Betriebsart (Ferienunterkunft oder Hotel — steuert die Navigation)
//  3) Firma & Adresse (Admin-Konto)
//  4) Steuern & Zahlungen (USt/Kleinunternehmer, Register, Stripe-KYC)
//  5) Fertig (erst wenn alles vollständig)
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { AddressPlacesSearch } from "@/components/address-places-search";
import { SwitcherImport } from "@/components/onboarding/switcher-import";
import { ensureChannexAccount } from "@/lib/channex";
import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";
import { NativeSelect } from "@nextdays/ui/native-select";
import type { AccommodationType } from "@/lib/api";
import { setAccommodationType } from "@/lib/auth";
import {
  type FirmenProfil,
  getFirmenProfil,
  saveFirmenProfil,
} from "@/lib/firmenprofil";
import {
  LAENDER,
  befreiungFuerLand,
  rechtsformLabel,
  rechtsformenFuerLand,
  hatRegistergericht,
  vatBeispielFuerLand,
} from "@/lib/laender";
import type { OnboardingStatus } from "@/lib/onboarding";
import { updateOnboarding } from "@/lib/onboarding";
import { cn } from "@/lib/utils";

// Nach Firma+Steuer+Channex-Gate teilt sich das Onboarding: „branch" fragt, ob
// der Betrieb schon auf Portalen verkauft (Wechselkunde) oder neu ist. „switch"
// = geführter Bestandsimport, „done" = Neukunden-Abschluss.
type Step = "welcome" | "type" | "company" | "tax" | "branch" | "switch" | "done";

type CustomerType = "new" | "switch";

export function OnboardingWizard({
  initialStatus,
  loginEmail,
  initialAccommodationType,
}: {
  initialStatus?: OnboardingStatus;
  loginEmail?: string | null;
  // Bereits am Betrieb gewählte Betriebsart (tenants.accommodation_type) — belegt
  // die Auswahl in Schritt 2 vor, statt eine erneute Wahl zu erzwingen.
  initialAccommodationType?: AccommodationType | null;
}) {
  const router = useRouter();
  const t = useTranslations("onboarding");
  const tc = useTranslations("common");
  const tCountry = useTranslations("countries");
  const tLegal = useTranslations("legalForms");
  const tExempt = useTranslations("exemption");
  // Betriebsart-Labels/Hints: gleicher Namespace wie der Konto-Abschnitt
  // (bereits in allen 24 Sprachen gepflegt).
  const tAcc = useTranslations("accommodationType");
  const [pending, startTransition] = useTransition();

  // Startschritt anhand des gespeicherten Fortschritts wählen (Wiederaufnahme).
  // Vollständig oder nichts: erst Firma, dann Unterkunft; "done" erst wenn beides
  // angelegt ist (object_created).
  function firstOpenStep(s?: OnboardingStatus): Step {
    if (!s) return "welcome";
    if (!s.company_data_set) return "welcome";
    // Firma steht → Weiche. Bereits gewählter Zweig wird wiederaufgenommen.
    if (s.customer_type === "switch") return "switch";
    if (s.customer_type === "new") return "done";
    return "branch";
  }

  const [step, setStep] = useState<Step>(firstOpenStep(initialStatus));
  const [customerType, setCustomerType] = useState<CustomerType | null>(
    initialStatus?.customer_type ?? null,
  );
  const [error, setError] = useState<string | null>(null);

  // Betriebsart (Ferienunterkunft/Hotel): bewusst OHNE Vorauswahl — der Kunde
  // entscheidet explizit (vollständig oder nichts); wird beim Weiter sofort am
  // Mandanten gespeichert und steuert die Dashboard-Navigation.
  const [accommodationType, setAccType] = useState<AccommodationType | null>(
    initialAccommodationType ?? null,
  );

  function saveType() {
    if (!accommodationType) return;
    setError(null);
    startTransition(async () => {
      const res = await setAccommodationType(accommodationType);
      if (res.ok) setStep("company");
      else setError(res.error);
    });
  }

  // Firmendaten (länderneutral, DACH + EU). Pflicht: A (Firma/Adresse/Kontakt)
  // + B (Steuer). C (Register/GF/Bank) optional/aufklappbar.
  const [firma, setFirma] = useState<FirmenProfil>({
    companyCountry: "DE",
    legalForm: "Einzelunternehmen",
    // Rechnungs-/Firmen-E-Mail mit der Login-E-Mail vorbelegen (editierbar).
    email: loginEmail ?? undefined,
    // Stripe-Kontotyp: Default „Einzelperson" (entspricht dem DB-Default
    // tenant_billing_profile.account_type='individual'). Geburtsdatum bleibt leer
    // bis der Nutzer es ausfüllt — kein erfundener Wert (Projektregel).
    accountType: "individual",
  });
  const [smallBusiness, setSmallBusiness] = useState(false);

  // Bereits gespeicherte Firmendaten vorbefüllen (dieselbe Quelle wie /konto:
  // tenant_billing_profile via getFirmenProfil). Onboarding und Konto arbeiten so
  // bidirektional auf EINEM Datentopf — kein doppeltes Ausfüllen. Nur gesetzte
  // Werte übernehmen (leere DB-Felder überschreiben die Onboarding-Defaults wie
  // Land/Rechtsform nicht).
  useEffect(() => {
    let active = true;
    void getFirmenProfil().then((res) => {
      if (!active || !res.ok) return;
      const d = res.data;
      const s = (k: string): string | undefined =>
        typeof d[k] === "string" && d[k] ? (d[k] as string) : undefined;
      // Nur die string-wertigen Firmen-/Adress-/Steuer-Felder vorbefüllen
      // (lodgingTaxRate/isSmallBusiness sind nicht-string und werden separat
      // behandelt). Typsicher über einen string-Record.
      const stringKeys = [
        "companyName", "legalForm", "companyStreet", "companyHouseNumber",
        "companyPostalCode", "companyCity", "companyState", "companyCountry",
        "email", "phoneNumber", "website", "vatId", "taxNumber",
        "companyRegister", "districtCourt", "firstName", "lastName", "ownerDob",
        // Bankdaten (unter /konto gepflegt) mitnehmen — Zahlungsfreischaltung.
        "iban", "bic", "accountHolder",
      ] as const;
      const patch: Record<string, string> = {};
      for (const k of stringKeys) {
        const v = s(k);
        if (v !== undefined) patch[k] = v;
      }
      const at = s("accountType");
      if (at === "individual" || at === "company") patch.accountType = at;
      setFirma((prev) => ({ ...prev, ...(patch as Partial<FirmenProfil>) }));
      if (typeof d.isSmallBusiness === "boolean") setSmallBusiness(d.isSmallBusiness);
    });
    return () => {
      active = false;
    };
  }, []);

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

  // Adresse aus dem Places-Picker STRUKTURIERT übernehmen (Straße/Nr./PLZ/Stadt/
  // Bundesland getrennt) — kein Freitext-Raten. Land nur setzen, wenn Places es
  // liefert (setLand zieht die Rechtsform-Liste nach); leere Felder überschreiben
  // Bestehendes nicht.
  function applyPlace(a: {
    street: string; houseNumber: string; postalCode: string;
    city: string; state: string; country: string;
  }) {
    setFirma((prev) => {
      const next = { ...prev };
      if (a.street) next.companyStreet = a.street;
      if (a.houseNumber) next.companyHouseNumber = a.houseNumber;
      if (a.postalCode) next.companyPostalCode = a.postalCode;
      if (a.city) next.companyCity = a.city;
      if (a.state) next.companyState = a.state;
      if (a.country) {
        const formen = rechtsformenFuerLand(a.country);
        next.companyCountry = a.country;
        if (!next.legalForm || !formen.includes(next.legalForm)) {
          next.legalForm = formen[0];
        }
      }
      return next;
    });
  }

  // Fortschritt im Hintergrund speichern (best-effort; blockiert die UI nicht).
  function persist(patch: Partial<OnboardingStatus>) {
    void updateOnboarding(patch);
  }

  // Schritt „Firma & Adresse": nur die Stammdaten-Pflichtfelder prüfen, dann
  // weiter zum Steuer-Schritt (gespeichert wird erst dort, komplett).
  function nextFromCompany() {
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
    if (missing.length > 0) {
      setError(t("company.missing", { fields: missing.join(", ") }));
      return;
    }
    setStep("tax");
  }

  // Schritt „Steuern & Zahlungen": Steuer-Pflicht prüfen, dann ALLES speichern
  // → tenant_billing_profile + Status-Flag (vollständig oder nichts).
  function saveCompany() {
    setError(null);
    if (!istKleinunternehmer && !firma.vatId?.trim() && !firma.taxNumber?.trim()) {
      setError(t("company.missing", { fields: t("company.field.vatOrTax") }));
      return;
    }
    // IBAN ist Pflicht: ohne sie gibt es keine Auszahlung. Ein Onboarding, das
    // hier durchläuft, hinterlässt einen Betrieb, der verkaufen kann, aber sein
    // Geld nicht bekommt.
    if (!firma.iban?.trim()) {
      setError(t("company.missing", { fields: t("company.field.iban") }));
      return;
    }
    startTransition(async () => {
      const res = await saveFirmenProfil({
        ...firma,
        isSmallBusiness: istKleinunternehmer,
        // Geburtsdatum nur senden, wenn ausgefüllt — kein leerer/erfundener Wert.
        ownerDob: firma.ownerDob?.trim() ? firma.ownerDob : undefined,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      // GATE (Regel „vollständig oder nichts"): Der Channex-Account (Portal-
      // Group) MUSS existieren, bevor das Onboarding fertig ist — er ist die
      // Basis für spätere Objekte/OTA-Anbindung. Fail-CLOSED: schlägt das
      // Anlegen fehl, bleibt das Onboarding offen (kein company_data_set, kein
      // „done"), mit klarer Meldung. Idempotent, daher bei Erneut-Versuch sicher.
      const acct = await ensureChannexAccount();
      if (!acct.ok) {
        setError(acct.error);
        return;
      }
      persist({ company_data_set: true });
      // Weiche: Neukunde vs. Wechselkunde (Bestandsimport).
      setStep("branch");
    });
  }

  // Weiche beantworten: Zweig merken (DB + State) und dorthin springen.
  function chooseCustomerType(kind: CustomerType) {
    setCustomerType(kind);
    persist({ customer_type: kind });
    setStep(kind === "switch" ? "switch" : "done");
  }

  const isHotel = accommodationType === "hotel";

  function finish() {
    // Onboarding abschließen → Dashboard zeigt danach die normale Übersicht.
    startTransition(async () => {
      await updateOnboarding({ customer_type: "new", completed: true });
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
          <Button onClick={() => setStep("type")} className="self-start">
            {t("welcome.cta")}
          </Button>
        </Card>
      )}

      {step === "type" && (
        <Card>
          <h1 className="font-display text-2xl font-extrabold">
            {t("type.title")}
          </h1>
          <p className="text-muted-foreground">{t("type.text")}</p>
          <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
            {(
              [
                { value: "vacation_rental", icon: "ph:house-line" },
                { value: "hotel", icon: "ph:bed" },
              ] as const
            ).map((opt) => {
              const active = accommodationType === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setAccType(opt.value)}
                  className={cn(
                    "flex items-center gap-3 rounded-(--radius) border p-4 text-left transition",
                    active
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-secondary/50",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-full",
                      active
                        ? "bg-primary/10 text-primary"
                        : "bg-secondary text-muted-foreground",
                    )}
                  >
                    <Icon icon={opt.icon} className="size-5" />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="text-sm font-medium">{tAcc(opt.value)}</span>
                    <span className="text-xs text-muted-foreground">
                      {tAcc(`${opt.value}Hint`)}
                    </span>
                  </span>
                  {active && (
                    <Icon
                      icon="ph:check-circle-fill"
                      className="ml-auto size-5 shrink-0 text-primary"
                    />
                  )}
                </button>
              );
            })}
          </div>
          {error && <ErrorText>{error}</ErrorText>}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep("welcome")}>
              {tc("back")}
            </Button>
            <Button onClick={saveType} disabled={pending || !accommodationType}>
              {tc("next")}
            </Button>
          </div>
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

            {/* Straße = Places-Autocomplete: manuell tippbar UND befüllt bei
                Auswahl Nr./PLZ/Stadt/Bundesland/Land strukturiert (kein Raten,
                kein Extra-Suchfeld). */}
            <Field className="sm:col-span-8" label={t("company.street")}>
              <AddressPlacesSearch
                value={firma.companyStreet ?? ""}
                onChange={(v) => setF("companyStreet", v)}
                onPick={applyPlace}
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

            <Field className="sm:col-span-6" label={t("company.state")}>
              <Input
                value={firma.companyState ?? ""}
                onChange={(e) => setF("companyState", e.target.value)}
                placeholder={t("company.statePlaceholder")}
              />
            </Field>
            <Field className="sm:col-span-6" label={t("company.website")}>
              <Input
                value={firma.website ?? ""}
                onChange={(e) => setF("website", e.target.value)}
                placeholder="https://"
              />
            </Field>
          </div>

          {error && <ErrorText>{error}</ErrorText>}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep("type")}>
              {tc("back")}
            </Button>
            <Button onClick={nextFromCompany} disabled={pending}>
              {tc("next")}
            </Button>
          </div>
        </Card>
      )}

      {step === "tax" && (
        <Card>
          <h1 className="font-display text-2xl font-extrabold">
            {t("tax.title")}
          </h1>
          <p className="text-muted-foreground">{t("tax.text")}</p>

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
                  autoComplete="nd-vatId"
                value={firma.vatId ?? ""}
                  onChange={(e) => setF("vatId", e.target.value)}
                  placeholder={`z. B. ${vatBeispielFuerLand(land)}`}
                />
              </Field>
              <Field className="sm:col-span-6" label={t("company.taxNumber")}>
                <Input
                  autoComplete="nd-taxNumber"
                value={firma.taxNumber ?? ""}
                  onChange={(e) => setF("taxNumber", e.target.value)}
                />
              </Field>
            </div>
          )}

          {/* C — Weitere Angaben (direkt sichtbar, kein Aufklappen) */}
          {/* IBAN ist PFLICHT, nicht optional: ohne Bankverbindung kann der
              Betrieb keine Auszahlung erhalten — ein Konto ohne IBAN ist
              betriebsbereit nur zum Schein. Steht deshalb bei den Steuerdaten
              und NICHT unter „Weitere Angaben (optional)". */}
          <div className="grid grid-cols-1 gap-x-3 gap-y-4 sm:grid-cols-2">
            <Field label={t("company.iban")}>
              <Input
                autoComplete="nd-iban"
                value={firma.iban ?? ""}
                onChange={(e) => setF("iban", e.target.value)}
              />
            </Field>
          </div>

          {/* C — Weitere Angaben, wirklich optional */}
          <p className="text-sm font-medium text-muted-foreground">
            {t("company.moreOptional")}
          </p>
          <div className="grid grid-cols-1 gap-x-3 gap-y-4 sm:grid-cols-2">
            <Field label={t("company.companyRegister")}>
              <Input
                autoComplete="nd-companyRegister"
                value={firma.companyRegister ?? ""}
                onChange={(e) => setF("companyRegister", e.target.value)}
              />
            </Field>
            {/* Registergericht gibt es nur, wo ein GERICHT das Register führt.
                In DK führt es die Erhvervsstyrelsen (nur CVR-Nummer), in
                SE/NL/… eine Behörde bzw. Handelskammer — dort wäre das Feld
                eine Frage ohne Antwort (Allowlist in lib/laender.ts). */}
            {hatRegistergericht(land) && (
              <Field label={t("company.districtCourt")}>
                <Input
                  autoComplete="nd-districtCourt"
                  value={firma.districtCourt ?? ""}
                  onChange={(e) => setF("districtCourt", e.target.value)}
                />
              </Field>
            )}
          </div>

          {/* Stripe-KYC: Kontotyp + Geburtsdatum für die Zahlungsfreischaltung.
              Bei „Firma" bezieht sich das Geburtsdatum auf die vertretungs-
              berechtigte Person. */}
          <p className="text-sm font-medium text-muted-foreground">
            {t("company.paymentActivation")}
          </p>
          <div className="grid grid-cols-1 gap-x-3 gap-y-4 sm:grid-cols-2">
            <Field label={t("company.accountType")}>
              <NativeSelect
                value={firma.accountType ?? "individual"}
                onChange={(e) =>
                  setF(
                    "accountType",
                    e.target.value as "individual" | "company",
                  )
                }
              >
                <option value="individual">
                  {t("company.accountTypeIndividual")}
                </option>
                <option value="company">
                  {t("company.accountTypeCompany")}
                </option>
              </NativeSelect>
            </Field>
            <Field
              label={
                firma.accountType === "company"
                  ? t("company.ownerDobCompany")
                  : t("company.ownerDob")
              }
            >
              <Input
                type="date"
                value={firma.ownerDob ?? ""}
                onChange={(e) => setF("ownerDob", e.target.value)}
              />
            </Field>
          </div>

          {error && <ErrorText>{error}</ErrorText>}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep("company")}>
              {tc("back")}
            </Button>
            <Button onClick={saveCompany} disabled={pending}>
              {pending ? t("company.saving") : tc("next")}
            </Button>
          </div>
        </Card>
      )}

      {step === "branch" && (
        <Card>
          <h1 className="font-display text-2xl font-extrabold">
            {t("branch.title")}
          </h1>
          <p className="text-muted-foreground">{t("branch.text")}</p>
          <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
            {(
              [
                { value: "switch", icon: "ph:arrows-left-right" },
                { value: "new", icon: "ph:sparkle" },
              ] as const
            ).map((opt) => {
              const active = customerType === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => chooseCustomerType(opt.value)}
                  className={cn(
                    "flex items-start gap-3 rounded-(--radius) border p-4 text-left transition",
                    active
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-secondary/50",
                  )}
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                    <Icon icon={opt.icon} className="size-5" />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="text-sm font-medium">
                      {t(`branch.${opt.value}Title`)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t(`branch.${opt.value}Text`)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <Button variant="outline" onClick={() => setStep("tax")}>
            {tc("back")}
          </Button>
        </Card>
      )}

      {step === "switch" && (
        <Card>
          <h1 className="font-display text-2xl font-extrabold">
            {t("switch.title")}
          </h1>
          <p className="text-muted-foreground">{t("switch.intro")}</p>
          <SwitcherImport accommodationType={accommodationType} />
          <Button
            variant="ghost"
            onClick={() => setStep("branch")}
            className="self-start"
          >
            <Icon icon="ph:arrow-left" className="mr-1 size-4" />
            {tc("back")}
          </Button>
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

          {/* Reihenfolge belegt (Channex-Account steht bereits als Gate): jetzt
              Objekt anlegen → Preise → Portale verbinden. Der vollwertige
              Objekte-/Kanäle-Bereich hat ALLE Pflichtfelder — hier nur der Weg
              dorthin, kein halber Push. */}
          <ol className="flex w-full flex-col gap-3">
            <NextStep
              n={1}
              icon={isHotel ? "ph:bed" : "ph:house-line"}
              title={t(isHotel ? "done.step1TitleHotel" : "done.step1Title")}
              text={t(isHotel ? "done.step1TextHotel" : "done.step1Text")}
            />
            <NextStep
              n={2}
              icon="ph:tag"
              title={t("done.step2Title")}
              text={t("done.step2Text")}
            />
            <NextStep
              n={3}
              icon="ph:broadcast"
              title={t("done.step3Title")}
              text={t("done.step3Text")}
            />
          </ol>

          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => {
                startTransition(async () => {
                  await updateOnboarding({
                    customer_type: "new",
                    completed: true,
                  });
                  router.replace("/objekte");
                  router.refresh();
                });
              }}
              disabled={pending}
            >
              <Icon icon="ph:plus" className="mr-1.5 size-4" />
              {t(isHotel ? "done.ctaCreateRoom" : "done.ctaCreateObject")}
            </Button>
            <Button variant="outline" onClick={finish} disabled={pending}>
              {t("done.toDashboard")}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

// --- Hilfskomponenten -------------------------------------------------------
// Ein nummerierter „nächster Schritt" im geführten Fertig-Bildschirm.
function NextStep({
  n,
  icon,
  title,
  text,
}: {
  n: number;
  icon: string;
  title: string;
  text: string;
}) {
  return (
    <li className="flex items-start gap-3 rounded-(--radius) border border-border p-3">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold">
        {n}
      </span>
      <Icon icon={icon} className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
      <span className="flex flex-col">
        <span className="font-medium">{title}</span>
        <span className="text-sm text-muted-foreground">{text}</span>
      </span>
    </li>
  );
}

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
  // branch/switch/done sind alternative Endzustände nach der Weiche → als letzter
  // Schritt gezählt (Firmendaten stehen, nur noch Zweig-Aktion).
  const order: Step[] = ["welcome", "type", "company", "tax", "branch"];
  const endStates: Step[] = ["branch", "switch", "done"];
  const idx = endStates.includes(step) ? order.length - 1 : order.indexOf(step);
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
