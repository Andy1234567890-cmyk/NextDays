"use client";

// „Passwort vergessen": E-Mail eingeben, Reset-Link anfordern.
//
// UNVERHANDELBAR — die Oberfläche darf NICHT verraten, ob es zu einer Adresse
// ein Konto gibt (User-Enumeration). Konkret heißt das hier:
//   - Es gibt genau EINEN Ausgang: die neutrale Bestätigung. Kein Fehlerpfad,
//     kein „unbekannte Adresse", kein abweichender Text.
//   - Die Server-Action `passwortVergessen` gibt deshalb immer `ok` zurück und
//     verschluckt Serverfehler; ein sichtbarer Fehler wäre bereits ein Signal.
//   - Auch die WARTEZEIT darf nicht unterscheiden: eine existierende Adresse
//     kostet den Server einen Mailversand, eine unbekannte nicht. Ohne
//     Gegenmaßnahme wäre der Unterschied messbar. Deshalb wartet die Ansicht
//     immer bis zu einer festen Mindestdauer, bevor sie umschaltet.
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";
import { Label } from "@nextdays/ui/label";
import { passwortVergessen } from "@/lib/einladung";

/** Feste Mindestdauer des Vorgangs in Millisekunden (Timing-Angleich, s. o.).
 *  Großzügig genug, dass Mailversand vs. kein Versand darin verschwindet. */
const MINDESTDAUER_MS = 1200;

export function PasswortVergessenFormular() {
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [gesendet, setGesendet] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLaeuft(true);
    // Beide Versprechen parallel: der Aufruf UND die Mindestdauer. Erst wenn
    // BEIDE durch sind, wird umgeschaltet — die sichtbare Dauer ist damit
    // unabhängig davon, ob der Server eine Mail verschickt hat.
    await Promise.all([
      passwortVergessen(email.trim()),
      new Promise((r) => setTimeout(r, MINDESTDAUER_MS)),
    ]);
    setLaeuft(false);
    setGesendet(true);
  }

  if (gesendet) {
    return (
      <div className="flex w-full flex-col items-center gap-4 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-accent/10">
          <Icon icon="ph:envelope-simple" className="size-7 text-accent" aria-hidden />
        </span>
        <h1 className="font-display text-3xl font-extrabold">{t("forgot.sentTitle")}</h1>
        {/* Neutral formuliert („falls ein Konto existiert") — der Text ist für
            eine bekannte und eine unbekannte Adresse wortgleich. */}
        <p className="text-sm text-muted-foreground">{t("forgot.sentText")}</p>
        <p className="text-sm text-muted-foreground">{t("forgot.spamHint")}</p>
        <div className="flex w-full flex-col gap-3 pt-2">
          <Button asChild className="w-full">
            <Link href="/login">{t("toLogin")}</Link>
          </Button>
          {/* Erneut anfordern: zurück ins Formular. Wie oft das wirklich eine
              Mail auslöst, entscheidet die Sperrfrist im Server. */}
          <button
            type="button"
            onClick={() => setGesendet(false)}
            className="text-sm font-medium text-accent hover:underline"
          >
            {t("forgot.again")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h1 className="text-center font-display text-3xl font-extrabold">
          {t("forgot.title")}
        </h1>
        <p className="text-center text-sm text-muted-foreground">
          {t("forgot.intro")}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="forgot-email">
          {t("forgot.emailLabel")} <span className="text-destructive">*</span>
        </Label>
        <Input
          id="forgot-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
          autoComplete="email"
        />
      </div>

      <Button type="submit" disabled={laeuft || email.trim().length === 0}>
        {laeuft ? t("forgot.sending") : t("forgot.submit")}
      </Button>

      <Link
        href="/login"
        className="text-center text-sm font-medium text-accent hover:underline"
      >
        {t("toLogin")}
      </Link>
    </form>
  );
}
