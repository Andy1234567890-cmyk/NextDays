"use client";

// Benutzer-Wizard (wie Lodgify „Benutzer erstellen"): Sheet von rechts, 4 Schritte
// mit Fortschrittsanzeige. Schritt 1 Kontakt, 2 Zusatzinfos, 3 Rolle+Rechte,
// 4 Objektzuweisung. Beim Erstellen wird der Nutzer mit Rolle + Berechtigungen
// über /auth/invite angelegt; ein Sofort-Passwort wird generiert und angezeigt.
import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";

import {
  inviteUser,
  setOwnerProperties,
  setStaffProperties,
} from "@/lib/account";
import type { UserRole } from "@/lib/account";
import { listProperties, type Property } from "@/lib/properties";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

import {
  GENERAL_PERMISSIONS,
  INBOX_PERMISSIONS,
  LANGUAGES,
  PM_PERMISSIONS,
  ROLE_DEFAULT_PERMISSIONS,
  ROLES,
  WIZARD_STEPS,
  type Permission,
} from "./user-wizard-data";

export function UserWizard({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  // Schritt 1
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [hidePhones, setHidePhones] = useState(false);
  // Schritt 2
  const [language, setLanguage] = useState("de");
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
  const [created, setCreated] = useState<{ email: string; password: string } | null>(
    null,
  );

  const reset = () => {
    setStep(0);
    setFirstName(""); setLastName(""); setEmail(""); setHidePhones(false);
    setLanguage("de"); setSpoken([]); setNotes("");
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

  // Sofort-Passwort generieren (wie im Admin-Bereich): Nd- + 14 Zeichen.
  const genPassword = () => {
    const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const a = new Uint8Array(14);
    crypto.getRandomValues(a);
    return "Nd-" + Array.from(a, (n) => chars[n % chars.length]).join("");
  };

  const submit = async () => {
    setError(null);
    const fullName = `${firstName} ${lastName}`.trim();
    if (!fullName || !email || !role) {
      setError("Vorname, Nachname, E-Mail und Rolle sind erforderlich.");
      return;
    }
    const password = genPassword();
    setSubmitting(true);
    const res = await inviteUser({
      email,
      password,
      full_name: fullName,
      role: role as UserRole,
      permissions: [...perms],
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
          `Nutzer angelegt, aber Objektzuweisung fehlgeschlagen: ${assignRes.error}`,
        );
        setCreated({ email, password });
        return;
      }
    }
    setSubmitting(false);
    setCreated({ email, password });
  };

  const togglePerm = (id: string) =>
    setPerms((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
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
            Benutzer erstellen
          </SheetTitle>
          <p className="text-sm text-muted-foreground">
            {created ? "Benutzer wurde angelegt." : STEP_HINTS[step]}
          </p>
          {!created && <Stepper current={step} />}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4">
          {created ? (
            <StepSuccess email={created.email} password={created.password} />
          ) : (
            <>
              {step === 0 && (
                <StepContact
                  firstName={firstName} setFirstName={setFirstName}
                  lastName={lastName} setLastName={setLastName}
                  email={email} setEmail={setEmail}
                  hidePhones={hidePhones} setHidePhones={setHidePhones}
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
              Fertig
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
                {step === 0 ? "Abbrechen" : "Zurück"}
              </Button>
              <Button
                type="button"
                className="flex-1"
                disabled={submitting}
                onClick={() => (step === last ? submit() : next())}
              >
                {step === last ? (submitting ? "Wird erstellt…" : "Erstellen") : "Weiter"}
              </Button>
            </>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

const STEP_HINTS = [
  "Fügen Sie die Kontaktinformationen dieses Benutzers hinzu.",
  "Fügen Sie zusätzliche Informationen über diesen Benutzer hinzu.",
  "Wählen Sie die Rolle und die Berechtigungen für diesen Benutzer aus.",
  "Weisen Sie diesem Benutzer Objekte zu.",
];

function Stepper({ current }: { current: number }) {
  return (
    <div className="flex items-center pt-2">
      {WIZARD_STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={label} className="flex flex-1 items-center last:flex-none">
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

/* ---------- Schritt 1: Kontakt ---------- */
function StepContact(p: {
  firstName: string; setFirstName: (v: string) => void;
  lastName: string; setLastName: (v: string) => void;
  email: string; setEmail: (v: string) => void;
  hidePhones: boolean; setHidePhones: (v: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <FieldText label="Vorname" required value={p.firstName} onChange={p.setFirstName} />
      <FieldText label="Nachname" required value={p.lastName} onChange={p.setLastName} />
      <FieldText label="E-Mail" required type="email" value={p.email} onChange={p.setEmail} />

      <div className="flex flex-col gap-1.5">
        <Label>Telefonnummer</Label>
        <div className="flex gap-2">
          <PhoneCountry />
          <Input type="tel" placeholder="+49 1525 1239026" className="flex-1" />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Zusätzliche Telefonnummer</Label>
        <div className="flex gap-2">
          <PhoneCountry />
          <Input type="tel" placeholder="+1 2015550123" className="flex-1" />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={p.hidePhones}
          onCheckedChange={(v) => p.setHidePhones(Boolean(v))}
        />
        Telefonnummern auf der Website ausblenden.
      </label>
    </div>
  );
}

function PhoneCountry() {
  return (
    <Select defaultValue="de">
      <SelectTrigger className="w-32 shrink-0">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="de">DE +49</SelectItem>
        <SelectItem value="at">AT +43</SelectItem>
        <SelectItem value="ch">CH +41</SelectItem>
        <SelectItem value="dk">DK +45</SelectItem>
        <SelectItem value="us">US +1</SelectItem>
      </SelectContent>
    </Select>
  );
}

/* ---------- Schritt 2: Zusatzinfos ---------- */
function StepExtra(p: {
  language: string; setLanguage: (v: string) => void;
  spoken: string[]; setSpoken: (v: string[]) => void;
  notes: string; setNotes: (v: string) => void;
}) {
  const [search, setSearch] = useState("");

  const toggle = (lang: string) =>
    p.setSpoken(
      p.spoken.includes(lang)
        ? p.spoken.filter((l) => l !== lang)
        : [...p.spoken, lang],
    );

  const filtered = LANGUAGES.filter((l) =>
    l.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="w-lang">
          Bevorzugte Sprache <span className="text-destructive">*</span>
        </Label>
        <Select value={p.language} onValueChange={p.setLanguage}>
          <SelectTrigger id="w-lang">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="de">Deutsch</SelectItem>
            <SelectItem value="da">Dänisch</SelectItem>
            <SelectItem value="en">Englisch</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Gesprochene Sprachen</Label>
        {p.spoken.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {p.spoken.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => toggle(l)}
                className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs"
              >
                <Icon icon="ph:x" className="size-3" />
                {l}
              </button>
            ))}
          </div>
        )}
        <div className="rounded-(--radius) border border-input">
          {/* Suchfeld */}
          <div className="flex items-center gap-2 border-b border-input px-3">
            <Icon
              icon="ph:magnifying-glass"
              className="size-4 shrink-0 text-muted-foreground"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Sprache suchen…"
              className="w-full bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          {/* Gefilterte Liste */}
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted-foreground">
                Keine Sprache gefunden.
              </p>
            ) : (
              filtered.map((l) => (
                <label
                  key={l}
                  className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-secondary/50"
                >
                  <Checkbox
                    checked={p.spoken.includes(l)}
                    onCheckedChange={() => toggle(l)}
                  />
                  {l}
                </label>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="w-notes">Anmerkungen</Label>
        <Input
          id="w-notes"
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
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="w-role">
          Rolle <span className="text-destructive">*</span>
        </Label>
        <Select value={p.role} onValueChange={p.setRole}>
          <SelectTrigger id="w-role">
            <SelectValue placeholder="Rolle wählen…" />
          </SelectTrigger>
          <SelectContent>
            {ROLES.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {p.role && (
        <>
          <PermissionGroup
            title="Allgemeine Berechtigungen"
            items={GENERAL_PERMISSIONS}
            perms={p.perms}
            toggle={p.togglePerm}
          />
          <PermissionGroup
            title="PM-Module-Berechtigungen"
            items={PM_PERMISSIONS}
            perms={p.perms}
            toggle={p.togglePerm}
          />
          <PermissionGroup
            title="Posteingang"
            items={INBOX_PERMISSIONS}
            perms={p.perms}
            toggle={p.togglePerm}
          />
        </>
      )}
    </div>
  );
}

function PermissionGroup({
  title,
  items,
  perms,
  toggle,
}: {
  title: string;
  items: Permission[];
  perms: Set<string>;
  toggle: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h4 className="font-display text-sm font-extrabold">{title}</h4>
      <div className="flex flex-col divide-y divide-border rounded-(--radius) border border-input">
        {items.map((perm) => (
          <label
            key={perm.id}
            className="flex cursor-pointer items-start justify-between gap-3 p-3 hover:bg-secondary/40"
          >
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">{perm.label}</span>
              <span className="text-xs text-muted-foreground">{perm.hint}</span>
            </span>
            <Checkbox
              className="mt-0.5 shrink-0"
              checked={perms.has(perm.id)}
              onCheckedChange={() => toggle(perm.id)}
            />
          </label>
        ))}
      </div>
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
  // Rollen ohne Objektbezug (admin/co_admin) brauchen keine Zuweisung.
  if (!roleNeedsProperties) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <Icon icon="ph:shield-check" className="size-10 text-muted-foreground" />
        <p className="font-display text-lg font-extrabold">
          Keine Objektzuweisung nötig
        </p>
        <p className="max-w-xs text-sm text-muted-foreground">
          Diese Rolle hat Zugriff auf alle Objekte des Kontos. Eine Zuweisung
          einzelner Objekte gilt nur für Eigentümer und Mitarbeiter.
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
          Noch keine Unterkünfte
        </p>
        <p className="text-sm text-muted-foreground">
          Erstellen Sie Ihre Unterkünfte, damit Sie sie später Ihren Benutzern
          zuweisen können.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Wählen Sie die Objekte, auf die dieser Benutzer Zugriff erhält.
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
        {selected.size} ausgewählt
      </span>
    </div>
  );
}

/* ---------- Erfolg: Zugangsdaten ---------- */
function StepSuccess({ email, password }: { email: string; password: string }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-2 py-4 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-accent/10">
          <Icon icon="ph:check-circle" className="size-7 text-accent" />
        </span>
        <p className="font-display text-lg font-extrabold">Benutzer erstellt</p>
        <p className="text-sm text-muted-foreground">
          Geben Sie diese Zugangsdaten an den neuen Benutzer weiter. Das Passwort
          wird nur jetzt angezeigt.
        </p>
      </div>
      <div className="flex flex-col gap-2 rounded-(--radius) border border-input p-3">
        <Field label="E-Mail" value={email} />
        <Field label="Passwort" value={password} mono />
      </div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <code
        className={cn(
          "select-all rounded bg-secondary px-2 py-1 text-sm",
          mono && "font-mono",
        )}
      >
        {value}
      </code>
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
