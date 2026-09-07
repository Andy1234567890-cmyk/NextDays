"use client";

// Konto → Profil (My account / Profile).
// ALLES gebündelt auf einer Seite: Logo, Rechnungskontakt (Firma/Adresse/Steuer/
// Bank), Stammdaten (Person/Telefon/Geburtsdatum/Kontotyp), Website — plus der
// Zahlungs-Abschnitt darunter. Kein separater Dialog, kein eigener Tab. Quelle
// und Ziel ist durchgehend das Firmenprofil (tenant_billing_profile); ein
// Speichern schreibt alles und löst den Stripe-Auto-Connect aus.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AddressPlacesSearch } from "@/components/address-places-search";
import { SprachAuswahl } from "@/components/sprache-auswahl";
import { KontoBetriebsartSection } from "@/components/konto/konto-betriebsart-section";
import { KontoZahlungenSection } from "@/components/konto/konto-zahlungen-section";
import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";
import { Label } from "@nextdays/ui/label";
import { LabelHint } from "@nextdays/ui/label-hint";
import { NativeSelect } from "@nextdays/ui/native-select";
import {
  accountTypeForLegalForm,
  legalFormsForCountry,
} from "@/lib/legal-forms";
import { PhoneInput } from "@nextdays/ui/phone-input";
import { RichTextEditor } from "@nextdays/ui/rich-text-editor";
import { Separator } from "@nextdays/ui/separator";
import {
  COUNTRIES,
  hasSmallBusinessScheme,
  smallBusinessLabel,
  vatIdLabel,
} from "@nextdays/ui/countries";
import {
  checkVatId,
  getFirmenProfil,
  saveFirmenProfil,
  uploadFirmenLogo,
} from "@/lib/firmenprofil";
import { getMe, setDefaultLanguage } from "@/lib/auth";

// Die Logo-URL trägt den Pfad `{tenant}/logo.{ext}?v=…` (buchhaltung.upload_logo).
function logoIstPdf(url: string): boolean {
  return /\.pdf(\?|$)/i.test(url);
}

export default function ProfilPage() {
  const t = useTranslations("account");
  const tCountry = useTranslations("countries");
  // --- Stammdaten / Person ---
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  // Standardsprache des BETRIEBS (`tenants.default_language`, 0335). Startwert
  // ist LEER, nicht "de": solange nichts geladen ist, wissen wir es nicht — ein
  // vorgegebenes "de" behauptete, der Betrieb sei deutschsprachig (Wurzel 4).
  const [language, setLanguage] = useState("");
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
  const [companyState, setCompanyState] = useState(""); // Bundesland/Region (0163)
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
  // Handelsregisternummer (HRB) + Amtsgericht — bei Gesellschaften (GmbH/UG/AG …)
  // Stripe-Pflicht (company.registration_number). Ohne sie bleibt der Connected
  // Account „Restricted" und kann keine Zahlungen empfangen.
  const [companyRegister, setCompanyRegister] = useState("");
  const [districtCourt, setDistrictCourt] = useState("");
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

  // Standardsprache des Betriebs laden. EIGENER Effekt und eigener Endpunkt,
  // weil der Wert nicht am Firmenprofil hängt, sondern am Mandanten
  // (`tenants.default_language`, 0335) — er kommt mit `me` und wird über
  // /auth/tenant/default-language geschrieben.
  useEffect(() => {
    let active = true;
    void getMe().then((me) => {
      if (!active) return;
      setLanguage(me?.default_language ?? "");
    });
    return () => {
      active = false;
    };
  }, []);

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
      // Firma / Rechnungskontakt. Vor dem eigenen Firmenname-Feld für
      // Einzelunternehmen wurde dort der PERSONENNAME als legal_name gespeichert
      // (abgeleitet aus Vor+Nachname) — der ist kein Firmenname und würde das
      // Feld fälschlich vorbelegen.
      const geladenerName = s("companyName");
      const personenName = [s("firstName"), s("lastName")]
        .filter(Boolean)
        .join(" ");
      if (geladenerName && geladenerName !== personenName) {
        setCompanyName(geladenerName);
      }
      if (s("companyStreet")) setStreet(s("companyStreet"));
      if (s("companyHouseNumber")) setHouseNumber(s("companyHouseNumber"));
      if (s("companyPostalCode")) setPostalCode(s("companyPostalCode"));
      if (s("companyCity")) setCity(s("companyCity"));
      if (s("companyState")) setCompanyState(s("companyState"));
      if (s("companyCountry")) setCountry(s("companyCountry"));
      if (s("email")) setEmail(s("email"));
      if (s("vatId")) setVatId(s("vatId"));
      if (s("taxNumber")) setTaxNumber(s("taxNumber"));
      if (s("companyRegister")) setCompanyRegister(s("companyRegister"));
      if (s("districtCourt")) setDistrictCourt(s("districtCourt"));
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
    const res = await saveFirmenProfil({
      // Person
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      phoneNumber: phone || undefined,
      website: website || undefined,
      accountType,
      legalForm: legalForm || undefined,
      ownerDob: ownerDob || undefined,
      // Firma / Rechnungskontakt. Der Firmenname geht genau so raus, wie er im
      // Feld steht — auch leer (Einzelunternehmen ohne eingetragenen Namen). Den
      // Rechtsnamen für Belege bestimmt allein der Server (_legal_name_from_payload).
      companyName: companyName.trim(),
      companyStreet: street || undefined,
      companyHouseNumber: houseNumber || undefined,
      companyPostalCode: postalCode || undefined,
      companyCity: city || undefined,
      companyState: companyState || undefined,
      companyCountry: country || undefined,
      email: email || undefined,
      vatId: vatId || undefined,
      taxNumber: taxNumber || undefined,
      companyRegister: companyRegister || undefined,
      districtCourt: districtCourt || undefined,
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
    if (!res.ok) {
      setSaving(false);
      toast.error(res.error);
      return;
    }
    // Die Betriebssprache gehört dem MANDANTEN, nicht dem Firmenprofil, und
    // geht deshalb über ihren eigenen Endpunkt raus — im selben Speichern-Klick,
    // damit der Betreiber nicht zwei Knöpfe suchen muss. Leer heißt bewusst
    // „nicht erfasst" (null → Englisch), nicht „Deutsch".
    const sprache = await setDefaultLanguage(language || null);
    setSaving(false);
    if (!sprache.ok) {
      toast.error(sprache.error);
      return;
    }
    toast.success(t("company.saved"));
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
    // PDF ist als Datei hinterlegt, wird in Dokumenten/Gästeportal aber nicht
    // als Bild gerendert — das muss der Betrieb beim Hochladen hören, nicht
    // erst an einer leeren Stelle im Beleg erraten (Wurzel 4/5).
    if (file.type === "application/pdf") {
      toast.warning(t("company.logoPdfHint"));
    } else {
      toast.success(t("company.logoSaved"));
    }
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
            {logoUrl && logoIstPdf(logoUrl) ? (
              // Ein PDF-Logo (0580) kann kein <img> zeigen — Datei-Symbol
              // statt eines leeren Kastens, der wie „kein Logo" aussähe.
              <>
                <Icon icon="ph:file-pdf" className="size-8" />
                <span className="text-xs">{t("company.logoPdf")}</span>
              </>
            ) : logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt="Firmenlogo"
                className="size-full object-contain p-2"
              />
            ) : (
              <>
                <Icon icon="ph:upload-simple" className="size-6" />
                <span className="text-xs">{t("company.uploadLogo")}</span>
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
            accept="image/png,image/jpeg,image/webp,image/svg+xml,application/pdf"
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
                <option value="">{t("company.pleaseChoose")}</option>
                {legalFormsForCountry(country).map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            {/* Firmenname gilt für JEDE Rechtsform: auch ein Einzelunternehmen
                (Enkeltmandsvirksomhed, sole trader) ist unter einem Namen
                eingetragen und rechnet unter ihm ab. Pflicht ist er nur bei
                Gesellschaften; bleibt er leer, firmiert die Person unter ihrem
                eigenen Namen (bestimmt der Server). */}
            <div className="flex flex-col gap-1.5">
              {accountType === "company" ? (
                <Label htmlFor="companyName">
                  Firmenname <span className="text-destructive">*</span>
                </Label>
              ) : (
                <LabelHint
                  htmlFor="companyName"
                  hint="Der eingetragene Name deines Einzelunternehmens. Ohne Eintrag erscheint dein Vor- und Nachname auf Rechnungen."
                >
                  Firmenname
                </LabelHint>
              )}
              <Input
                id="companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required={accountType === "company"}
              />
            </div>
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
              <Label htmlFor="street">{t("company.street")}</Label>
              {/* Places-Autocomplete direkt AM Straßenfeld: manuell tippbar,
                  und bei Auswahl eines Vorschlags werden Hausnummer, PLZ,
                  Stadt, Bundesland und Land strukturiert mitgefüllt (keine
                  Regex-Zerlegung von Freitext). Leere Teile überschreiben
                  nichts — Google liefert je Land unterschiedlich viel. */}
              <AddressPlacesSearch
                id="street"
                value={street}
                onChange={setStreet}
                onPick={(a) => {
                  if (a.street) setStreet(a.street);
                  if (a.houseNumber) setHouseNumber(a.houseNumber);
                  if (a.postalCode) setPostalCode(a.postalCode);
                  if (a.city) setCity(a.city);
                  if (a.state) setCompanyState(a.state);
                  if (a.country) setCountry(a.country);
                }}
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
            <Label htmlFor="companyState">{t("company.state")}</Label>
            <Input
              id="companyState"
              value={companyState}
              onChange={(e) => setCompanyState(e.target.value)}
              placeholder={t("company.statePlaceholder")}
            />
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
                  {tCountry(c.code)}
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
            {accountType === "company" && (
              <>
                <div className="flex flex-col gap-1.5">
                  <LabelHint
                    htmlFor="companyRegister"
                    hint="Handelsregisternummer (z. B. HRB 12345). Für Gesellschaften Pflicht, damit das Zahlungskonto freigeschaltet wird."
                  >
                    Handelsregisternummer
                  </LabelHint>
                  <Input
                    id="companyRegister"
                    value={companyRegister}
                    placeholder={t("company.hrbPlaceholder")}
                    onChange={(e) => setCompanyRegister(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="districtCourt">Amtsgericht</Label>
                  <Input
                    id="districtCourt"
                    value={districtCourt}
                    placeholder={t("company.courtPlaceholder")}
                    onChange={(e) => setDistrictCourt(e.target.value)}
                  />
                </div>
              </>
            )}
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
                placeholder={t("company.employeesPlaceholder")}
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
                placeholder={t("company.ibanPlaceholder")}
                autoComplete="off"
                value={iban}
                onChange={(e) => setIban(e.target.value)}
              />
            </div>
          </div>

          <Separator />

          {/* 7) Sonstiges — Standardsprache des BETRIEBS.
              Ein ANDERES Feld als die „Sprache für E-Mails" eines einzelnen
              Nutzers/Eigentümers (Konto → Benutzer bzw. Eigentümer-Stammdaten):
              das hier ist die zweite Stufe der Mail-Sprachkette (eigene Wahl →
              BETRIEB → Englisch) und greift für jeden Empfänger OHNE eigene
              Sprachwahl.

              Das Feld war reine Anzeige: es wurde nie geladen, stand fest auf
              "de" und war in keinem Save-Payload. Das Zielfeld, auf das der
              frühere Befund wartete, gibt es inzwischen —
              `tenants.default_language` (0335) mit dem Endpunkt
              PATCH /auth/tenant/default-language. Beides ist jetzt
              angeschlossen: geladen über `me`, gespeichert im Speichern-Klick.
              Leer bleibt erlaubt und heißt „nicht erfasst" (→ Englisch). */}
          <SprachAuswahl
            id="language"
            value={language}
            onChange={setLanguage}
            label={t("company.preferredLanguage")}
            hint={null}
            allowEmpty
            emptyLabel={t("company.chooseLanguage")}
            className="sm:max-w-sm"
          />

          <div className="flex flex-col gap-1.5">
            <Label>Beschreibung</Label>
            <RichTextEditor
              value={description}
              onChange={setDescription}
              placeholder={t("company.descriptionPlaceholder")}
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
