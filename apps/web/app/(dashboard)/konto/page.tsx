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

import { KontoZahlungenSection } from "@/components/konto/konto-zahlungen-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
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

  // --- Rechnungskontakt / Firma (vorher im Dialog, jetzt inline) ---
  const [companyName, setCompanyName] = useState("");
  const [street, setStreet] = useState("");
  const [houseNumber, setHouseNumber] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("DE");
  const [email, setEmail] = useState("");
  const [vatId, setVatId] = useState("");
  const [taxNumber, setTaxNumber] = useState("");
  const [isSmallBusiness, setIsSmallBusiness] = useState(false);
  const [iban, setIban] = useState("");
  const [accountHolder, setAccountHolder] = useState("");

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Bestehendes Firmenprofil laden — alle Felder (kein Hardcode).
  useEffect(() => {
    let active = true;
    void getFirmenProfil().then((res) => {
      if (!active || !res.ok) return;
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
      if (s("iban")) setIban(s("iban"));
      if (s("accountHolder")) setAccountHolder(s("accountHolder"));
    });
    return () => {
      active = false;
    };
  }, []);

  // Alles speichern → ein Profil-Update. Löst serverseitig den Stripe-Auto-
  // Connect aus (update_company_profile → _ensure_connect_account): Name/
  // Adresse/E-Mail/Telefon/IBAN/Geburtsdatum gehen automatisch an Stripe.
  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await saveFirmenProfil({
      // Person
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      phoneNumber: phone || undefined,
      website: website || undefined,
      accountType,
      ownerDob: ownerDob || undefined,
      // Firma / Rechnungskontakt
      companyName: companyName || undefined,
      companyStreet: street || undefined,
      companyHouseNumber: houseNumber || undefined,
      companyPostalCode: postalCode || undefined,
      companyCity: city || undefined,
      companyCountry: country || undefined,
      email: email || undefined,
      vatId: vatId || undefined,
      taxNumber: taxNumber || undefined,
      isSmallBusiness,
      iban: iban ? iban.replace(/\s+/g, "") : undefined,
      accountHolder: accountHolder || undefined,
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

        {/* Rechnungskontakt — inline (vorher Dialog) */}
        <section className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <h3 className="font-display text-lg font-extrabold">
              Rechnungskontakt
            </h3>
            <p className="text-sm text-muted-foreground">
              Erscheint als Aussteller auf Abrechnungen; Basis für Steuer- und
              Auszahlungslogik.
            </p>
          </div>

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

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">E-Mail</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="vatId">{vatIdLabel(country)}</Label>
              <Input
                id="vatId"
                value={vatId}
                onChange={(e) => setVatId(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="taxNumber">Steuernummer</Label>
              <Input
                id="taxNumber"
                value={taxNumber}
                onChange={(e) => setTaxNumber(e.target.value)}
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

          {/* Bankverbindung (Auszahlungen) */}
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="accountHolder">Kontoinhaber</Label>
              <Input
                id="accountHolder"
                value={accountHolder}
                onChange={(e) => setAccountHolder(e.target.value)}
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
        </section>

        <Separator />

        {/* Stammdaten */}
        <section className="flex flex-col gap-5">
          <h3 className="font-display text-lg font-extrabold">Stammdaten</h3>

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

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="accountType">Kontotyp</Label>
              <NativeSelect
                id="accountType"
                value={accountType}
                onChange={(e) =>
                  setAccountType(e.target.value as "individual" | "company")
                }
              >
                <option value="individual">Einzelperson</option>
                <option value="company">Firma</option>
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ownerDob">
                {accountType === "company"
                  ? "Geburtsdatum der vertretungsberechtigten Person"
                  : "Geburtsdatum"}
              </Label>
              <Input
                id="ownerDob"
                type="date"
                value={ownerDob}
                onChange={(e) => setOwnerDob(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Für die Zahlungsfreischaltung (Stripe).
              </p>
            </div>
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

      {/* Zahlungen — direkt im Konto, kein eigener Tab. Außerhalb des Profil-
          Formulars, damit der Speichern-Submit nicht mitgreift. */}
      <KontoZahlungenSection />
    </>
  );
}
