"use client";

// Profil-/Kontaktdaten-Editor (Lodgify „Edit contact information"): Slide-over
// mit Avatar, Vor-/Nachname, E-Mail, Telefon (+ Zweitnummer & Ländervorwahl),
// Sichtbarkeit auf der Website, gesprochene Sprachen, Website, Beschreibung.
// Speichert das EIGENE Profil des eingeloggten Nutzers über updateProfile()
// (E-Mail separat über updateEmail, da abgesichert).
import { Icon } from "@iconify/react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  type Account,
  updateEmail,
  updateProfile,
  uploadAvatar,
} from "@/lib/account";
import { LANGUAGE_OPTIONS, languageLabel } from "@/lib/contact-meta";

export function ContactProfileEditor({
  account,
  onClose,
}: {
  account: Account;
  onClose: () => void;
}) {
  // Name aus full_name in Vor-/Nachname zerlegen (best effort).
  const [first, last] = splitName(account.full_name);
  const [firstName, setFirstName] = useState(first);
  const [lastName, setLastName] = useState(last);
  const [email, setEmail] = useState(account.email ?? "");

  // Telefon als Gesamtwert; die Vorwahl-Vorbelegung kommt aus dem Land des
  // Unternehmens (tenants.country) — kein Länder-Hardcode (Wurzel 4).
  const [phone, setPhone] = useState(account.phone ?? "");
  const [additionalPhone, setAdditionalPhone] = useState(
    account.additional_phone ?? "",
  );

  const [hidePhones, setHidePhones] = useState(account.hide_phones);
  const [languages, setLanguages] = useState<string[]>(account.spoken_languages);
  const [website, setWebsite] = useState(account.website ?? "");
  const [description, setDescription] = useState(account.description ?? "");
  const [avatarUrl, setAvatarUrl] = useState(account.avatar_url ?? "");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
  const canSave = firstName.trim() && lastName.trim() && email.trim();

  function toggleLanguage(value: string) {
    setLanguages((prev) =>
      prev.includes(value) ? prev.filter((l) => l !== value) : [...prev, value],
    );
  }

  async function handleSave() {
    setBusy(true);
    setError(null);

    // E-Mail separat (eigener, abgesicherter Endpunkt) — nur bei Änderung.
    if (email.trim() && email.trim() !== (account.email ?? "")) {
      const r = await updateEmail(email.trim());
      if (!r.ok) {
        setBusy(false);
        setError(r.error);
        return;
      }
    }

    const res = await updateProfile({
      full_name: fullName,
      phone: phone.trim() || null,
      additional_phone: additionalPhone.trim() || null,
      hide_phones: hidePhones,
      spoken_languages: languages,
      website: website.trim() || null,
      description: description.trim() || null,
      avatar_url: avatarUrl.trim() || null,
    });
    setBusy(false);
    if (res.ok) {
      onClose();
    } else {
      setError(res.error);
    }
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex h-full w-full flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="border-b">
          <SheetTitle className="font-display text-xl font-extrabold">
            Kontaktdaten bearbeiten
          </SheetTitle>
          <SheetDescription className="sr-only">
            Bearbeite die Kontakt- und Profildaten dieses Nutzers.
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-5">
          {/* Avatar */}
          <section className="flex flex-col gap-2">
            <p className="font-semibold">Avatar</p>
            <AvatarPicker value={avatarUrl} onChange={setAvatarUrl} />
          </section>

          {/* Kontaktdaten */}
          <section className="flex flex-col gap-4">
            <p className="font-semibold">Kontaktdaten</p>

            <Field label="Vorname" required>
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Jane"
              />
            </Field>
            <Field label="Nachname" required>
              <Input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
              />
            </Field>
            <Field label="E-Mail" required>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane.doe@gmail.com"
              />
            </Field>

            <Field label="Telefonnummer" required>
              <PhoneInput
                value={phone}
                onChange={setPhone}
                defaultCountry={account.tenant_country ?? undefined}
              />
            </Field>
            <Field label="Zusätzliche Telefonnummer">
              <PhoneInput
                value={additionalPhone}
                onChange={setAdditionalPhone}
                defaultCountry={account.tenant_country ?? undefined}
              />
            </Field>

            <label className="flex items-center gap-2.5 text-sm">
              <Checkbox
                checked={hidePhones}
                onCheckedChange={(v) => setHidePhones(v === true)}
              />
              Alle Telefonnummern auf meiner Website ausblenden
            </label>
          </section>

          {/* Weitere Angaben */}
          <section className="flex flex-col gap-4">
            <p className="font-semibold">Weitere Angaben</p>

            <Field label="Gesprochene Sprache(n)">
              <div className="flex flex-wrap gap-2">
                {LANGUAGE_OPTIONS.map((o) => {
                  const active = languages.includes(o.value);
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => toggleLanguage(o.value)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                        active
                          ? "border-foreground bg-foreground text-background"
                          : "border-border hover:bg-muted/40"
                      }`}
                    >
                      {active && <Icon icon="ph:check" className="size-3.5" />}
                      {languageLabel(o.value)}
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="Website">
              <Input
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://janedoe.com"
              />
            </Field>

            <Field label="Beschreibung">
              <RichTextEditor
                value={description}
                onChange={setDescription}
                placeholder="Schreibe etwas über dich …"
              />
            </Field>
          </section>
        </div>

        {/* Fußzeile */}
        <div className="flex items-center justify-end gap-3 border-t p-4">
          {error && <p className="mr-auto text-sm text-destructive">{error}</p>}
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={busy || !canSave}>
            {busy ? "Speichern…" : "Speichern"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// Avatar-Upload-Fläche (wie Lodgify „Add photo / Or drag it here"): Klick ODER
// Drag-&-Drop lädt das Bild via Supabase-Browser-Client nach
// avatars/{userId}/… (RLS: nur eigener Ordner) und gibt die Public-URL zurück.
function AvatarPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  async function upload(file: File) {
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("Bitte eine Bilddatei wählen.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Bild ist zu groß (max. 5 MB).");
      return;
    }
    setBusy(true);
    // Upload übers Backend (Service-Client) — funktioniert für beide Login-Wege.
    const res = await uploadAvatar(file);
    setBusy(false);
    if (res.ok) {
      onChange(res.data.avatar_url ?? "");
    } else {
      setError(res.error);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void upload(file);
  }

  if (value) {
    return (
      <div className="flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={value}
          alt="Avatar"
          className="size-24 rounded-(--radius) object-cover"
        />
        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            {busy ? "Lädt…" : "Ändern"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange("")}
            disabled={busy}
          >
            Entfernen
          </Button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
            e.target.value = "";
          }}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        disabled={busy}
        className={`flex w-fit flex-col items-center justify-center gap-2 rounded-(--radius) border-2 border-dashed px-10 py-8 text-center text-sm transition-colors ${
          dragOver
            ? "border-foreground bg-muted/40"
            : "border-border text-muted-foreground hover:bg-muted/40"
        }`}
      >
        <Icon
          icon={busy ? "ph:spinner" : "ph:upload-simple"}
          className={`size-6 ${busy ? "animate-spin" : ""}`}
        />
        <span>
          {busy ? (
            "Lädt …"
          ) : (
            <>
              Foto hinzufügen
              <br />
              oder hierher ziehen
            </>
          )}
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
          e.target.value = "";
        }}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}

// Zerlegt „Jane Doe" → ["Jane", "Doe"]; einzelner Name → Vorname.
function splitName(full: string | null): [string, string] {
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return ["", ""];
  if (parts.length === 1) return [parts[0], ""];
  return [parts.slice(0, -1).join(" "), parts[parts.length - 1]];
}
