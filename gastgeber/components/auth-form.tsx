// Login-/Registrier-Formular (Client-Insel). Ruft die Server Actions aus
// lib/auth.ts — kein direkter Backend-Zugriff, kein Token im Client.
"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("auth");
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
        if (!currency) return setFehler(t("landWaehlen"));
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
            {t("anmeldungBestaetigen")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("faktorWaehlen")}
          </p>
          {mfa.methods.includes("sms") ? (
            <button
              type="button"
              onClick={() => setMfaMode("sms")}
              className="w-full rounded-2xl border border-border px-4 py-4 text-left transition hover:border-foreground"
            >
              <p className="font-medium">{t("smsCode")}</p>
              <p className="text-sm text-muted-foreground">
                {t("anNummer", { nummer: mfa.phoneMasked ?? t("deineNummer") })}
              </p>
            </button>
          ) : null}
          {mfa.methods.includes("totp") ? (
            <button
              type="button"
              onClick={() => setMfaMode("totp")}
              className="w-full rounded-2xl border border-border px-4 py-4 text-left transition hover:border-foreground"
            >
              <p className="font-medium">{t("authenticatorApp")}</p>
              <p className="text-sm text-muted-foreground">
                {t("authenticatorHinweis")}
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
        <h2 className="font-display text-xl font-semibold">
          {t("bestaetigungscode")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {mfaMode === "sms"
            ? t("codeGesendet", {
                nummer: mfa.phoneMasked ?? t("deineNummer"),
              })
            : t("codeAusApp")}
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
          {busy ? t("prueft") : t("anmelden")}
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
            {t("andereMethode")}
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
          {t("anmelden")}
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
          {t("registrieren")}
        </button>
      </div>

      {modus === "register" ? (
        <>
          <Feld
            label={t("deinName")}
            value={fullName}
            onChange={setFullName}
            autoComplete="name"
            required
          />
          <Feld
            label={t("betriebName")}
            value={tenantName}
            onChange={setTenantName}
            required
          />
          <div className="space-y-1">
            <label className="text-sm font-medium">{t("land")}</label>
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
                {t("abrechnungswaehrung", { waehrung: currency })}
              </p>
            ) : null}
          </div>
        </>
      ) : null}

      <Feld
        label={t("email")}
        type="email"
        value={email}
        onChange={setEmail}
        autoComplete="email"
        required
      />
      <Feld
        label={t("passwort")}
        type="password"
        value={password}
        onChange={setPassword}
        autoComplete={modus === "login" ? "current-password" : "new-password"}
        required
        anzeigenLabel={t("passwortAnzeigen")}
        verbergenLabel={t("passwortVerbergen")}
      />

      {fehler ? <p className="text-sm text-red-600">{fehler}</p> : null}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-full bg-primary px-4 py-3 font-medium text-primary-foreground disabled:opacity-60"
      >
        {busy
          ? t("bitteWarten")
          : modus === "login"
            ? t("anmelden")
            : t("kontoErstellen")}
      </button>

      {modus === "register" ? (
        <p className="text-center text-xs text-muted-foreground">
          {t("provisionHinweis")}
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
  anzeigenLabel,
  verbergenLabel,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  // Nur gesetzt, wenn das Feld eine Sichtbar-Umschaltung tragen soll.
  anzeigenLabel?: string;
  verbergenLabel?: string;
}) {
  const [sichtbar, setSichtbar] = useState(false);
  const umschaltbar = type === "password" && anzeigenLabel && verbergenLabel;

  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">{label}</label>
      <div className="relative">
        <input
          type={umschaltbar && sichtbar ? "text" : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          required={required}
          className={`w-full rounded-full border border-border bg-background px-4 py-3 ${
            umschaltbar ? "pr-14" : ""
          }`}
        />
        {umschaltbar ? (
          <button
            type="button"
            onClick={() => setSichtbar((v) => !v)}
            aria-label={sichtbar ? verbergenLabel : anzeigenLabel}
            className="absolute right-5 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
          >
            <Icon icon={sichtbar ? "ph:eye-slash" : "ph:eye"} className="size-5" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
