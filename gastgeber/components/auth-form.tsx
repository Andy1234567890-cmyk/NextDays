// Login-/Registrier-Formular (Client-Insel). Ruft die Server Actions aus
// lib/auth.ts — kein direkter Backend-Zugriff, kein Token im Client.
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { login, loginTotp, registerHost } from "@/lib/auth";
import { currencyForCountry, LAENDER } from "@nextdays/laender";

type Modus = "login" | "register";

export function AuthForm({ weiter }: { weiter: string }) {
  const router = useRouter();
  const [modus, setModus] = useState<Modus>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [country, setCountry] = useState("DE");
  const [totpToken, setTotpToken] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Währung IMMER aus dem gewählten Land (Wurzel 4).
  const currency = currencyForCountry(country);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFehler(null);
    setBusy(true);
    try {
      if (modus === "login") {
        const res = await login(email, password);
        if (!res.ok) return setFehler(res.error);
        if (res.mfaRequired) return setTotpToken(res.mfaToken);
        router.push(weiter);
        router.refresh();
      } else {
        if (!currency) return setFehler("Bitte ein Land auswählen.");
        const res = await registerHost({
          email,
          password,
          fullName,
          tenantName,
          country,
          currency,
        });
        if (!res.ok) return setFehler(res.error);
        router.push(weiter);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleTotp(e: React.FormEvent) {
    e.preventDefault();
    if (!totpToken) return;
    setFehler(null);
    setBusy(true);
    try {
      const res = await loginTotp(totpToken, totpCode);
      if (!res.ok) return setFehler(res.error);
      router.push(weiter);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (totpToken) {
    return (
      <form onSubmit={handleTotp} className="w-full max-w-sm space-y-4">
        <h2 className="font-display text-xl font-semibold">Bestätigungscode</h2>
        <p className="text-sm text-muted-foreground">
          Gib den 6-stelligen Code aus deiner Authenticator-App ein.
        </p>
        <input
          value={totpCode}
          onChange={(e) => setTotpCode(e.target.value)}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
          className="w-full rounded-full border border-border bg-background px-4 py-3 text-center tracking-widest"
          required
        />
        {fehler ? <p className="text-sm text-red-600">{fehler}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-primary px-4 py-3 font-medium text-primary-foreground disabled:opacity-60"
        >
          {busy ? "Prüfe …" : "Anmelden"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
      <div className="flex rounded-full bg-muted p-1 text-sm">
        <button
          type="button"
          onClick={() => setModus("login")}
          className={`flex-1 rounded-full px-4 py-2 transition ${
            modus === "login"
              ? "bg-background font-medium shadow-sm"
              : "text-muted-foreground"
          }`}
        >
          Anmelden
        </button>
        <button
          type="button"
          onClick={() => setModus("register")}
          className={`flex-1 rounded-full px-4 py-2 transition ${
            modus === "register"
              ? "bg-background font-medium shadow-sm"
              : "text-muted-foreground"
          }`}
        >
          Registrieren
        </button>
      </div>

      {modus === "register" ? (
        <>
          <Feld
            label="Dein Name"
            value={fullName}
            onChange={setFullName}
            autoComplete="name"
            required
          />
          <Feld
            label="Name deines Betriebs"
            value={tenantName}
            onChange={setTenantName}
            required
          />
          <div className="space-y-1">
            <label className="text-sm font-medium">Land</label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full rounded-full border border-border bg-background px-4 py-3"
            >
              {LAENDER.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </select>
            {currency ? (
              <p className="px-4 text-xs text-muted-foreground">
                Abrechnungswährung: {currency}
              </p>
            ) : null}
          </div>
        </>
      ) : null}

      <Feld
        label="E-Mail"
        type="email"
        value={email}
        onChange={setEmail}
        autoComplete="email"
        required
      />
      <Feld
        label="Passwort"
        type="password"
        value={password}
        onChange={setPassword}
        autoComplete={modus === "login" ? "current-password" : "new-password"}
        required
      />

      {fehler ? <p className="text-sm text-red-600">{fehler}</p> : null}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-full bg-primary px-4 py-3 font-medium text-primary-foreground disabled:opacity-60"
      >
        {busy
          ? "Bitte warten …"
          : modus === "login"
            ? "Anmelden"
            : "Konto erstellen"}
      </button>

      {modus === "register" ? (
        <p className="text-center text-xs text-muted-foreground">
          Kostenlos starten — wir berechnen nur 8 % Provision pro Buchung, kein
          monatliches Abo.
        </p>
      ) : null}
    </form>
  );
}

function Feld({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required={required}
        className="w-full rounded-full border border-border bg-background px-4 py-3"
      />
    </div>
  );
}
