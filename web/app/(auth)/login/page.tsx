"use client";

// Login-Seite (zweispaltig): Formular links, Hero-Bild rechts.
// Ruft die Server-Action login() (→ FastAPI /auth/login). Bei Erfolg ins Dashboard.
import { Icon } from "@iconify/react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Logo } from "@/components/logo";
import { SprachUmschalter } from "@/components/auth/sprach-umschalter";
import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";
import { Label } from "@nextdays/ui/label";
import { ZweiterFaktorSchritt } from "@/components/auth/zweiter-faktor-schritt";
import { login } from "@/lib/auth";
import { rueckzielPruefen } from "@/lib/rueckziel";
import { signInWithProvider } from "@/lib/oauth-login";

export default function LoginPage() {
  const t = useTranslations("login");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [stay, setStay] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // 2FA-Schritt aktiv? Seit 0341 gibt es KEINEN mfa_token mehr — die aal1-
  // Session aus dem Passwort-Schritt liegt bereits in den Cookies und trägt
  // die Challenge.
  const [mfaOffen, setMfaOffen] = useState(false);
  // Welche zweiten Faktoren das Konto hat (vom Server, nicht geraten) und die
  // maskierte SMS-Nummer fuer die Anzeige.
  const [mfaMethods, setMfaMethods] = useState<string[]>([]);
  const [mfaPhone, setMfaPhone] = useState<string | null>(null);
  // Rueckziel aus `?weiter=` — nur fuer den Hinweis oben. Es wird im State
  // gehalten, weil `window` beim ersten Render auf dem Server nicht existiert;
  // ohne das gaebe es einen Hydration-Unterschied.
  const [rueckziel, setRueckziel] = useState<string | null>(null);
  useEffect(() => {
    setRueckziel(
      rueckzielPruefen(new URLSearchParams(window.location.search).get("weiter")),
    );
  }, []);

  function goDashboard() {
    // Andy begruesst im Dashboard selbst — dort liegt eine gueltige
    // User-Geste (Consent-Klick) vor, ohne die der Browser Sprache verwirft.
    //
    // RUECKSPRUNG: Kam der Nutzer aus einer Benachrichtigungs-Mail
    // (`/login?weiter=/aufgaben/<id>`), endet die Anmeldung auf GENAU dieser
    // Seite. Vorher landete jede Anmeldung fest auf `/`, und wer aus einer Mail
    // kam, musste die verlinkte Aufgabe in seiner Liste wiedersuchen.
    // `rueckzielPruefen` laesst nur eigene, relative Pfade durch — ein
    // `?weiter=https://boese.example` waere sonst ein offener Redirect
    // (Wurzel 8). Faellt die Pruefung durch, bleibt es beim Dashboard.
    // `rueckziel` ist bereits geprueft (siehe useEffect oben) — hier nur noch
    // anwenden. Ohne Ziel bleibt es das Dashboard.
    router.replace(rueckziel ?? "/");
    router.refresh();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await login(email, password);
    if ("mfaRequired" in res && res.mfaRequired) {
      setMfaOffen(true);
      setMfaMethods(res.mfaMethods);
      setMfaPhone(res.mfaPhoneMasked);
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

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      {/* Linke Spalte: Formular */}
      <div className="flex flex-col px-6 py-8 lg:px-16">
        {/* Kopfzeile: Logo links, Sprachumschalter rechts — wie in AuthSchale.
            Die Anmeldung hat keinen Token, ihre Sprache kommt aus dem Browser;
            der Umschalter ist die Korrektur, wenn das danebenliegt. */}
        <div className="flex items-center justify-between gap-4">
          <Logo heightRem={1.75} />
          <SprachUmschalter />
        </div>

        <div className="flex flex-1 items-center justify-center">
          {mfaOffen ? (
            <ZweiterFaktorSchritt
              methods={mfaMethods}
              phoneMasked={mfaPhone}
              onErfolg={goDashboard}
              onAbbruch={() => {
                setMfaOffen(false);
                setMfaMethods([]);
                setMfaPhone(null);
                setError(null);
              }}
            />
          ) : (
          <form
            onSubmit={onSubmit}
            className="flex w-full max-w-sm flex-col gap-5"
          >
            <h1 className="text-center font-display text-3xl font-extrabold">
              {t("title")}
            </h1>

            {/* Kam der Nutzer aus einer Benachrichtigungs-Mail, sagt die Seite
                WARUM sie da ist. Ohne diesen Satz sah es nach einem Defekt aus:
                geklickt wurde eine Aufgabe, gelandet ist man auf der
                Anmeldung. Der Hinweis nennt keinen Inhalt des Ziels — nur,
                dass der Link zum eigenen Betrieb gehoert. */}
            {rueckziel ? (
              <p className="rounded-(--radius) bg-muted px-3 py-2 text-center text-sm text-muted-foreground">
                {t("weiterHinweis")}
              </p>
            ) : null}

            {/* Social-Login via Supabase OAuth (Apple folgt, sobald konfiguriert) */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() => signInWithProvider("google")}
              >
                <Icon icon="logos:google-icon" className="size-4" />
                {t("google")}
              </Button>
              <Button type="button" variant="outline" className="gap-2" disabled>
                <Icon icon="ph:apple-logo-fill" className="size-4" />
                {t("apple")}
              </Button>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">
                {t("emailLabel")} <span className="text-destructive">*</span>
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
                {t("passwordLabel")} <span className="text-destructive">*</span>
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
                  aria-label={showPw ? t("hidePassword") : t("showPassword")}
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
                href="/passwort-vergessen"
                className="text-sm font-medium text-accent hover:underline"
              >
                {t("forgot")}
              </Link>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={stay}
                onChange={(e) => setStay(e.target.checked)}
                className="size-4 rounded border-input"
              />
              {t("stayLoggedIn")}
            </label>

            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}

            <Button type="submit" disabled={loading}>
              {loading ? t("submitting") : t("submit")}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              {t("noAccount")}{" "}
              <Link
                href="/signup"
                className="font-medium text-accent hover:underline"
              >
                {t("signupLink")}
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
