"use client";

// Login-Seite (zweispaltig): Formular links, Hero-Bild rechts.
// Ruft die Server-Action login() (→ FastAPI /auth/login). Bei Erfolg ins Dashboard.
import { Icon } from "@iconify/react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login, loginTotp } from "@/lib/auth";
import { signInWithProvider } from "@/lib/oauth-login";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [stay, setStay] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // 2FA-Schritt: sobald mfaToken gesetzt ist, fragt das Formular den Code ab
  // statt E-Mail/Passwort. Der Token ist kurzlebig und nur zum Code-Einlösen.
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [code, setCode] = useState("");

  function goDashboard() {
    // Andy begruesst im Dashboard selbst — dort liegt eine gueltige
    // User-Geste (Consent-Klick) vor, ohne die der Browser Sprache verwirft.
    router.replace("/");
    router.refresh();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await login(email, password);
    if ("mfaRequired" in res && res.mfaRequired) {
      setMfaToken(res.mfaToken);
      setLoading(false);
      return;
    }
    if (res.ok) {
      goDashboard();
    } else {
      setError(res.error);
      setLoading(false);
    }
  }

  async function onSubmitCode(e: React.FormEvent) {
    e.preventDefault();
    if (!mfaToken) return;
    setLoading(true);
    setError(null);

    const res = await loginTotp(mfaToken, code.trim());
    if (res.ok) {
      goDashboard();
    } else {
      setError(res.error);
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      {/* Linke Spalte: Formular */}
      <div className="flex flex-col px-6 py-8 lg:px-16">
        <Logo heightRem={1.75} />

        <div className="flex flex-1 items-center justify-center">
          {mfaToken ? (
            <form
              onSubmit={onSubmitCode}
              className="flex w-full max-w-sm flex-col gap-5"
            >
              <h1 className="text-center font-display text-3xl font-extrabold">
                Bestätigung
              </h1>
              <p className="text-center text-sm text-muted-foreground">
                Gib den 6-stelligen Code aus deiner Authenticator-App ein.
                Alternativ funktioniert ein Wiederherstellungscode.
              </p>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="code">
                  Code <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  autoFocus
                  placeholder="123456"
                />
              </div>

              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}

              <Button type="submit" disabled={loading}>
                {loading ? "Prüfe…" : "Bestätigen"}
              </Button>

              <button
                type="button"
                onClick={() => {
                  setMfaToken(null);
                  setCode("");
                  setError(null);
                }}
                className="text-center text-sm font-medium text-accent hover:underline"
              >
                Zurück zur Anmeldung
              </button>
            </form>
          ) : (
          <form
            onSubmit={onSubmit}
            className="flex w-full max-w-sm flex-col gap-5"
          >
            <h1 className="text-center font-display text-3xl font-extrabold">
              Anmelden
            </h1>

            {/* Social-Login via Supabase OAuth (Apple folgt, sobald konfiguriert) */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() => signInWithProvider("google")}
              >
                <Icon icon="logos:google-icon" className="size-4" />
                Google
              </Button>
              <Button type="button" variant="outline" className="gap-2" disabled>
                <Icon icon="ph:apple-logo-fill" className="size-4" />
                Apple
              </Button>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">
                E-Mail <span className="text-destructive">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">
                Passwort <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? "Passwort verbergen" : "Passwort anzeigen"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <Icon
                    icon={showPw ? "ph:eye-slash" : "ph:eye"}
                    className="size-5"
                  />
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <Link
                href="#"
                className="text-sm font-medium text-accent hover:underline"
              >
                Passwort vergessen?
              </Link>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={stay}
                onChange={(e) => setStay(e.target.checked)}
                className="size-4 rounded border-input"
              />
              Eingeloggt bleiben
            </label>

            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}

            <Button type="submit" disabled={loading}>
              {loading ? "Anmelden…" : "Anmelden"}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Noch kein myNextDays-Kunde?{" "}
              <Link
                href="/signup"
                className="font-medium text-accent hover:underline"
              >
                Jetzt kostenlos testen
              </Link>
            </p>
          </form>
          )}
        </div>
      </div>

      {/* Rechte Spalte: großes Foto (auf Mobile ausgeblendet). */}
      <div className="hidden p-3 lg:block">
        <div className="relative h-full w-full overflow-hidden rounded-2xl">
          <Image
            src="/auth_page/mann_handy.png"
            alt=""
            aria-hidden
            fill
            priority
            sizes="50vw"
            className="object-cover"
          />
        </div>
      </div>
    </main>
  );
}
