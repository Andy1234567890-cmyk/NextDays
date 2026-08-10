"use client";

// Benutzer-Wizard („Benutzer erstellen"): Sheet von rechts, 4 Schritte
// mit Fortschrittsanzeige. Schritt 1 Kontakt, 2 Zusatzinfos, 3 Rolle+Rechte,
// 4 Objektzuweisung. Beim Erstellen wird der Nutzer mit Rolle + Berechtigungen
// über /auth/invite angelegt; der Server verschickt eine Einladungs-Mail, der
// Eingeladene setzt sein Passwort SELBST unter /einladung?token=…
//
// Früher erzeugte diese Datei clientseitig ein Passwort (`Nd-` + 14 Zeichen),
// schickte es mit und zeigte es im Erfolgs-Schritt im Klartext an. Das ist
// ersatzlos entfallen: ein Passwort, das der Betreiber kennt und per Chat
// weitergibt, ist kein Geheimnis des Nutzers mehr. Kein Klartext-Passwort
// erreicht das Frontend — weder erzeugt noch angezeigt.
//
// Ebenfalls behoben (0356): Telefonnummer, Zusatznummer, „Nummern ausblenden",
// gesprochene Sprachen und Anmerkung waren ATTRAPPEN — die Felder standen in
// Schritt 1/2, hingen an keinem Zustand und gingen nicht in den Request. Wer
// eine Nummer eintrug, fand danach ein leeres Feld. Jetzt tragen sie Zustand,
// gehen mit `POST /auth/invite` mit und landen in derselben `users`-Zeile wie
// Name und Rolle.
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { toast } from "sonner";

import {
  inviteUser,
  setOwnerProperties,
  setStaffProperties,
} from "@/lib/account";
import type { UserRole } from "@/lib/account";
import { einladungErneutSenden } from "@/lib/einladung";
import { listProperties, type Property } from "@/lib/properties";
import { Button } from "@nextdays/ui/button";
import { Checkbox } from "@nextdays/ui/checkbox";
import { Input } from "@nextdays/ui/input";
import { Label } from "@nextdays/ui/label";
import { PhoneInput } from "@nextdays/ui/phone-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@nextdays/ui/select";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@nextdays/ui/sheet";
import { Textarea } from "@nextdays/ui/textarea";
import { cn } from "@/lib/utils";

import { SprachAuswahl } from "@/components/sprache-auswahl";
import { GesprocheneSprachen } from "./gesprochene-sprachen";
import { PermissionGroups } from "./permission-groups";
import {
  ROLE_DEFAULT_PERMISSIONS,
  ROLES,
  WIZARD_STEPS,
} from "./user-wizard-data";

export function UserWizard({
  trigger,
  tenantCountry = null,
}: {
  trigger: React.ReactNode;
  /** Land des Betriebs (ISO-2) — Vorbelegung der Telefon-Vorwahl. `null` heißt
   *  „nicht erfasst"; dann bleibt es bei der Vorgabe des Telefonfelds. */
  tenantCountry?: string | null;
}) {
  const t = useTranslations("account");
  // Vorbelegung der E-Mail-Sprache: die Sprache, in der der Betreiber GERADE
  // arbeitet — nicht hart „de". Recherche (Smashing Magazine, Clay/Liferay):
  // stille, überschreibbare Vorbelegung statt Pflichtauswahl aus dem Nichts.
  // Der Betreiber legt den Nutzer meist in seinem eigenen Sprachraum an, und
  // die Vorbelegung steht sichtbar im Feld — sie wird also bewusst bestätigt
  // oder geändert. Ein leeres Pflichtfeld würde hier nur einen Klick erzwingen,
  // ohne dass der Betreiber mehr weiß.
  const uiLocale = useLocale();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  // Schritt 1
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [additionalPhone, setAdditionalPhone] = useState("");
  const [hidePhones, setHidePhones] = useState(false);
  // Schritt 2 — `language` = Sprache der E-Mails an DIESEN Nutzer.
  const [language, setLanguage] = useState(uiLocale);
  const [spoken, setSpoken] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  // Schritt 3
  const [role, setRole] = useState("");
  const [perms, setPerms] = useState<Set<string>>(new Set());
  // Schritt 4 — Objektzuweisung (nur für Rollen mit Objektbezug)
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedProps, setSelectedProps] = useState<Set<string>>(new Set());
  // Anlegen
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Nach dem Anlegen: an WEN die Einladung ging und WELCHE user_id sie trägt
  // (letztere braucht der „Erneut senden"-Knopf). Kein Passwort.
  const [created, setCreated] = useState<{
    email: string;
    userId: string;
  } | null>(null);

  const reset = () => {
    setStep(0);
    setFirstName(""); setLastName(""); setEmail("");
    setPhone(""); setAdditionalPhone(""); setHidePhones(false);
    setLanguage(uiLocale); setSpoken([]); setNotes("");
    setRole(""); setPerms(new Set());
    setSelectedProps(new Set());
    setSubmitting(false); setError(null); setCreated(null);
  };

  // Objekte laden, sobald der Wizard geöffnet wird (für Schritt 4).
  useEffect(() => {
    if (!open) return;
    let active = true;
    void listProperties().then((res) => {
      if (active && res.ok) setProperties(res.data.items);
    });
    return () => {
      active = false;
    };
  }, [open]);

  // Nur diese Rollen haben einen Objektbezug (Zuweisung/Freigabe pro Objekt).
  const roleNeedsProperties =
    role === "owner" || role === "staff" || role === "cleaner";

  const last = WIZARD_STEPS.length - 1;
  const next = () => setStep((s) => Math.min(s + 1, last));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const submit = async () => {
    setError(null);
    const fullName = `${firstName} ${lastName}`.trim();
    if (!fullName || !email || !role) {
      setError(t("userWizard.requiredFields"));
      return;
    }
    setSubmitting(true);
    // Kein `password` im Request — der Server legt den Zugang an und lädt per
    // Mail ein (siehe Kopf). `preferred_language` steuert die Sprache der
    // Einladungs- und aller weiteren Mails an diesen Nutzer.
    const res = await inviteUser({
      email,
      full_name: fullName,
      role: role as UserRole,
      permissions: [...perms],
      preferred_language: language,
      // Nur Ausgefülltes mitschicken: ein leerer String wäre in der Spalte ein
      // Wert, der wie eine Angabe aussieht. Leer bleibt NULL/Default.
      phone: phone.trim() || undefined,
      additional_phone: additionalPhone.trim() || undefined,
      hide_phones: hidePhones,
      spoken_languages: spoken,
      notes: notes.trim() || undefined,
    });
    if (!res.ok) {
      setSubmitting(false);
      setError(res.error);
      return;
    }
    // Objekte zuweisen (rollenabhängig): owner → Portal-Sicht (§4.2),
    // staff/cleaner → operative Freigabe (§4.3). Fehler hier meldet, aber der
    // Nutzer wurde bereits angelegt — daher trotzdem den Erfolg zeigen.
    if (roleNeedsProperties && selectedProps.size > 0) {
      const ids = [...selectedProps];
      const assign =
        role === "owner"
          ? setOwnerProperties(res.data.user_id, ids)
          : setStaffProperties(res.data.user_id, ids);
      const assignRes = await assign;
      if (!assignRes.ok) {
        setSubmitting(false);
        setError(
          t("userWizard.assignFailed", { reason: assignRes.error }),
        );
        setCreated({ email, userId: res.data.user_id });
        return;
      }
    }
    setSubmitting(false);
    setCreated({ email, userId: res.data.user_id });
  };

  const togglePerm = (id: string) =>
    setPerms((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  // Rollenwechsel: passende Default-Berechtigungen vorauswählen (überschreibbar).
  const onRoleChange = (value: string) => {
    setRole(value);
    setPerms(new Set(ROLE_DEFAULT_PERMISSIONS[value] ?? []));
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-lg"
      >
        <SheetHeader className="border-b">
          <SheetTitle className="font-display text-lg font-extrabold">
            {t("userWizard.title")}
          </SheetTitle>
          <p className="text-sm text-muted-foreground">
            {created
              ? t("userWizard.createdSubtitle")
              : t(`userWizard.stepHints.${STEP_HINT_KEYS[step]}`)}
          </p>
          {!created && <Stepper current={step} />}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4">
          {created ? (
            <StepSuccess email={created.email} userId={created.userId} />
          ) : (
            <>
              {step === 0 && (
                <StepContact
                  firstName={firstName} setFirstName={setFirstName}
                  lastName={lastName} setLastName={setLastName}
                  email={email} setEmail={setEmail}
                  phone={phone} setPhone={setPhone}
                  additionalPhone={additionalPhone}
                  setAdditionalPhone={setAdditionalPhone}
                  hidePhones={hidePhones} setHidePhones={setHidePhones}
                  land={tenantCountry}
                />
              )}
              {step === 1 && (
                <StepExtra
                  language={language} setLanguage={setLanguage}
                  spoken={spoken} setSpoken={setSpoken}
                  notes={notes} setNotes={setNotes}
                />
              )}
              {step === 2 && (
                <StepRole
                  role={role} setRole={onRoleChange}
                  perms={perms} togglePerm={togglePerm}
                />
              )}
              {step === 3 && (
                <StepProperties
                  roleNeedsProperties={roleNeedsProperties}
                  properties={properties}
                  selected={selectedProps}
                  onToggle={(id, on) =>
                    setSelectedProps((prev) => {
                      const n = new Set(prev);
                      if (on) n.add(id);
                      else n.delete(id);
                      return n;
                    })
                  }
                />
              )}
              {error && (
                <p className="mt-4 rounded-(--radius) bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}
            </>
          )}
        </div>

        <SheetFooter className="flex-row gap-2 border-t">
          {created ? (
            <Button type="button" className="flex-1" onClick={() => setOpen(false)}>
              {t("userWizard.done")}
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={submitting}
                onClick={() => (step === 0 ? setOpen(false) : back())}
              >
                {step === 0 ? t("userWizard.cancel") : t("userWizard.back")}
              </Button>
              <Button
                type="button"
                className="flex-1"
                disabled={submitting}
                onClick={() => (step === last ? submit() : next())}
              >
                {step === last
                  ? submitting
                    ? t("userWizard.creating")
                    : t("userWizard.create")
                  : t("userWizard.next")}
              </Button>
            </>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// Schlüssel der Schritt-Hinweise (Reihenfolge = Schrittfolge). Die Texte
// stehen in den Sprachdateien unter account.userWizard.stepHints.*.
const STEP_HINT_KEYS = ["contact", "extra", "role", "properties"] as const;

function Stepper({ current }: { current: number }) {
  return (
    <div className="flex items-center pt-2">
      {WIZARD_STEPS.map((schluessel, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={schluessel} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
                  done && "border-accent bg-accent text-accent-foreground",
                  active && "border-accent text-accent",
                  !done && !active && "border-border text-muted-foreground",
                )}
              >
                {done ? <Icon icon="ph:check" className="size-4" /> : i + 1}
              </span>
            </div>
            {i < WIZARD_STEPS.length - 1 && (
              <span
                className={cn(
                  "mx-1 h-0.5 flex-1 transition-colors",
                  i < current ? "bg-accent" : "bg-border",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Schritt 1: Kontakt ----------
 * Die Telefonfelder laufen über <PhoneInput> (geteilte Komponente, alle 27
 * EU-Staaten + CH/UK). Vorher stand hier ein eigenes Select mit FÜNF fest
 * verdrahteten Vorwahlen (DE/AT/CH/DK/US) neben einem Input ohne Zustand: eine
 * Auswahl, die nichts speichert, und eine Länderliste, die einen belgischen
 * Eigentümer nicht abbilden kann. */
function StepContact(p: {
  firstName: string; setFirstName: (v: string) => void;
  lastName: string; setLastName: (v: string) => void;
  email: string; setEmail: (v: string) => void;
  phone: string; setPhone: (v: string) => void;
  additionalPhone: string; setAdditionalPhone: (v: string) => void;
  hidePhones: boolean; setHidePhones: (v: boolean) => void;
  land: string | null;
}) {
  const t = useTranslations("account");
  return (
    <div className="flex flex-col gap-5">
      <FieldText label={t("userWizard.firstName")} required value={p.firstName} onChange={p.setFirstName} />
      <FieldText label={t("userWizard.lastName")} required value={p.lastName} onChange={p.setLastName} />
      <FieldText label={t("userWizard.email")} required type="email" value={p.email} onChange={p.setEmail} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="w-phone">{t("userWizard.phone")}</Label>
        <PhoneInput
          id="w-phone"
          value={p.phone}
          onChange={p.setPhone}
          defaultCountry={p.land ?? undefined}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="w-phone2">{t("userWizard.extraPhone")}</Label>
        <PhoneInput
          id="w-phone2"
          value={p.additionalPhone}
          onChange={p.setAdditionalPhone}
          defaultCountry={p.land ?? undefined}
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={p.hidePhones}
          onCheckedChange={(v) => p.setHidePhones(Boolean(v))}
        />
        {t("userWizard.hidePhones")}
      </label>
    </div>
  );
}

/* ---------- Schritt 2: Zusatzinfos ---------- */
function StepExtra(p: {
  language: string; setLanguage: (v: string) => void;
  spoken: string[]; setSpoken: (v: string[]) => void;
  notes: string; setNotes: (v: string) => void;
}) {
  const t = useTranslations("account");
  return (
    <div className="flex flex-col gap-5">
      {/* Sprache der E-Mails an diesen Nutzer. Bis hier stand ein Select mit
          drei fest verdrahteten Sprachen (de/da/en) — bei 24 Amtssprachen und
          Eigentümern aus aller Welt war das eine Sackgasse. Jetzt die geteilte
          <SprachAuswahl> über alle 24 Locales. */}
      <SprachAuswahl
        id="w-lang"
        value={p.language}
        onChange={p.setLanguage}
        label={t("userWizard.preferredLanguage")}
        hint={t("userWizard.preferredLanguageHint")}
        required
      />

      {/* Chips + Suche + Liste liegen jetzt in <GesprocheneSprachen> — dieselbe
          Komponente nutzt die Detailseite. */}
      <GesprocheneSprachen value={p.spoken} onChange={p.setSpoken} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="w-notes">{t("userWizard.notes")}</Label>
        <Textarea
          id="w-notes"
          rows={3}
          value={p.notes}
          onChange={(e) => p.setNotes(e.target.value)}
        />
      </div>
    </div>
  );
}

/* ---------- Schritt 3: Rolle + Berechtigungen ---------- */
function StepRole(p: {
  role: string; setRole: (v: string) => void;
  perms: Set<string>; togglePerm: (id: string) => void;
}) {
  const t = useTranslations("account");
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="w-role">
          {t("userWizard.role")} <span className="text-destructive">*</span>
        </Label>
        <Select value={p.role} onValueChange={p.setRole}>
          <SelectTrigger id="w-role">
            <SelectValue placeholder={t("userWizard.chooseRole")} />
          </SelectTrigger>
          <SelectContent>
            {ROLES.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {t(`roles.${r.value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {p.role && <PermissionGroups perms={p.perms} toggle={p.togglePerm} />}
    </div>
  );
}

/* ---------- Schritt 4: Objektzuweisung ---------- */
function StepProperties({
  roleNeedsProperties,
  properties,
  selected,
  onToggle,
}: {
  roleNeedsProperties: boolean;
  properties: Property[];
  selected: Set<string>;
  onToggle: (id: string, on: boolean) => void;
}) {
  const t = useTranslations("account");

  // Rollen ohne Objektbezug (admin/co_admin) brauchen keine Zuweisung.
  if (!roleNeedsProperties) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <Icon icon="ph:shield-check" className="size-10 text-muted-foreground" />
        <p className="font-display text-lg font-extrabold">
          {t("userWizard.noAssignNeeded")}
        </p>
        <p className="max-w-xs text-sm text-muted-foreground">
          {t("userWizard.noAssignNeededHint")}
        </p>
      </div>
    );
  }

  if (properties.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/illustrations/rentals-building.svg"
          alt=""
          aria-hidden
          className="h-32 w-auto"
        />
        <p className="font-display text-lg font-extrabold">
          {t("userWizard.noProperties")}
        </p>
        <p className="text-sm text-muted-foreground">
          {t("userWizard.noPropertiesHint")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        {t("userWizard.choosePropertiesHint")}
      </p>
      <ul className="flex flex-col gap-1">
        {properties.map((p) => (
          <li key={p.id}>
            <label className="flex cursor-pointer items-center gap-3 rounded-(--radius) p-2 hover:bg-muted/50">
              <Checkbox
                checked={selected.has(p.id)}
                onCheckedChange={(c) => onToggle(p.id, c === true)}
              />
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="truncate text-sm font-medium">{p.title}</span>
                <span className="truncate text-xs text-muted-foreground">
                  ID {p.id.slice(0, 8)}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <span className="text-xs text-muted-foreground">
        {t("userWizard.selectedCount", { count: selected.size })}
      </span>
    </div>
  );
}

/* ---------- Erfolg: Einladung verschickt ----------
 * Zeigt bewusst NUR die Adresse, an die eingeladen wurde. Kein Passwort — es
 * gibt keins mehr, das der Betreiber kennen könnte.
 *
 * Der „Erneut senden"-Knopf sitzt zusätzlich hier, weil ein Mailproblem
 * meistens SOFORT auffällt („ist nichts angekommen?") und der Betreiber dann
 * noch im Wizard steht. Der reguläre Platz für den Fall „Tage später" ist die
 * Nutzerliste (`user-list.tsx`) — beide rufen dieselbe Aktion. */
function StepSuccess({ email, userId }: { email: string; userId: string }) {
  const t = useTranslations("account");
  const [sending, setSending] = useState(false);

  async function resend() {
    setSending(true);
    const res = await einladungErneutSenden(userId);
    setSending(false);
    if (res.ok) toast.success(t("userWizard.inviteResent"));
    else toast.error(res.error || t("userWizard.inviteResendFailed"));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-2 py-4 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-accent/10">
          <Icon icon="ph:paper-plane-tilt" className="size-7 text-accent" />
        </span>
        <p className="font-display text-lg font-extrabold">
          {t("userWizard.inviteSent")}
        </p>
        <p className="text-sm text-muted-foreground">
          {t("userWizard.inviteSentHint")}
        </p>
      </div>

      <div className="flex flex-col gap-2 rounded-(--radius) border border-input p-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            {t("userWizard.email")}
          </span>
          <code className="select-all rounded bg-secondary px-2 py-1 text-sm">
            {email}
          </code>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        disabled={sending}
        onClick={resend}
        className="gap-2"
      >
        <Icon icon="ph:envelope-simple" className="size-4" aria-hidden />
        {sending ? t("userWizard.inviteResending") : t("userWizard.inviteResend")}
      </Button>
    </div>
  );
}

/* ---------- Hilfs-Feld ---------- */
function FieldText({
  label,
  required,
  type = "text",
  value,
  onChange,
}: {
  label: string;
  required?: boolean;
  type?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
