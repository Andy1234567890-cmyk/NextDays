// Login-/Registrier-Formular (Client-Insel). Ruft die Server Actions aus
// lib/auth.ts — kein direkter Backend-Zugriff, kein Token im Client.
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { login, loginSms, loginTotp, registerHost } from "@/lib/auth";
import { currencyForCountry, LAENDER } from "@nextdays/laender";

import { CodeEingabe } from "./konto/code-eingabe";

type Modus = "login" | "register";
// Der aktuell gewählte 2. Faktor im Login. null = noch keiner ausgewählt
// (nur relevant, wenn das Konto BEIDE Faktoren hat und der Nutzer wählen muss).
type MfaMode = "sms" | "totp";

type MfaState = {
  token: string;
  methods: string[];
  phoneMasked: string | null;
};

export function AuthForm({ weiter }: { weiter: string }) {
  const router = useRouter();
  const [modus, setModus] = useState<Modus>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [country, setCountry] = useState("DE");
  const [mfa, setMfa] = useState<MfaState | null>(null);
  // Bei genau einem Faktor direkt gesetzt; bei zweien erst nach Auswahl.
  const [mfaMode, setMfaMode] = useState<MfaMode | null>(null);
  const [code, setCode] = useState("");
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
        if (res.mfaRequired) {
          setMfa({
            token: res.mfaToken,
            methods: res.mfaMethods,
            phoneMasked: res.mfaPhoneMasked,
          });
          // Nur ein Faktor → direkt dorthin; sonst Auswahl anzeigen.
          setMfaMode(res.mfaMethods.length === 1 ? (res.mfaMethods[0] as MfaMode) : null);
          return;
        }
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

  async function pruefeCode(codeWert: string) {
    if (!mfa || !mfaMode) return;
    setFehler(null);
    setBusy(true);
    try {
      const res =
        mfaMode === "sms"
          ? await loginSms(mfa.token, codeWert)
          : await loginTotp(mfa.token, codeWert);
      if (!res.ok) {
        setCode("");
        return setFehler(res.error);
      }
      router.push(weiter);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  // --- 2. Login-Schritt bei aktiver 2FA -------------------------------------
  if (mfa) {
    // Konto hat beide Faktoren, aber noch keiner gewählt → Auswahl anzeigen.
    if (!mfaMode) {
      return (
        <div className="w-full max-w-sm space-y-4">
          <h2 className="font-display text-xl font-semibold">
            Bestätige deine Anmeldung
          </h2>
          <p className="text-sm text-muted-foreground">
            Wähle, wie du deinen zweiten Faktor bestätigen möchtest.
          </p>
          {mfa.methods.includes("sms") ? (
            <button
              type="button"
              onClick={() => setMfaMode("sms")}
              className="w-full rounded-2xl border border-border px-4 py-4 text-left transition hover:border-foreground"
            >
              <p className="font-medium">SMS-Code</p>
              <p className="text-sm text-muted-foreground">
                An {mfa.phoneMasked ?? "deine Nummer"}
              </p>
            </button>
          ) : null}
          {mfa.methods.includes("totp") ? (
            <button
              type="button"
              onClick={() => setMfaMode("totp")}
              className="w-full rounded-2xl border border-border px-4 py-4 text-left transition hover:border-foreground"
            >
              <p className="font-medium">Authenticator-App</p>
              <p className="text-sm text-muted-foreground">
                6-stelliger Code aus deiner App
              </p>
            </button>
          ) : null}
          {fehler ? <p className="text-sm text-red-600">{fehler}</p> : null}
        </div>
      );
    }

    const kannWechseln = mfa.methods.length > 1;
    return (
      <div className="w-full max-w-sm space-y-4">
        <h2 className="font-display text-xl font-semibold">Bestätigungscode</h2>
        <p className="text-sm text-muted-foreground">
          {mfaMode === "sms"
            ? `Wir haben einen 6-stelligen Code an ${mfa.phoneMasked ?? "deine Nummer"} gesendet.`
            : "Gib den 6-stelligen Code aus deiner Authenticator-App ein."}
        </p>
        <CodeEingabe
          disabled={busy}
          onChange={setCode}
          onComplete={(c) => void pruefeCode(c)}
        />
        {fehler ? <p className="text-sm text-red-600">{fehler}</p> : null}
        <button
          type="button"
          onClick={() => void pruefeCode(code)}
          disabled={busy || code.length !== 6}
          className="w-full rounded-full bg-primary px-4 py-3 font-medium text-primary-foreground disabled:opacity-60"
        >
          {busy ? "Prüfe …" : "Anmelden"}
        </button>
        {kannWechseln ? (
          <button
            type="button"
            onClick={() => {
              setMfaMode(null);
              setCode("");
              setFehler(null);
            }}
            className="w-full text-center text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Andere Methode wählen
          </button>
        ) : null}
      </div>
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
          Kostenlos starten — 8 % Provision nur auf Buchungen über myNextDays.
          Direktbuchungen über deine eigene Seite bleiben provisionsfrei.
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
