// Profil bearbeiten (Client-Insel): Name, Telefon, Sprache, Währung,
// Marketing-Einwilligung → PATCH /guest-auth/me. Abmelden-Button.
"use client";

import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Select } from "@/components/select";
import {
  LOCALES,
  LOCALE_FLAG_EMOJI,
  LOCALE_LABELS,
} from "@/i18n/locales";
import { type GuestMe, guestUpdateMe } from "@/lib/guest-auth";
import { clearGuestSession } from "@/lib/guest-session";

// Sprachen aus der ZENTRALEN Liste (i18n/locales.ts), nicht aus einer eigenen
// Aufzählung. Hier standen bis zum 27.08.2026 acht handverlesene „gängigste"
// Sprachen — ein Gast, der Griechisch oder Bulgarisch spricht, konnte seine
// Sprache also nicht angeben, obwohl das Backend alle 24 kennt und die
// Rechtstexte daneben in allen 24 stehen.

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
      className="rounded-2xl border border-border bg-card p-4 sm:p-6"
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
            className="min-h-12 w-full rounded-xl border border-border bg-background px-3 text-base outline-none focus:border-ring sm:min-h-0 sm:py-2.5 sm:text-sm"
          />
        </Feld>
        <Feld label="Telefon">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            type="tel"
            className="min-h-12 w-full rounded-xl border border-border bg-background px-3 text-base outline-none focus:border-ring sm:min-h-0 sm:py-2.5 sm:text-sm"
          />
        </Feld>
        <Feld label="E-Mail">
          <input
            value={me.email}
            disabled
            className="min-h-12 w-full rounded-xl border border-border bg-secondary px-3 text-base text-muted-foreground sm:min-h-0 sm:py-2.5 sm:text-sm"
          />
        </Feld>
        <div />
        <Feld label="Sprache">
          <Select
            value={locale}
            onChange={(e) => setLocale(e.target.value)}
            wrapperClassName="w-full"
            className="min-h-12 w-full rounded-xl sm:min-h-0 sm:py-2.5"
          >
            <option value="">Keine Angabe</option>
            {/* Flagge als EMOJI, nicht als Symbol: ein natives <option>
                rendert ausschliesslich Text. Sie steht VOR dem Endonym, nie an
                seiner Stelle. */}
            {LOCALES.map((code) => (
              <option key={code} value={code}>
                {LOCALE_FLAG_EMOJI[code]} {LOCALE_LABELS[code]}
              </option>
            ))}
          </Select>
        </Feld>
        <Feld label="Währung">
          <Select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            wrapperClassName="w-full"
            className="min-h-12 w-full rounded-xl sm:min-h-0 sm:py-2.5"
          >
            <option value="">Keine Angabe</option>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Feld>
      </div>

      <label className="mt-5 flex items-start gap-3">
        <input
          type="checkbox"
          checked={marketing}
          onChange={(e) => setMarketing(e.target.checked)}
          className="mt-0.5 size-5 shrink-0 rounded border-border accent-accent sm:size-4"
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

      <div className="mt-6 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <button
          type="submit"
          disabled={busy}
          className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
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
          className="flex min-h-12 items-center justify-center gap-2 rounded-full border border-border px-5 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
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
