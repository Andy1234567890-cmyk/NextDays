"use client";

// Konto → Profil (wie Lodgify „My account / Profile").
// ALLES gebündelt auf einer Seite: Logo, Rechnungskontakt (Firma/Adresse/Steuer/
// Bank), Stammdaten (Person/Telefon/Geburtsdatum/Kontotyp), Website — plus der
// Zahlungs-Abschnitt darunter. Kein separater Dialog, kein eigener Tab. Quelle
// und Ziel ist durchgehend das Firmenprofil (tenant_billing_profile); ein
// Speichern schreibt alles und löst den Stripe-Auto-Connect aus.
import { Icon } from "@iconify/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { KontoBetriebsartSection } from "@/components/konto/konto-betriebsart-section";
import { KontoZahlungenSection } from "@/components/konto/konto-zahlungen-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LabelHint } from "@/components/ui/label-hint";
import { NativeSelect } from "@/components/ui/native-select";
import {
  accountTypeForLegalForm,
  legalFormsForCountry,
} from "@/lib/legal-forms";
import { PhoneInput } from "@/components/ui/phone-input";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  COUNTRIES,
  hasSmallBusinessScheme,
  smallBusinessLabel,
  vatIdLabel,
} from "@/lib/countries";
import {
  checkVatId,
  getFirmenProfil,
  saveFirmenProfil,
  uploadFirmenLogo,
} from "@/lib/firmenprofil";

export default function ProfilPage() {
  // --- Stammdaten / Person ---
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [language, setLanguage] = useState("de");
  const [website, setWebsite] = useState("");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [ownerDob, setOwnerDob] = useState(""); // ISO YYYY-MM-DD
  const [accountType, setAccountType] = useState<"individual" | "company">(
    "individual",
  );
  // Konkrete Rechtsform (GmbH, Einzelunternehmen, SARL, …) — landesabhängig.
  // Sie bestimmt serverseitig den Stripe-business_type; "" = noch nicht gewählt.
  const [legalForm, setLegalForm] = useState("");

  // --- Rechnungskontakt / Firma (vorher im Dialog, jetzt inline) ---
  const [companyName, setCompanyName] = useState("");
  const [street, setStreet] = useState("");
  const [houseNumber, setHouseNumber] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("DE");
  const [email, setEmail] = useState("");
  const [vatId, setVatId] = useState("");
  // Live-Prüfung der USt-IdNr. gegen VIES (EU-Prüfdienst) beim Verlassen des
  // Felds — informativ, blockiert das Speichern nicht.
  const [vatCheck, setVatCheck] = useState<
    | null
    | { state: "checking" }
    | { state: "ok"; name: string | null }
    | { state: "invalid" }
    | { state: "error"; message: string }
  >(null);
  const [taxNumber, setTaxNumber] = useState("");
  const [isSmallBusiness, setIsSmallBusiness] = useState(false);
  // USt-Satz Übernachtung (0092) als String (Input); "" = nicht konfiguriert.
  // Pflicht für die automatische Rechnung beim Check-out (kein Default).
  const [lodgingTaxRate, setLodgingTaxRate] = useState("");
  const [iban, setIban] = useState("");
  // Kontoinhaber (VoP-Pflicht seit Okt 2025: Name MUSS exakt zur IBAN passen,
  // sonst scheitert die Auszahlung). Wird automatisch vorbefüllt (Firma →
  // Firmenname, Einzelperson → Vor+Nachname), bleibt aber überschreibbar — der
  // bei der Bank hinterlegte Name kann abweichen. `touched` merkt sich einen
  // manuellen Eingriff, damit die Auto-Vorbefüllung ihn nicht überschreibt.
  const [accountHolder, setAccountHolder] = useState("");
  const [accountHolderTouched, setAccountHolderTouched] = useState(false);

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  // Ladefehler des Firmenprofils (z. B. 403) — sichtbar machen statt leeres
  // Formular (Wurzel 5).
  const [loadError, setLoadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Bestehendes Firmenprofil laden — alle Felder (kein Hardcode).
  useEffect(() => {
    let active = true;
    void getFirmenProfil().then((res) => {
      if (!active) return;
      if (!res.ok) {
        // Fehler NIE verschlucken (Wurzel 5): sonst rendert ein 403 als
        // scheinbar leeres, editierbares Formular („alle Daten weg").
        setLoadError(
          res.status === 403
            ? "Kein Zugriff: Das Firmenprofil kann nur der Kontoinhaber (Admin) einsehen."
            : res.error,
        );
        return;
      }
      const d = res.data;
      const s = (k: string): string =>
        typeof d[k] === "string" ? (d[k] as string) : "";
      const url = d.companyLogo;
      if (typeof url === "string" && url) setLogoUrl(url);
      // Person
      if (s("firstName")) setFirstName(s("firstName"));
      if (s("lastName")) setLastName(s("lastName"));
      if (s("phoneNumber")) setPhone(s("phoneNumber"));
      if (s("website")) setWebsite(s("website"));
      if (s("ownerDob")) setOwnerDob(s("ownerDob"));
      const at = s("accountType");
      if (at === "individual" || at === "company") setAccountType(at);
      if (s("legalForm")) setLegalForm(s("legalForm"));
      // Firma / Rechnungskontakt
      if (s("companyName")) setCompanyName(s("companyName"));
      if (s("companyStreet")) setStreet(s("companyStreet"));
      if (s("companyHouseNumber")) setHouseNumber(s("companyHouseNumber"));
      if (s("companyPostalCode")) setPostalCode(s("companyPostalCode"));
      if (s("companyCity")) setCity(s("companyCity"));
      if (s("companyCountry")) setCountry(s("companyCountry"));
      if (s("email")) setEmail(s("email"));
      if (s("vatId")) setVatId(s("vatId"));
      if (s("taxNumber")) setTaxNumber(s("taxNumber"));
      setIsSmallBusiness(Boolean(d.isSmallBusiness));
      if (d.lodgingTaxRate != null) setLodgingTaxRate(String(d.lodgingTaxRate));
      if (s("iban")) setIban(s("iban"));
      // Ein bereits gespeicherter Kontoinhaber war eine bewusste Eingabe → als
      // „touched" markieren, damit die Auto-Vorbefüllung ihn nicht überschreibt.
      if (s("accountHolder")) {
        setAccountHolder(s("accountHolder"));
        setAccountHolderTouched(true);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  // accountType folgt IMMER aus der gewählten Rechtsform (individual/company/
  // non_profit) — der Nutzer wählt die konkrete Form, nicht den groben Typ. So
  // wird ein Einzelunternehmen NIE fälschlich als company an Stripe gemeldet.
  useEffect(() => {
    if (!legalForm) return;
    const t = accountTypeForLegalForm(country, legalForm);
    // non_profit läuft KYC-seitig wie company (Firmenname/Person nötig).
    setAccountType(t === "individual" ? "individual" : "company");
  }, [legalForm, country]);

  // Kontoinhaber automatisch vorbefüllen, solange der Nutzer ihn nicht manuell
  // gesetzt hat: Firma → Firmenname, Einzelperson → Vor+Nachname. So stimmt der
  // Name im Normalfall sofort mit der IBAN überein (VoP), bleibt aber editierbar.
  useEffect(() => {
    if (accountHolderTouched) return;
    const derived =
      accountType === "company"
        ? companyName.trim()
        : [firstName, lastName].filter(Boolean).join(" ").trim();
    setAccountHolder(derived);
  }, [accountHolderTouched, accountType, companyName, firstName, lastName]);

  // Alles speichern → ein Profil-Update. Löst serverseitig den Stripe-Auto-
  // Connect aus (update_company_profile → _ensure_connect_account): Name/
  // Adresse/E-Mail/Telefon/IBAN/Geburtsdatum gehen automatisch an Stripe.
  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    // Aussteller-Name (legal_name): bei Firma der Firmenname, bei Einzelperson
    // Vor+Nachname — sonst hätte die Einzelperson keinen Namen auf Rechnungen.
    const issuerName =
      accountType === "company"
        ? companyName
        : [firstName, lastName].filter(Boolean).join(" ");
    const res = await saveFirmenProfil({
      // Person
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      phoneNumber: phone || undefined,
      website: website || undefined,
      accountType,
      legalForm: legalForm || undefined,
      ownerDob: ownerDob || undefined,
      // Firma / Rechnungskontakt
      companyName: issuerName || undefined,
      companyStreet: street || undefined,
      companyHouseNumber: houseNumber || undefined,
      companyPostalCode: postalCode || undefined,
      companyCity: city || undefined,
      companyCountry: country || undefined,
      email: email || undefined,
      vatId: vatId || undefined,
      taxNumber: taxNumber || undefined,
      isSmallBusiness,
      lodgingTaxRate:
        lodgingTaxRate.trim() !== "" && Number.isFinite(Number(lodgingTaxRate))
          ? Number(lodgingTaxRate)
          : undefined,
      iban: iban ? iban.replace(/\s+/g, "") : undefined,
      // Kontoinhaber exakt wie eingegeben/vorbefüllt — muss für VoP zur IBAN
      // passen. Leer lassen wir das Backend ableiten (_account_holder_from).
      accountHolder: accountHolder.trim() || undefined,
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Daten gespeichert.");
  }

  async function onPickLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // erlaubt erneutes Wählen derselben Datei
    if (!file) return;
    setUploading(true);
    const res = await uploadFirmenLogo(file);
    setUploading(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    const url = res.data.companyLogo;
    if (typeof url === "string") setLogoUrl(url);
    toast.success("Logo gespeichert.");
  }

  return (
    <>
      {/* Kopf-Bereich: Profil/Logo + Zahlungs-Status + Betriebsart als Karten
          nebeneinander. Zahlungen/Betriebsart liegen bewusst AUSSERHALB des
          Formulars (der Speichern-Submit greift dort nicht). */}
      <div className="mb-8 grid grid-cols-12 items-start gap-4">
        <div className="col-span-12 rounded-2xl border border-border bg-card p-5 xl:col-span-7">
          <KontoZahlungenSection />
        </div>
        <div className="col-span-12 rounded-2xl border border-border bg-card p-5 xl:col-span-5">
          <KontoBetriebsartSection />
        </div>
      </div>

      {loadError && (
        <div className="mb-6 rounded-(--radius) border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {loadError}
        </div>
      )}

      <form className="flex flex-col gap-8" onSubmit={onSave}>
        {/* Logo-Upload */}
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl font-extrabold">Profil</h2>
          <p className="text-sm text-muted-foreground">
            Diese Angaben erscheinen auf Dokumenten und im Gäste-Portal.
          </p>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="relative flex size-32 cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-(--radius) border border-dashed border-border text-muted-foreground transition-colors hover:bg-secondary/50 disabled:cursor-wait"
          >
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt="Firmenlogo"
                className="size-full object-contain p-2"
              />
            ) : (
              <>
                <Icon icon="ph:upload-simple" className="size-6" />
                <span className="text-xs">Logo hochladen</span>
              </>
            )}
            {uploading && (
              <span className="absolute inset-0 flex items-center justify-center bg-background/70">
                <Icon icon="ph:spinner" className="size-6 animate-spin" />
              </span>
            )}
          </button>
          {logoUrl && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-fit text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              Logo ersetzen
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={onPickLogo}
          />
        </section>

        <Separator />

        {/* Kontaktdaten — in belegter Reihenfolge (Stripe country→business_type→
            entity, Baymard Adress-Regeln): Unternehmen → Person → Adresse →
            Kontakt → Steuer → Bank. Jede Gruppe mit eigener Überschrift. */}
        <section className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <h3 className="font-display text-lg font-extrabold">Kontaktdaten</h3>
            <p className="text-sm text-muted-foreground">
              Deine Firmen-, Kontakt- und Bankdaten. Sie erscheinen auf
              Abrechnungen und werden für Steuer und Auszahlungen genutzt.
            </p>
          </div>

          {/* Gruppe A — Unternehmen: Rechtsform bestimmt den Stripe-Kontotyp
              (Einzelunternehmer=individual, GmbH/SARL/…=company, Verein=non_profit).
              Das Land gehört zur Adresse (Gruppe C). */}
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Unternehmen
          </p>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <LabelHint
                htmlFor="legalForm"
                hint="Bestimmt die Zahlungsfreischaltung (Stripe). Einzelunternehmer benötigen keine Firmendaten."
              >
                Rechtsform <span className="text-destructive">*</span>
              </LabelHint>
              <NativeSelect
                id="legalForm"
                value={legalForm}
                onChange={(e) => setLegalForm(e.target.value)}
              >
                <option value="">Bitte wählen …</option>
                {legalFormsForCountry(country).map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            {accountType === "company" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="companyName">
                  Firmenname <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="companyName"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>
            )}
          </div>

          <Separator />

          {/* Gruppe B — Person (Einzelunternehmer = die Person selbst; Firma =
              gesetzlicher Vertreter). Geburtsdatum nur wegen KYC hier. */}
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {accountType === "company"
              ? "Verantwortliche Person"
              : "Person"}
          </p>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="firstName">
                Vorname <span className="text-destructive">*</span>
              </Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lastName">
                Nachname <span className="text-destructive">*</span>
              </Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Geburtsdatum (links) — die zweite Spalte bleibt frei (date-Feld
              braucht keine volle Breite). */}
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <LabelHint
                htmlFor="ownerDob"
                hint="Für die Zahlungsfreischaltung (Stripe)."
              >
                {accountType === "company"
                  ? "Geburtsdatum der vertretungsberechtigten Person"
                  : "Geburtsdatum"}
              </LabelHint>
              <Input
                id="ownerDob"
                type="date"
                value={ownerDob}
                onChange={(e) => setOwnerDob(e.target.value)}
              />
            </div>
          </div>

          <Separator />

          {/* Gruppe C — Adresse (Straße vor PLZ/Stadt, Baymard). */}
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Adresse
          </p>
          <div className="grid gap-5 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="street">Straße</Label>
              <Input
                id="street"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="house">Nr.</Label>
              <Input
                id="house"
                value={houseNumber}
                onChange={(e) => setHouseNumber(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="zip">PLZ</Label>
              <Input
                id="zip"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="city">Stadt</Label>
              <Input
                id="city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5 sm:max-w-sm">
            <Label htmlFor="country">
              Land <span className="text-destructive">*</span>
            </Label>
            <NativeSelect
              id="country"
              value={country}
              onChange={(e) => {
                const next = e.target.value;
                setCountry(next);
                // Land ohne Befreiungsregelung → Haken zurücksetzen.
                if (!hasSmallBusinessScheme(next)) setIsSmallBusiness(false);
              }}
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
          </div>

          <Separator />

          {/* Gruppe D — Kontakt. */}
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Kontakt
          </p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">E-Mail</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phone1">
              Primäre Telefonnummer <span className="text-destructive">*</span>
            </Label>
            <PhoneInput
              id="phone1"
              value={phone}
              onChange={setPhone}
              defaultCountry={country}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              type="url"
              placeholder="https://…"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </div>

          <Separator />

          {/* Gruppe E — Steuer (Kleinunternehmer-Kennzeichen steuert USt-Satz). */}
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Steuer
          </p>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="vatId">{vatIdLabel(country)}</Label>
              <Input
                id="vatId"
                value={vatId}
                placeholder="DE123456789"
                onChange={(e) => {
                  setVatId(e.target.value);
                  setVatCheck(null);
                }}
                onBlur={async () => {
                  const v = vatId.trim();
                  if (!v) {
                    setVatCheck(null);
                    return;
                  }
                  setVatCheck({ state: "checking" });
                  const res = await checkVatId(v);
                  if (res.ok) {
                    setVatCheck(
                      res.data.valid
                        ? { state: "ok", name: res.data.name }
                        : { state: "invalid" },
                    );
                  } else {
                    setVatCheck({ state: "error", message: res.error });
                  }
                }}
              />
              {vatCheck?.state === "checking" && (
                <p className="text-xs text-muted-foreground">
                  Prüfe gegen den EU-Prüfdienst (VIES) …
                </p>
              )}
              {vatCheck?.state === "ok" && (
                <p className="flex items-center gap-1 text-xs text-success">
                  <Icon icon="ph:check-circle" className="size-3.5" />
                  Gültig laut VIES{vatCheck.name ? ` — ${vatCheck.name}` : ""}
                </p>
              )}
              {vatCheck?.state === "invalid" && (
                <p className="flex items-center gap-1 text-xs text-destructive">
                  <Icon icon="ph:x-circle" className="size-3.5" />
                  Laut EU-Prüfdienst (VIES) ist diese USt-IdNr. NICHT gültig —
                  bitte prüfen.
                </p>
              )}
              {vatCheck?.state === "error" && (
                <p className="text-xs text-muted-foreground">{vatCheck.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="taxNumber">Steuernummer</Label>
              <Input
                id="taxNumber"
                value={taxNumber}
                onChange={(e) => setTaxNumber(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <LabelHint
                htmlFor="lodgingTaxRate"
                hint="Steuersatz für Übernachtungs-Positionen bei Rechnungen aus Buchungen (z. B. 7 % in Deutschland). Ohne Angabe kann beim Check-out keine automatische Rechnung erstellt werden."
              >
                USt-Satz Übernachtung (%)
              </LabelHint>
              <Input
                id="lodgingTaxRate"
                type="number"
                min={0}
                max={100}
                step="0.1"
                value={lodgingTaxRate}
                onChange={(e) => setLodgingTaxRate(e.target.value)}
                placeholder="z. B. 7"
              />
            </div>
          </div>

          {hasSmallBusinessScheme(country) ? (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isSmallBusiness}
                onChange={(e) => setIsSmallBusiness(e.target.checked)}
              />
              {smallBusinessLabel(country)}
            </label>
          ) : (
            <p className="text-sm text-muted-foreground">
              {smallBusinessLabel(country)}
            </p>
          )}

          <Separator />

          {/* Gruppe F — Bankverbindung/Auszahlung (bei Stripe stets am Ende).
              Kontoinhaber automatisch vorbefüllt (Firma → Firmenname, Einzelperson
              → Vor+Nachname), aber editierbar: seit Okt 2025 gleicht die Bank bei
              jeder SEPA-Überweisung Name ↔ IBAN ab (Verification of Payee). */}
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Bankverbindung
          </p>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <LabelHint
                htmlFor="accountHolder"
                hint="Muss exakt dem bei der Bank hinterlegten Namen entsprechen (EU-Namensabgleich, Verification of Payee)."
              >
                Kontoinhaber
              </LabelHint>
              <Input
                id="accountHolder"
                value={accountHolder}
                onChange={(e) => {
                  setAccountHolder(e.target.value);
                  setAccountHolderTouched(true);
                }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="iban">IBAN</Label>
              <Input
                id="iban"
                placeholder="DE00 0000 0000 0000 0000 00"
                autoComplete="off"
                value={iban}
                onChange={(e) => setIban(e.target.value)}
              />
            </div>
          </div>

          <Separator />

          {/* 7) Sonstiges */}
          <div className="flex flex-col gap-1.5 sm:max-w-sm">
            <Label htmlFor="language">Bevorzugte Sprache</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger id="language">
                <SelectValue placeholder="Sprache wählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="de">Deutsch</SelectItem>
                <SelectItem value="da">Dänisch</SelectItem>
                <SelectItem value="en">Englisch</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Beschreibung</Label>
            <RichTextEditor
              value={description}
              onChange={setDescription}
              placeholder="Kurze Beschreibung deines Unternehmens…"
            />
          </div>
        </section>

        {/* Aktionen */}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline">
            Abbrechen
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Speichert …" : "Speichern"}
          </Button>
        </div>
      </form>
    </>
  );
}
