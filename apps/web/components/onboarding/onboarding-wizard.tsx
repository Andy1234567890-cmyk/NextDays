"use client";

// Setup-Assistent fürs Hotel-Onboarding. Führt durch:
//  1) Willkommen
//  2) Verzweigung: "Schon auf Buchungsportalen aktiv?" (ja/nein)
//  3) Erstes Objekt anlegen (legt echtes Objekt an → Auto-Sync zum Provider)
//  4) Preis setzen (Basispreis je Nacht)
//  5) Kanäle: Neu → verbinden | Bestand → Portale verbinden + importieren
// Business-Logik im Backend; hier nur Orchestrierung (lib/properties, lib/channex).
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { ChannelConnectButton } from "@/components/channel-manager/channel-connect-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type FirmenProfil, saveFirmenProfil } from "@/lib/firmenprofil";
import { LAENDER, RECHTSFORMEN } from "@/lib/laender";
import type { OnboardingStatus } from "@/lib/onboarding";
import { updateOnboarding } from "@/lib/onboarding";
import { createProperty } from "@/lib/properties";

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
}: {
  channelManagerReady: boolean;
  initialStatus?: OnboardingStatus;
}) {
  const router = useRouter();
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
  });
  const [smallBusiness, setSmallBusiness] = useState(false);
  const [showOptional, setShowOptional] = useState(false);

  function setF<K extends keyof FirmenProfil>(key: K, value: FirmenProfil[K]) {
    setFirma((prev) => ({ ...prev, [key]: value }));
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
      [firma.companyName, "Firmenname"],
      [firma.companyStreet, "Straße"],
      [firma.companyHouseNumber, "Hausnummer"],
      [firma.companyPostalCode, "PLZ"],
      [firma.companyCity, "Ort"],
      [firma.companyCountry, "Land"],
      [firma.email, "E-Mail"],
      [firma.phoneNumber, "Telefon"],
    ];
    const missing = required.filter(([v]) => !v?.trim()).map(([, l]) => l);
    if (!smallBusiness && !firma.vatId?.trim() && !firma.taxNumber?.trim()) {
      missing.push("USt-ID oder Steuernummer");
    }
    if (missing.length > 0) {
      setError(`Bitte ausfüllen: ${missing.join(", ")}.`);
      return;
    }
    startTransition(async () => {
      const res = await saveFirmenProfil({
        ...firma,
        isSmallBusiness: smallBusiness,
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
            Willkommen bei myNextDays
          </h1>
          <p className="text-muted-foreground">
            In wenigen Schritten ist dein Betrieb startklar. Wir legen dein
            erstes Objekt an, setzen einen Preis und verbinden deine
            Buchungskanäle.
          </p>
          <Button onClick={() => setStep("company")} className="self-start">
            Los geht&apos;s
          </Button>
        </Card>
      )}

      {step === "company" && (
        <Card>
          <h1 className="font-display text-2xl font-extrabold">Firmendaten</h1>
          <p className="text-muted-foreground">
            Diese Angaben gehören zu deinem Konto und werden u. a. für
            Rechnungen und die Anbindung deiner Buchungsportale benötigt.
          </p>

          {/* A — Firma */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Firmenname *">
              <Input
                value={firma.companyName ?? ""}
                onChange={(e) => setF("companyName", e.target.value)}
                placeholder="z. B. Villa zur Sonne GmbH"
              />
            </Field>
            <Field label="Rechtsform *">
              <select
                value={firma.legalForm ?? ""}
                onChange={(e) => setF("legalForm", e.target.value)}
                className="h-10 rounded-full border border-border bg-background px-4 text-sm"
              >
                {RECHTSFORMEN.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {/* A — Adresse */}
          <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
            <Field label="Straße *">
              <Input
                value={firma.companyStreet ?? ""}
                onChange={(e) => setF("companyStreet", e.target.value)}
              />
            </Field>
            <Field label="Hausnummer *">
              <Input
                value={firma.companyHouseNumber ?? ""}
                onChange={(e) => setF("companyHouseNumber", e.target.value)}
              />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_2fr_1.5fr]">
            <Field label="PLZ *">
              <Input
                value={firma.companyPostalCode ?? ""}
                onChange={(e) => setF("companyPostalCode", e.target.value)}
              />
            </Field>
            <Field label="Ort *">
              <Input
                value={firma.companyCity ?? ""}
                onChange={(e) => setF("companyCity", e.target.value)}
              />
            </Field>
            <Field label="Land *">
              <select
                value={firma.companyCountry ?? "DE"}
                onChange={(e) => setF("companyCountry", e.target.value)}
                className="h-10 rounded-full border border-border bg-background px-4 text-sm"
              >
                {LAENDER.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {/* A — Kontakt */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="E-Mail *">
              <Input
                type="email"
                value={firma.email ?? ""}
                onChange={(e) => setF("email", e.target.value)}
              />
            </Field>
            <Field label="Telefon *">
              <Input
                value={firma.phoneNumber ?? ""}
                onChange={(e) => setF("phoneNumber", e.target.value)}
              />
            </Field>
          </div>

          {/* B — Steuer */}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={smallBusiness}
              onChange={(e) => setSmallBusiness(e.target.checked)}
            />
            Steuerbefreit (Kleinunternehmer) — keine USt-ID nötig
          </label>
          {!smallBusiness && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="USt-ID / VAT-ID">
                <Input
                  value={firma.vatId ?? ""}
                  onChange={(e) => setF("vatId", e.target.value)}
                  placeholder="z. B. DE123456789"
                />
              </Field>
              <Field label="oder Steuernummer">
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
            Weitere Angaben (optional)
          </button>
          {showOptional && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Website">
                <Input
                  value={firma.website ?? ""}
                  onChange={(e) => setF("website", e.target.value)}
                />
              </Field>
              <Field label="Handelsregister-Nr.">
                <Input
                  value={firma.companyRegister ?? ""}
                  onChange={(e) => setF("companyRegister", e.target.value)}
                />
              </Field>
              <Field label="Registergericht">
                <Input
                  value={firma.districtCourt ?? ""}
                  onChange={(e) => setF("districtCourt", e.target.value)}
                />
              </Field>
              <Field label="IBAN">
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
              Zurück
            </Button>
            <Button onClick={saveCompany} disabled={pending}>
              {pending ? "Speichert …" : "Weiter"}
            </Button>
          </div>
        </Card>
      )}

      {step === "branch" && (
        <Card>
          <h1 className="font-display text-2xl font-extrabold">
            Bist du schon auf Buchungsportalen aktiv?
          </h1>
          <p className="text-muted-foreground">
            Wenn du z.&nbsp;B. schon auf Booking.com oder Airbnb vermietest,
            verbinden wir deine bestehenden Konten und übernehmen deine Objekte
            &amp; Buchungen — du musst nichts doppelt anlegen.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectCard
              active={hasOta === true}
              icon="ph:plugs-connected"
              title="Ja, bin ich schon"
              desc="Bestehende Portale verbinden & importieren"
              onClick={() => setHasOta(true)}
            />
            <SelectCard
              active={hasOta === false}
              icon="ph:sparkle"
              title="Nein, ich starte neu"
              desc="Objekt neu anlegen und Kanäle frisch verbinden"
              onClick={() => setHasOta(false)}
            />
          </div>

          {hasOta === true && (
            <div className="flex flex-col gap-3 rounded-(--radius) border border-border p-4">
              <p className="text-sm font-medium">
                Welche Portale nutzt du bereits?
              </p>
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
            Weiter
          </Button>
        </Card>
      )}

      {step === "object" && (
        <Card>
          <h1 className="font-display text-2xl font-extrabold">
            Dein erstes Objekt
          </h1>
          <p className="text-muted-foreground">
            Lege dein erstes vermietbares Objekt an. Details (Adresse, Fotos,
            Ausstattung) kannst du später ergänzen.
          </p>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="objTitle" className="text-sm font-medium">
              Name des Objekts
            </label>
            <Input
              id="objTitle"
              value={objectTitle}
              onChange={(e) => setObjectTitle(e.target.value)}
              placeholder="z. B. Doppelzimmer Seeblick"
              maxLength={200}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="guests" className="text-sm font-medium">
              Maximale Gästezahl
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
              Zurück
            </Button>
            <Button
              onClick={saveObject}
              disabled={pending || objectTitle.trim().length === 0}
            >
              {pending ? "Wird angelegt …" : "Objekt anlegen"}
            </Button>
          </div>
        </Card>
      )}

      {step === "price" && (
        <Card>
          <h1 className="font-display text-2xl font-extrabold">
            Basispreis je Nacht
          </h1>
          <p className="text-muted-foreground">
            Setze einen Startpreis. Saison- und Kanalpreise kannst du später
            feinjustieren.
          </p>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="price" className="text-sm font-medium">
              Preis pro Nacht (€)
            </label>
            <Input
              id="price"
              type="number"
              min={0}
              step="1"
              value={basePrice}
              onChange={(e) => setBasePrice(e.target.value)}
              placeholder="z. B. 120"
              className="w-40"
            />
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setStep("object")}>
              Zurück
            </Button>
            <Button onClick={goToChannels}>Weiter</Button>
          </div>
        </Card>
      )}

      {step === "channels" && (
        <Card>
          <h1 className="font-display text-2xl font-extrabold">
            {hasOta ? "Portale verbinden & importieren" : "Buchungskanäle verbinden"}
          </h1>

          {!channelManagerReady && (
            <p className="rounded-(--radius) border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
              Die Kanal-Anbindung wird gerade für deinen Betrieb vorbereitet. Du
              kannst sie jederzeit später unter „Channel Manager"
              abschließen.
            </p>
          )}

          {hasOta ? (
            <div className="flex flex-col gap-3">
              <p className="text-muted-foreground">
                Wir verbinden deine bestehenden Konten und übernehmen Objekte
                &amp; Buchungen. Wähle die Portale, die du verbinden möchtest:
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
                <ChannelConnectButton label="Portale jetzt verbinden" />
              ) : null}
              <p className="text-xs text-muted-foreground">
                Der Verbindungs-Assistent (Zugang + Objekt-Zuordnung) öffnet sich
                eingebettet. Du kannst ihn auch später unter „Einstellungen →
                Channel-Manager" aufrufen.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-muted-foreground">
                Dein Objekt ist angelegt. Sobald du Kanäle verbindest, verteilen
                wir Verfügbarkeit und Preise automatisch an Booking.com, Airbnb
                &amp; Co. — und Buchungen landen direkt in deinem Kalender.
              </p>
              {channelManagerReady ? (
                <ChannelConnectButton label="Kanäle verbinden" variant="outline" />
              ) : null}
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setStep("price")}>
              Zurück
            </Button>
            <Button onClick={() => setStep("done")}>Setup abschließen</Button>
          </div>
        </Card>
      )}

      {step === "done" && (
        <Card>
          <span className="flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <Icon icon="ph:check-bold" className="size-6" />
          </span>
          <h1 className="font-display text-2xl font-extrabold">
            Geschafft — dein Betrieb ist startklar!
          </h1>
          <p className="text-muted-foreground">
            Du kannst jetzt im Dashboard weitere Objekte anlegen, Preise
            verfeinern und deine Kanäle final verbinden.
          </p>
          <Button onClick={finish} className="self-start">
            Zum Dashboard
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
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
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
