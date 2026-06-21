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

import { ChannelConnectButton } from "@/components/channel-manager/channel-connect-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { type FirmenProfil, saveFirmenProfil } from "@/lib/firmenprofil";
import {
  LAENDER,
  kleinunternehmerLabelFuerLand,
  rechtsformenFuerLand,
  vatBeispielFuerLand,
} from "@/lib/laender";
import type { OnboardingStatus } from "@/lib/onboarding";
import { updateOnboarding } from "@/lib/onboarding";
import { createProperty } from "@/lib/properties";
import { cn } from "@/lib/utils";

type Step =
  | "welcome"
  | "company"
  | "branch"
  | "object"
  | "price"
  | "channels"
  | "done";

// Portale, die ein Hotel evtl. schon nutzt (für den Bestands-Pfad).
const PORTALE = [
  { code: "BookingCom", label: "Booking.com", icon: "simple-icons:bookingdotcom" },
  { code: "Expedia", label: "Expedia", icon: "simple-icons:expedia" },
  { code: "Airbnb", label: "Airbnb", icon: "simple-icons:airbnb" },
] as const;

export function OnboardingWizard({
  channelManagerReady,
  initialStatus,
  loginEmail,
}: {
  channelManagerReady: boolean;
  initialStatus?: OnboardingStatus;
  loginEmail?: string | null;
}) {
  const router = useRouter();
  const t = useTranslations("onboarding");
  const tc = useTranslations("common");
  const [pending, startTransition] = useTransition();

  // Startschritt anhand des gespeicherten Fortschritts wählen (Wiederaufnahme).
  function firstOpenStep(s?: OnboardingStatus): Step {
    if (!s) return "welcome";
    // Firmendaten sind der erste Pflichtschritt (Konto vollständig + nötig für
    // die Channel-Anbindung). Ohne sie geht es nicht weiter.
    if (!s.company_data_set) return "welcome";
    if (!s.object_created) return s.has_ota === null ? "branch" : "object";
    if (!s.price_set) return "price";
    if (!s.channels_done) return "channels";
    return "done";
  }

  const [step, setStep] = useState<Step>(firstOpenStep(initialStatus));
  const [error, setError] = useState<string | null>(null);

  // Verzweigung: schon auf Portalen aktiv?
  const [hasOta, setHasOta] = useState<boolean | null>(
    initialStatus?.has_ota ?? null,
  );
  const [selectedPortals, setSelectedPortals] = useState<string[]>(
    initialStatus?.selected_portals ?? [],
  );

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

  // Rechtsformen + Kleinunternehmer-Label folgen dem Land.
  const land = firma.companyCountry ?? "DE";
  const rechtsformen = rechtsformenFuerLand(land);
  const kleinunternehmer = kleinunternehmerLabelFuerLand(land);
  // Länder ohne nationales Befreiungsregime (z. B. ES): keine Checkbox.
  const kleinunternehmerMoeglich = kleinunternehmer.exists !== false;
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

  // Erstes Objekt
  const [objectTitle, setObjectTitle] = useState("");
  const [maxGuests, setMaxGuests] = useState(2);

  // Preis (Basispreis je Nacht, in Euro)
  const [basePrice, setBasePrice] = useState("");

  // Fortschritt im Hintergrund speichern (best-effort; blockiert die UI nicht).
  function persist(patch: Partial<OnboardingStatus>) {
    void updateOnboarding(patch);
  }

  function togglePortal(code: string) {
    setSelectedPortals((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  }

  function saveObject() {
    setError(null);
    startTransition(async () => {
      const res = await createProperty({
        title: objectTitle.trim(),
        property_type: "appartement",
        max_guests: maxGuests,
        status: "draft",
      });
      if (res.ok) {
        persist({ object_created: true });
        setStep("price");
      } else {
        setError(res.error);
      }
    });
  }

  // Firmendaten speichern (Pflichtfelder prüfen) → tenant_billing_profile +
  // Status-Flag. Erst danach geht es weiter.
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
        setStep("branch");
      } else {
        setError(res.error);
      }
    });
  }

  function goToObject() {
    persist({ has_ota: hasOta, selected_portals: selectedPortals });
    setStep("object");
  }

  function goToChannels() {
    persist({ price_set: true });
    setStep("channels");
  }

  function finish() {
    // Onboarding abschließen → Dashboard zeigt danach die normale Übersicht.
    startTransition(async () => {
      await updateOnboarding({ channels_done: true, completed: true });
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
                    {r}
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
                    {l.label}
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

      {step === "branch" && (
        <Card>
          <h1 className="font-display text-2xl font-extrabold">
            {t("branch.title")}
          </h1>
          <p className="text-muted-foreground">{t("branch.text")}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectCard
              active={hasOta === true}
              icon="ph:plugs-connected"
              title={t("branch.yesTitle")}
              desc={t("branch.yesDesc")}
              onClick={() => setHasOta(true)}
            />
            <SelectCard
              active={hasOta === false}
              icon="ph:sparkle"
              title={t("branch.noTitle")}
              desc={t("branch.noDesc")}
              onClick={() => setHasOta(false)}
            />
          </div>

          {hasOta === true && (
            <div className="flex flex-col gap-3 rounded-(--radius) border border-border p-4">
              <p className="text-sm font-medium">{t("branch.whichPortals")}</p>
              <div className="flex flex-wrap gap-2">
                {PORTALE.map((p) => (
                  <button
                    key={p.code}
                    type="button"
                    onClick={() => togglePortal(p.code)}
                    className={
                      "flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors " +
                      (selectedPortals.includes(p.code)
                        ? "border-accent bg-accent/10 text-foreground"
                        : "border-border hover:bg-secondary")
                    }
                  >
                    <Icon icon={p.icon} className="size-4" />
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <Button
            onClick={goToObject}
            disabled={hasOta === null}
            className="self-start"
          >
            {tc("next")}
          </Button>
        </Card>
      )}

      {step === "object" && (
        <Card>
          <h1 className="font-display text-2xl font-extrabold">
            {t("object.title")}
          </h1>
          <p className="text-muted-foreground">{t("object.text")}</p>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="objTitle" className="text-sm font-medium">
              {t("object.name")}
            </label>
            <Input
              id="objTitle"
              value={objectTitle}
              onChange={(e) => setObjectTitle(e.target.value)}
              placeholder={t("object.namePlaceholder")}
              maxLength={200}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="guests" className="text-sm font-medium">
              {t("object.maxGuests")}
            </label>
            <Input
              id="guests"
              type="number"
              min={1}
              max={50}
              value={maxGuests}
              onChange={(e) => setMaxGuests(Number(e.target.value) || 1)}
              className="w-32"
            />
          </div>
          {error && <ErrorText>{error}</ErrorText>}
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setStep("branch")}>
              {tc("back")}
            </Button>
            <Button
              onClick={saveObject}
              disabled={pending || objectTitle.trim().length === 0}
            >
              {pending ? t("object.creating") : t("object.create")}
            </Button>
          </div>
        </Card>
      )}

      {step === "price" && (
        <Card>
          <h1 className="font-display text-2xl font-extrabold">
            {t("price.title")}
          </h1>
          <p className="text-muted-foreground">{t("price.text")}</p>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="price" className="text-sm font-medium">
              {t("price.perNight")}
            </label>
            <Input
              id="price"
              type="number"
              min={0}
              step="1"
              value={basePrice}
              onChange={(e) => setBasePrice(e.target.value)}
              placeholder={t("price.pricePlaceholder")}
              className="w-40"
            />
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setStep("object")}>
              {tc("back")}
            </Button>
            <Button onClick={goToChannels}>{tc("next")}</Button>
          </div>
        </Card>
      )}

      {step === "channels" && (
        <Card>
          <h1 className="font-display text-2xl font-extrabold">
            {hasOta ? t("channels.titleImport") : t("channels.titleConnect")}
          </h1>

          {!channelManagerReady && (
            <p className="rounded-(--radius) border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
              {t("channels.notReady")}
            </p>
          )}

          {hasOta ? (
            <div className="flex flex-col gap-3">
              <p className="text-muted-foreground">
                {t("channels.importIntro")}
              </p>
              <ul className="flex flex-col divide-y divide-border rounded-(--radius) border border-border">
                {PORTALE.filter(
                  (p) =>
                    selectedPortals.length === 0 ||
                    selectedPortals.includes(p.code),
                ).map((p) => (
                  <li key={p.code} className="flex items-center gap-3 p-3">
                    <Icon icon={p.icon} className="size-5" />
                    <span className="flex-1 text-sm font-medium">{p.label}</span>
                  </li>
                ))}
              </ul>
              {channelManagerReady ? (
                <ChannelConnectButton label={t("channels.connectExisting")} />
              ) : null}
              <p className="text-xs text-muted-foreground">
                {t("channels.importHint")}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-muted-foreground">{t("channels.newIntro")}</p>
              {channelManagerReady ? (
                <ChannelConnectButton
                  label={t("channels.connectNew")}
                  variant="outline"
                />
              ) : null}
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setStep("price")}>
              {tc("back")}
            </Button>
            <Button onClick={() => setStep("done")}>
              {t("channels.finish")}
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

function SelectCard({
  active,
  icon,
  title,
  desc,
  onClick,
}: {
  active: boolean;
  icon: string;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex flex-col items-start gap-2 rounded-(--radius) border p-4 text-left transition-colors " +
        (active ? "border-accent bg-accent/10" : "border-border hover:bg-secondary")
      }
    >
      <Icon icon={icon} className="size-6 text-accent" />
      <span className="font-medium">{title}</span>
      <span className="text-sm text-muted-foreground">{desc}</span>
    </button>
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
  const order: Step[] = [
    "welcome",
    "company",
    "branch",
    "object",
    "price",
    "channels",
    "done",
  ];
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
        Schritt {idx + 1} von {order.length}
      </p>
    </div>
  );
}
