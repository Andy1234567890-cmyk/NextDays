// Trial — "NextDays 30 Tage kostenlos testen" mit 3 Vorteils-Icons (links)
// und Anmeldeformular (rechts). Figma: peach-Hintergrund-Block, zweispaltig.
"use client";

import { Icon } from "@iconify/react";
import { type FormEvent, useState } from "react";

import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";
import { Label } from "@nextdays/ui/label";

const PERKS = [
  {
    icon: "ph:chart-line-up",
    title: "Steigere deine Buchungen",
    text: "um bis zu 46 % mit unserer einfachen Software.",
  },
  {
    icon: "ph:calendar-check",
    title: "Behalte die Kontrolle",
    text: "über alle Check-ins, Buchungen und Rechnungen an einem Ort.",
  },
  {
    icon: "ph:device-mobile",
    title: "Genieße mehr Freiheit",
    text: "und verwalte deine Unterkunft unterwegs mit unserer mobilen App.",
  },
];

export function MarketingTrial() {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitted(true);
  }

  return (
    <section className="bg-secondary/40">
      <div className="mx-auto max-w-7xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            myNextDays 30 Tage kostenlos testen.
          </h2>
          <p className="mt-3 text-muted-foreground">
            Keine Mindestlaufzeit. Jederzeit kündbar. Fülle einfach dieses kurze
            Formular aus:
          </p>
        </div>

        <div className="mt-12 grid gap-12 lg:grid-cols-2">
          <div className="flex flex-col justify-center">
            <h3 className="font-display text-xl font-semibold">
              Schließe dich tausenden Gastgebern an, die mehr
              Distributionskraft, Kontrolle und Effizienz gewonnen haben.
            </h3>
            <ul className="mt-8 flex flex-col gap-6">
              {PERKS.map((perk) => (
                <li key={perk.title} className="flex gap-4">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                    <Icon icon={perk.icon} className="size-6" />
                  </span>
                  <div>
                    <p className="font-semibold">{perk.title}</p>
                    <p className="text-sm text-muted-foreground">{perk.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-border bg-card p-8 shadow-lg">
            {submitted ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                <Icon icon="ph:check-circle-fill" className="size-12 text-success" />
                <p className="font-display text-xl font-semibold">Vielen Dank!</p>
                <p className="text-sm text-muted-foreground">
                  Wir melden uns in Kürze bei dir.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="fname">Vorname</Label>
                    <Input id="fname" name="fname" required />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="lname">Nachname</Label>
                    <Input id="lname" name="lname" required />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email">E-Mail</Label>
                  <Input id="email" name="email" type="email" placeholder="name@beispiel.de" required />
                </div>
                <label className="flex items-start gap-3 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    name="gdpr"
                    className="mt-0.5 size-4 rounded border-border accent-[var(--accent)]"
                  />
                  <span>
                    Ja, ich möchte gelegentlich Neuigkeiten, Webinar-Einladungen
                    und Angebote von myNextDays erhalten. Du kannst deine
                    Einwilligung jederzeit widerrufen.
                  </span>
                </label>
                <Button type="submit" variant="accent" size="lg" className="mt-2">
                  Jetzt loslegen
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
