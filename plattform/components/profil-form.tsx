// Profil bearbeiten (Client-Insel): Name, Telefon, Sprache, Währung,
// Marketing-Einwilligung → PATCH /guest-auth/me. Abmelden-Button.
"use client";

import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { type GuestMe, guestUpdateMe } from "@/lib/guest-auth";
import { clearGuestSession } from "@/lib/guest-session";

// EU-Amtssprachen (Auswahl der gängigsten) — Codes, die das Backend erwartet.
const LOCALES = [
  { code: "de", label: "Deutsch" },
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "es", label: "Español" },
  { code: "it", label: "Italiano" },
  { code: "nl", label: "Nederlands" },
  { code: "pl", label: "Polski" },
  { code: "da", label: "Dansk" },
];

// Gängige EU-Währungen (kein €-Default erzwingen; leer = keine Angabe).
const CURRENCIES = ["EUR", "DKK", "SEK", "PLN", "CHF", "CZK", "HUF", "RON", "GBP"];

export function ProfilForm({ me }: { me: GuestMe }) {
  const router = useRouter();
  const [name, setName] = useState(me.name ?? "");
  const [phone, setPhone] = useState(me.phone ?? "");
  const [locale, setLocale] = useState(me.preferred_locale ?? "");
  const [currency, setCurrency] = useState(me.preferred_currency ?? "");
  const [marketing, setMarketing] = useState(me.marketing_opt_in);
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [gespeichert, setGespeichert] = useState(false);

  async function speichern(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFehler(null);
    setGespeichert(false);
    const res = await guestUpdateMe({
      name: name.trim(),
      phone: phone.trim(),
      preferred_locale: locale || undefined,
      preferred_currency: currency || undefined,
      marketing_opt_in: marketing,
    });
    setBusy(false);
    if (res.ok) {
      setGespeichert(true);
      router.refresh();
    } else {
      setFehler(res.error);
    }
  }

  return (
    <form
      onSubmit={speichern}
      className="rounded-2xl border border-border bg-card p-6"
    >
      <h2 className="font-display text-lg font-semibold">Profil</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Diese Angaben nutzen Gastgeber für deine Buchungen.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Feld label="Name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-ring"
          />
        </Feld>
        <Feld label="Telefon">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            type="tel"
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-ring"
          />
        </Feld>
        <Feld label="E-Mail">
          <input
            value={me.email}
            disabled
            className="w-full rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm text-muted-foreground"
          />
        </Feld>
        <div />
        <Feld label="Sprache">
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-ring"
          >
            <option value="">Keine Angabe</option>
            {LOCALES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </Feld>
        <Feld label="Währung">
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-ring"
          >
            <option value="">Keine Angabe</option>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Feld>
      </div>

      <label className="mt-5 flex items-start gap-3">
        <input
          type="checkbox"
          checked={marketing}
          onChange={(e) => setMarketing(e.target.checked)}
          className="mt-0.5 size-4 rounded border-border accent-accent"
        />
        <span className="text-sm text-muted-foreground">
          Ich möchte Angebote und Reise-Inspirationen per E-Mail erhalten.
        </span>
      </label>

      {fehler && (
        <p className="mt-4 rounded-xl bg-accent/10 px-3 py-2 text-sm text-accent">
          {fehler}
        </p>
      )}
      {gespeichert && (
        <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <Icon icon="ph:check-circle" className="mr-1 inline size-4" />
          Änderungen gespeichert.
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <button
          type="submit"
          disabled={busy}
          className="flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {busy && <Icon icon="ph:spinner" className="size-4 animate-spin" />}
          Speichern
        </button>
        <button
          type="button"
          onClick={async () => {
            await clearGuestSession();
            router.replace("/");
            router.refresh();
          }}
          className="flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <Icon icon="ph:sign-out" className="size-4" />
          Abmelden
        </button>
      </div>
    </form>
  );
}

function Feld({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
