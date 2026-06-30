"use client";

// Zahlungen (Stripe Connect) — eigenes white-label Onboarding im myNextDays-
// Dashboard. KEIN Stripe-hosted Onboarding: dieses Formular sammelt Geschäfts-/
// Inhaberdaten + IBAN und gibt sie über lib/payments.ts ans Backend, das sie an
// Stripe weiterreicht. Business-Logik bleibt im Backend (PROJECT.md §2).
//
// Realtime-Pflicht: der KYC-Status wird über den account.updated-Webhook in
// tenant_billing_profile gespiegelt; wir abonnieren die Tabelle (useRealtime,
// WebSocket) und laden bei jeder Änderung den Status live nach — kein Polling.
import { Icon } from "@iconify/react";
import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { COUNTRIES } from "@/lib/countries";
import { saveFirmenProfil } from "@/lib/firmenprofil";
import {
  acceptConnectTos,
  createConnectAccount,
  getConnectStatus,
  setBankAccount,
  updateConnectAccount,
  type ConnectStatus,
} from "@/lib/payments";
import { useRealtime } from "@/lib/use-realtime";

type Props = {
  // Aktueller Tenant + Login-E-Mail (serverseitig aus der Session ermittelt).
  tenantId: string;
  email: string;
  // Bereits angelegter Connect-Account (aus tenant_billing_profile) oder null.
  initialAccountId: string | null;
  // Initialer KYC-Status (serverseitig vorgeladen) oder null, wenn noch keiner.
  initialStatus: ConnectStatus | null;
};

// Status-Badge: grün, wenn erfüllt; sonst neutral-grau. Semantische Tokens —
// keine arbitrary Hex-Farben (Projektregel).
function StatusBadge({ label, on }: { label: string; on: boolean }) {
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium " +
        (on
          ? "bg-secondary text-secondary-foreground"
          : "bg-muted text-muted-foreground")
      }
    >
      <Icon
        icon={on ? "ph:check-circle-fill" : "ph:circle-dashed"}
        className={"size-3.5 " + (on ? "text-emerald-600" : "")}
      />
      {label}
    </span>
  );
}

export function StripeOnboarding({
  tenantId,
  email,
  initialAccountId,
  initialStatus,
}: Props) {
  const [accountId, setAccountId] = useState<string | null>(initialAccountId);
  const [status, setStatus] = useState<ConnectStatus | null>(initialStatus);
  const [creating, startCreate] = useTransition();
  const [savingProfile, startProfile] = useTransition();
  const [savingBank, startBank] = useTransition();
  const [accepting, startAccept] = useTransition();

  // Inhaber-Standort: vorbefüllt aus dem Account-Land, sonst leer (kein Default-
  // Erfinden — Projektregel „keine Fallbacks"). Wird auch fürs Anlegen genutzt.
  const [country, setCountry] = useState("");

  // Geschäfts-/Inhaber-Formular.
  // Kontotyp: Einzelperson/Firma (entspricht tenant_billing_profile.account_type,
  // Default 'individual'). Steuert das Label des Geburtsdatums und wird mit dem
  // Firmenprofil gespeichert (für die Stripe-Freischaltung).
  const [accountType, setAccountType] = useState<"individual" | "company">(
    "individual",
  );
  const [url, setUrl] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState(email);
  const [dob, setDob] = useState(""); // yyyy-mm-dd (HTML date)
  const [line1, setLine1] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");

  // Bankkonto.
  const [iban, setIban] = useState("");
  const [accountHolder, setAccountHolder] = useState("");

  // Status frisch aus dem Backend nachladen (nach Realtime-Event oder Mutation).
  const reloadStatus = useCallback(async () => {
    if (!accountId) return;
    const res = await getConnectStatus(accountId);
    if (res.ok) setStatus(res.data);
  }, [accountId]);

  // Beim ersten Mount ohne vorgeladenen Status nachladen.
  useEffect(() => {
    if (accountId && !status) void reloadStatus();
  }, [accountId, status, reloadStatus]);

  // Realtime-Pflicht: account.updated-Webhook schreibt tenant_billing_profile;
  // bei jeder Änderung Status live nachladen. RLS liefert nur den eigenen Tenant.
  useRealtime({
    table: "tenant_billing_profile",
    onChange: () => void reloadStatus(),
    enabled: Boolean(accountId),
  });

  function handleCreate() {
    if (!tenantId) {
      toast.error("Kein Unternehmen in der Session gefunden.");
      return;
    }
    if (!email) {
      toast.error("Keine E-Mail-Adresse in der Session gefunden.");
      return;
    }
    if (!country) {
      toast.error("Bitte zuerst das Land des Unternehmens wählen.");
      return;
    }
    startCreate(async () => {
      const res = await createConnectAccount({ email, country, tenant_id: tenantId });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setAccountId(res.data.stripe_account_id);
      toast.success("Zahlungskonto angelegt. Bitte ergänze deine Angaben.");
      const st = await getConnectStatus(res.data.stripe_account_id);
      if (st.ok) setStatus(st.data);
    });
  }

  function handleSaveProfile() {
    if (!accountId) return;
    // Geburtsdatum aus dem date-Input in {day,month,year} zerlegen. Nur senden,
    // wenn vollständig — kein Teil-/Fantasiewert.
    let dobObj: { day: number; month: number; year: number } | undefined;
    if (dob) {
      const [y, m, d] = dob.split("-").map((p) => Number.parseInt(p, 10));
      if (y && m && d) dobObj = { day: d, month: m, year: y };
    }
    // Nur tatsächlich ausgefüllte Felder ins fields-Objekt aufnehmen.
    const individual: Record<string, unknown> = {};
    if (firstName) individual.first_name = firstName;
    if (lastName) individual.last_name = lastName;
    if (ownerEmail) individual.email = ownerEmail;
    if (dobObj) individual.dob = dobObj;
    const address: Record<string, unknown> = {};
    if (line1) address.line1 = line1;
    if (city) address.city = city;
    if (postalCode) address.postal_code = postalCode;
    if (country) address.country = country;
    if (Object.keys(address).length > 0) individual.address = address;

    const fields: Record<string, unknown> = {};
    if (url) fields.business_profile = { url };
    if (Object.keys(individual).length > 0) fields.individual = individual;

    if (Object.keys(fields).length === 0) {
      toast.error("Bitte fülle mindestens ein Feld aus.");
      return;
    }

    startProfile(async () => {
      // Kontotyp + Geburtsdatum zusätzlich ins Firmenprofil schreiben
      // (tenant_billing_profile.account_type / owner_dob). Geburtsdatum nur,
      // wenn ausgefüllt — kein leerer/erfundener Wert (Projektregel).
      const profil: { accountType: "individual" | "company"; ownerDob?: string } =
        { accountType };
      if (dob) profil.ownerDob = dob;
      const profilRes = await saveFirmenProfil(profil);
      if (!profilRes.ok) {
        toast.error(profilRes.error);
        return;
      }
      const res = await updateConnectAccount(accountId, fields);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setStatus(res.data);
      toast.success("Angaben übermittelt.");
    });
  }

  function handleSaveBank() {
    if (!accountId) return;
    if (!iban || !accountHolder) {
      toast.error("Bitte IBAN und Kontoinhaber angeben.");
      return;
    }
    if (!country) {
      toast.error("Bitte das Land des Unternehmens wählen.");
      return;
    }
    startBank(async () => {
      const res = await setBankAccount(accountId, {
        iban: iban.replace(/\s+/g, ""),
        accountHolder,
        country,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setStatus(res.data);
      toast.success("Bankverbindung gespeichert.");
    });
  }

  // Stripe-Nutzungsbedingungen mit echter Request-IP akzeptieren — nötig zur
  // Freischaltung (charges_enabled). Gibt den aktualisierten Status zurück.
  function handleAcceptTos() {
    if (!accountId) return;
    startAccept(async () => {
      const res = await acceptConnectTos(accountId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setStatus(res.data);
      toast.success("Nutzungsbedingungen akzeptiert.");
    });
  }

  // --- Noch kein Account: Land wählen + anlegen ----------------------------
  if (!accountId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon icon="ph:credit-card" className="size-5 text-accent" />
            Zahlungen einrichten
          </CardTitle>
          <CardDescription>
            Richte dein myNextDays-Zahlungskonto ein, um Gästezahlungen zu
            empfangen und Auszahlungen zu erhalten.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5 sm:max-w-sm">
            <Label htmlFor="create-country">
              Land des Unternehmens <span className="text-destructive">*</span>
            </Label>
            <NativeSelect
              id="create-country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            >
              <option value="">Land wählen …</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <p className="text-sm text-muted-foreground">
            Zahlungskonto wird für{" "}
            <span className="font-medium text-foreground">{email || "—"}</span>{" "}
            angelegt.
          </p>
          <div>
            <Button
              type="button"
              variant="accent"
              onClick={handleCreate}
              disabled={creating || !country || !email || !tenantId}
            >
              <Icon
                icon={creating ? "ph:spinner" : "ph:plus-circle"}
                className={"size-4 " + (creating ? "animate-spin" : "")}
              />
              {creating ? "Wird angelegt …" : "Zahlungen einrichten"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // --- Account vorhanden: Status + Formulare -------------------------------
  return (
    <div className="flex flex-col gap-6">
      {/* Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Icon icon="ph:credit-card" className="size-5 text-accent" />
                Zahlungsstatus
              </CardTitle>
              <CardDescription>
                Stand deiner Verifizierung. Aktualisiert sich automatisch.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {status ? (
            <>
              <div className="flex flex-wrap gap-2">
                <StatusBadge
                  label="Zahlungen aktiv"
                  on={status.charges_enabled}
                />
                <StatusBadge
                  label="Auszahlungen aktiv"
                  on={status.payouts_enabled}
                />
                <StatusBadge
                  label="Angaben vollständig"
                  on={status.details_submitted}
                />
              </div>

              {status.disabled_reason && (
                <p className="rounded-(--radius) border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                  <Icon
                    icon="ph:warning"
                    className="mr-1.5 inline size-4 align-text-bottom"
                  />
                  {status.disabled_reason}
                </p>
              )}

              {status.requirements.length > 0 ? (
                <section className="flex flex-col gap-2">
                  <h4 className="text-sm font-medium">Noch zu erledigen</h4>
                  <ul className="flex flex-col divide-y divide-border rounded-(--radius) border border-border">
                    {status.requirements.map((req) => (
                      <li
                        key={req}
                        className="flex items-center gap-2 p-3 text-sm"
                      >
                        <Icon
                          icon="ph:circle-dashed"
                          className="size-4 shrink-0 text-muted-foreground"
                        />
                        <span className="font-mono text-xs text-muted-foreground">
                          {req}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Keine offenen Anforderungen. Deine Angaben werden geprüft.
                </p>
              )}

              {status.charges_enabled ? (
                // Freigeschaltet: grüner Aktiv-Zustand.
                <div className="flex items-center gap-2 rounded-(--radius) border border-emerald-600/40 bg-emerald-50 p-3 text-sm font-medium text-emerald-700">
                  <Icon
                    icon="ph:check-circle-fill"
                    className="size-5 shrink-0 text-emerald-600"
                  />
                  Zahlungen aktiv — du kannst Gästezahlungen empfangen.
                </div>
              ) : (
                // Noch nicht freigeschaltet: Stripe-ToS akzeptieren.
                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    variant="accent"
                    onClick={handleAcceptTos}
                    disabled={accepting}
                    className="self-start"
                  >
                    <Icon
                      icon={accepting ? "ph:spinner" : "ph:rocket-launch"}
                      className={"size-4 " + (accepting ? "animate-spin" : "")}
                    />
                    {accepting ? "Wird aktiviert …" : "Zahlungen aktivieren"}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Mit dem Klick akzeptierst du die
                    Stripe-Nutzungsbedingungen.
                  </p>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Status wird geladen …
            </p>
          )}
        </CardContent>
      </Card>

      {/* Geschäfts-/Inhaberdaten */}
      <Card>
        <CardHeader>
          <CardTitle>Geschäfts- und Inhaberdaten</CardTitle>
          <CardDescription>
            Diese Angaben werden zur Verifizierung an unseren Zahlungsdienst
            übermittelt.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="biz-url">Website</Label>
            <Input
              id="biz-url"
              type="url"
              placeholder="https://…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>

          <Separator />

          <div className="flex flex-col gap-1.5 sm:max-w-xs">
            <Label htmlFor="acct-type">Kontotyp</Label>
            <NativeSelect
              id="acct-type"
              value={accountType}
              onChange={(e) =>
                setAccountType(e.target.value as "individual" | "company")
              }
            >
              <option value="individual">Einzelperson</option>
              <option value="company">Firma</option>
            </NativeSelect>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ind-first">Vorname</Label>
              <Input
                id="ind-first"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ind-last">Nachname</Label>
              <Input
                id="ind-last"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ind-email">E-Mail</Label>
              <Input
                id="ind-email"
                type="email"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ind-dob">
                {accountType === "company"
                  ? "Geburtsdatum der vertretungsberechtigten Person"
                  : "Geburtsdatum (für die Zahlungsfreischaltung)"}
              </Label>
              <Input
                id="ind-dob"
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
              />
            </div>
          </div>

          <Separator />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="addr-line1">Straße und Hausnummer</Label>
            <Input
              id="addr-line1"
              value={line1}
              onChange={(e) => setLine1(e.target.value)}
            />
          </div>
          <div className="grid gap-5 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="addr-postal">PLZ</Label>
              <Input
                id="addr-postal"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="addr-city">Stadt</Label>
              <Input
                id="addr-city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5 sm:max-w-xs">
            <Label htmlFor="addr-country">Land</Label>
            <NativeSelect
              id="addr-country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            >
              <option value="">Land wählen …</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              onClick={handleSaveProfile}
              disabled={savingProfile}
            >
              <Icon
                icon={savingProfile ? "ph:spinner" : "ph:check"}
                className={"size-4 " + (savingProfile ? "animate-spin" : "")}
              />
              {savingProfile ? "Wird übermittelt …" : "Angaben speichern"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Bankkonto */}
      <Card>
        <CardHeader>
          <CardTitle>Auszahlungs-Bankkonto</CardTitle>
          <CardDescription>
            IBAN, auf die deine Auszahlungen überwiesen werden.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bank-holder">
              Kontoinhaber <span className="text-destructive">*</span>
            </Label>
            <Input
              id="bank-holder"
              value={accountHolder}
              onChange={(e) => setAccountHolder(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bank-iban">
              IBAN <span className="text-destructive">*</span>
            </Label>
            <Input
              id="bank-iban"
              placeholder="DE00 0000 0000 0000 0000 00"
              autoComplete="off"
              value={iban}
              onChange={(e) => setIban(e.target.value)}
            />
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={handleSaveBank}
              disabled={savingBank || !iban || !accountHolder}
            >
              <Icon
                icon={savingBank ? "ph:spinner" : "ph:bank"}
                className={"size-4 " + (savingBank ? "animate-spin" : "")}
              />
              {savingBank ? "Wird gespeichert …" : "Bankverbindung speichern"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
