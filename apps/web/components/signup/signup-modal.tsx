"use client";

// Sign-up-Modal über dem Demo-Kalender (wie Lodgify). Zwei Phasen:
//  1) Auswahl: Überschrift + Feature-Häkchen + Google/Apple/E-Mail + Login-Link
//  2) Laden:   Fortschrittsbalken + „Deine eigene Buchungswebsite …"
// Größen in rem, Buttons rounded-full (Projekt-Regeln), Icons via Iconify.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Logo } from "@/components/logo";
import { SignupForm } from "@/components/signup/signup-form";
import { Button } from "@/components/ui/button";
import { signInWithProvider } from "@/lib/oauth-login";

// Feature-Liste mit grünem Häkchen (deutsch).
const FEATURES = [
  "Kalender automatisch synchronisieren",
  "Direktbuchungen auf der eigenen Seite",
  "Gästenachrichten automatisieren",
] as const;

type Phase = "choose" | "email" | "loading";

export function SignupModal() {
  const [phase, setPhase] = useState<Phase>("choose");
  const [progress, setProgress] = useState(0);

  // Fortschrittsbalken hochzählen, sobald der Ladezustand (OAuth) startet.
  useEffect(() => {
    if (phase !== "loading") return;
    const t = setInterval(() => {
      setProgress((p) => (p >= 100 ? 100 : p + 2));
    }, 60);
    return () => clearInterval(t);
  }, [phase]);

  function startOAuth() {
    setProgress(0);
    setPhase("loading");
  }

  return (
    <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-2xl">
      {phase === "loading" && <LoadingStep progress={progress} />}
      {phase === "email" && (
        <SignupForm onBack={() => setPhase("choose")} />
      )}
      {phase === "choose" && (
        <ChooseStep
          onStartOAuth={startOAuth}
          onEmail={() => setPhase("email")}
        />
      )}
    </div>
  );
}

// --- Phase 1: Auswahl ------------------------------------------------------
function ChooseStep({
  onStartOAuth,
  onEmail,
}: {
  onStartOAuth: () => void;
  onEmail: () => void;
}) {
  const t = useTranslations("legal");
  return (
    <div className="flex flex-col gap-6">
      <Logo heightRem={1.75} />

      <div className="flex flex-col gap-2">
        <h1 className="font-display text-2xl font-extrabold leading-tight">
          Deine Vermietung an einem Ort.
        </h1>
      </div>

      <ul className="flex flex-col gap-3">
        {FEATURES.map((f) => (
          <li key={f} className="flex items-center gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <Icon icon="ph:check-bold" className="size-3.5" />
            </span>
            <span className="text-sm">{f}</span>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-3">
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          onClick={() => {
            onStartOAuth();
            signInWithProvider("google");
          }}
        >
          <Icon icon="logos:google-icon" className="size-4" />
          Mit Google registrieren
        </Button>
        <Button type="button" variant="outline" className="gap-2" disabled>
          <Icon icon="ph:apple-logo-fill" className="size-4" />
          Mit Apple registrieren
        </Button>

        <div className="flex items-center gap-3 py-1">
          <span className="h-px flex-1 bg-border" />
          <span className="text-xs uppercase text-muted-foreground">oder</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <Button type="button" className="gap-2" onClick={onEmail}>
          <Icon icon="ph:envelope-simple" className="size-4" />
          Mit E-Mail registrieren
        </Button>
      </div>

      {/* AGB-Einwilligung: Registrierung setzt die Annahme unserer AGB voraus
          (dort verankert: Stripe Connected Account Agreement, § 5). */}
      <p className="text-center text-xs text-muted-foreground">
        {t.rich("signupConsent", {
          agb: (chunks) => (
            <Link
              href="/agb"
              target="_blank"
              className="underline underline-offset-2 hover:text-foreground"
            >
              {chunks}
            </Link>
          ),
        })}
      </p>

      <p className="text-center text-sm text-muted-foreground">
        Schon ein Konto?{" "}
        <Link href="/login" className="font-medium text-accent hover:underline">
          Hier anmelden
        </Link>
      </p>
    </div>
  );
}

// --- Phase 2: Laden --------------------------------------------------------
function LoadingStep({ progress }: { progress: number }) {
  return (
    <div className="flex flex-col items-center gap-6 py-6 text-center">
      <Logo heightRem={1.75} />

      <h2 className="font-display text-2xl font-extrabold leading-tight">
        Deine eigene Buchungswebsite. Behalte 100&nbsp;% jeder Buchung.
      </h2>

      <p className="text-sm text-muted-foreground">
        Wir richten dein Konto ein …
      </p>

      {/* Fortschrittsbalken */}
      <div className="w-full">
        <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-accent transition-all duration-100 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{progress}&nbsp;%</p>
      </div>
    </div>
  );
}
