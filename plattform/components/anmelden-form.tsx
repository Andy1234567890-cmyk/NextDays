// Login-/Registrier-/Passwort-vergessen-Formular (Client-Insel). Ruft die
// PUBLIC guest-auth-Endpunkte, persistiert die Session über die Server Action
// setGuestSession(...) und routet danach ins Dashboard (bzw. ?weiter=…).
"use client";

import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  guestLogin,
  guestPasswordReset,
  guestPasswortNeu,
  guestRegister,
} from "@/lib/guest-auth";
import { setGuestSession } from "@/lib/guest-session";

// `code` ist der vierte Modus: nach dem Anstossen des Resets gibt der Gast
// hier den CODE aus der Mail ein. Der LINK in der Mail fuehrte bis
// 03.09.2026 auf Kongs Fehlerseite (`/verify` statt `/auth/v1/verify`), und
// eine Seite zum Setzen des Passworts gab es ueberhaupt nicht — das
// Formular versprach einen „Link zum Zuruecksetzen", der ins Nichts fuehrte.
type Modus = "login" | "register" | "reset" | "code";

export function AnmeldenForm({ weiter }: { weiter: string }) {
  const router = useRouter();
  const [modus, setModus] = useState<Modus>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [wiederholung, setWiederholung] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFehler(null);
    setHinweis(null);

    if (modus === "reset") {
      const res = await guestPasswordReset(email);
      setBusy(false);
      if (res.ok) {
        // Direkt zur Code-Eingabe: die Mail enthaelt den Code, und ohne
        // diesen Schritt wuesste der Gast nicht, wohin damit.
        setModus("code");
        setHinweis(
          "Falls ein Konto mit dieser E-Mail existiert, haben wir dir einen Code geschickt. Gib ihn hier ein.",
        );
      } else {
        setFehler(res.error);
      }
      return;
    }

    if (modus === "code") {
      // Vor dem Absenden vergleichen: ein Tippfehler in der Wiederholung
      // wuerde sonst den Code verbrauchen (GoTrue macht ihn beim Pruefen
      // ungueltig) und eine neue Mail erfordern.
      if (password !== wiederholung) {
        setBusy(false);
        setFehler("Die Passwörter stimmen nicht überein.");
        return;
      }
      const res = await guestPasswortNeu(email, code.trim(), password);
      if (!res.ok) {
        setBusy(false);
        setFehler(res.error);
        return;
      }
      await setGuestSession(
        res.data.access_token,
        res.data.refresh_token,
        res.data.expires_in,
      );
      router.replace(weiter);
      router.refresh();
      return;
    }

    const res =
      modus === "login"
        ? await guestLogin(email, password)
        : await guestRegister({
            email,
            password,
            name,
            phone: phone.trim() || undefined,
          });

    if (!res.ok) {
      setBusy(false);
      setFehler(res.error);
      return;
    }
    await setGuestSession(
      res.data.access_token,
      res.data.refresh_token,
      res.data.expires_in,
    );
    // Nach dem Login den Zielpfad ansteuern; router.refresh, damit die
    // Server-Components die neue Cookie-Session sehen.
    router.replace(weiter);
    router.refresh();
  }

  return (
    <div className="w-full max-w-md">
      {modus !== "reset" && (
        <div className="mb-6 flex rounded-full bg-secondary p-1">
          {(["login", "register"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setModus(m);
                setFehler(null);
                setHinweis(null);
              }}
              className={
                "min-h-11 flex-1 rounded-full text-sm font-medium transition-colors " +
                (modus === m
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              {m === "login" ? "Anmelden" : "Registrieren"}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {modus === "register" && (
          <Feld
            label="Name"
            icon="ph:user"
            value={name}
            onChange={setName}
            type="text"
            required
            autoComplete="name"
          />
        )}

        <Feld
          label="E-Mail"
          icon="ph:envelope-simple"
          value={email}
          onChange={setEmail}
          type="email"
          required
          autoComplete="email"
          inputMode="email"
        />

        {modus === "code" && (
          <Feld
            label="Code aus der E-Mail"
            icon="ph:key"
            value={code}
            onChange={setCode}
            type="text"
            required
            autoComplete="one-time-code"
          />
        )}

        {modus !== "reset" && (
          <Feld
            label={modus === "code" ? "Neues Passwort" : "Passwort"}
            icon="ph:lock-simple"
            value={password}
            onChange={setPassword}
            type="password"
            required
            autoComplete={
              modus === "login" ? "current-password" : "new-password"
            }
          />
        )}

        {modus === "code" && (
          <Feld
            label="Passwort wiederholen"
            icon="ph:lock-simple"
            value={wiederholung}
            onChange={setWiederholung}
            type="password"
            required
            autoComplete="new-password"
          />
        )}

        {modus === "register" && (
          <Feld
            label="Telefon (optional)"
            icon="ph:phone"
            value={phone}
            onChange={setPhone}
            type="tel"
            autoComplete="tel"
          />
        )}

        {fehler && (
          <p className="rounded-xl bg-accent/10 px-3 py-2 text-sm text-accent">
            <Icon icon="ph:warning-circle" className="mr-1 inline size-4" />
            {fehler}
          </p>
        )}
        {hinweis && (
          <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <Icon icon="ph:check-circle" className="mr-1 inline size-4" />
            {hinweis}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-6 font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {busy && <Icon icon="ph:spinner" className="size-5 animate-spin" />}
          {/* „Code senden" statt „Link senden": die Mail traegt beides, aber
              nur der Code funktioniert (der Link zeigte auf `/verify` statt
              `/auth/v1/verify`). Eine Beschriftung, die etwas verspricht,
              was ins Nichts fuehrt, ist selbst der Fehler. */}
          {modus === "login"
            ? "Anmelden"
            : modus === "register"
              ? "Konto erstellen"
              : modus === "code"
                ? "Passwort setzen"
                : "Code senden"}
        </button>
      </form>

      <div className="mt-4 text-center text-sm text-muted-foreground">
        {modus === "login" && (
          <button
            type="button"
            onClick={() => {
              setModus("reset");
              setFehler(null);
              setHinweis(null);
            }}
            className="inline-flex min-h-11 items-center px-3 hover:text-foreground hover:underline"
          >
            Passwort vergessen?
          </button>
        )}
        {(modus === "reset" || modus === "code") && (
          <button
            type="button"
            onClick={() => {
              setModus("login");
              setFehler(null);
              setHinweis(null);
            }}
            className="inline-flex min-h-11 items-center px-3 hover:text-foreground hover:underline"
          >
            Zurück zur Anmeldung
          </button>
        )}
      </div>
    </div>
  );
}

function Feld({
  label,
  icon,
  value,
  onChange,
  type,
  required,
  autoComplete,
  inputMode,
}: {
  label: string;
  icon: string;
  value: string;
  onChange: (v: string) => void;
  type: string;
  required?: boolean;
  autoComplete?: string;
  /** Mobile Tastatur-Variante — ohne sie tippt der Gast eine E-Mail auf der
   *  Buchstabentastatur ohne @ und die Telefonnummer ohne Ziffernblock. */
  inputMode?: "text" | "email" | "tel";
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <span className="flex min-h-12 items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 focus-within:border-ring">
        <Icon icon={icon} className="size-5 text-muted-foreground" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          type={type}
          required={required}
          autoComplete={autoComplete}
          inputMode={inputMode}
          // text-base ist Pflicht: unter 16 px zoomt iOS Safari beim Fokus in
          // das Feld hinein, danach sitzt die Seite verschoben und der
          // Anmelden-Knopf liegt außerhalb. Ab sm wieder 14 px.
          className="w-full bg-transparent text-base outline-none placeholder:text-muted-foreground sm:text-sm"
        />
      </span>
    </label>
  );
}
