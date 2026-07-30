// Trial — Vorteils-Liste links, Anmeldeformular rechts.
//
// Referenz-UX (hostaway.com): Formular-Sektionen liegen dort als eigene helle
// Fläche mit Eyebrow-Heading und einer klar abgesetzten Karte; die Vorteile
// stehen als Check-Liste mit Icon-Kreisen daneben statt als Aufzählung.
"use client";

import { Icon } from "@/components/ui/icon";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";

import { SectionHeading } from "@/components/marketing/section-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Schlüssel + Icon; Titel und Text kommen aus messages (trial.perks.*).
const PERKS = [
  { key: "buchungen", icon: "ph:chart-line-up" },
  { key: "kontrolle", icon: "ph:calendar-check" },
  { key: "freiheit", icon: "ph:device-mobile" },
] as const;

export function MarketingTrial() {
  const t = useTranslations("trial");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitted(true);
  }

  return (
    <section id="testen" className="bg-background">
      <div className="mx-auto max-w-7xl px-6 py-24">
        <SectionHeading eyebrow={t("eyebrow")} heading={t("heading")} sub={t("sub")} />

        <div className="mt-14 grid items-start gap-12 lg:grid-cols-2">
          <div className="lg:pt-4">
            <h3 className="font-display text-xl font-semibold">{t("seitenHeading")}</h3>
            <ul className="mt-8 flex flex-col gap-6">
              {PERKS.map((perk) => (
                <li key={perk.key} className="flex gap-4">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-surface-accent text-accent">
                    <Icon icon={perk.icon} className="size-6" />
                  </span>
                  <div>
                    <p className="font-semibold">{t(`perks.${perk.key}.title`)}</p>
                    <p className="text-muted-foreground">{t(`perks.${perk.key}.text`)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-3xl border border-border bg-card p-8 shadow-soft sm:p-10">
            {submitted ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                <Icon icon="ph:check-circle-fill" className="size-12 text-success" />
                <p className="font-display text-xl font-semibold">{t("dankeTitel")}</p>
                <p className="text-sm text-muted-foreground">{t("dankeText")}</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="fname">{t("vorname")}</Label>
                    <Input id="fname" name="fname" required />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="lname">{t("nachname")}</Label>
                    <Input id="lname" name="lname" required />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email">{t("email")}</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder={t("emailPlatzhalter")}
                    required
                  />
                </div>
                <label className="flex items-start gap-3 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    name="gdpr"
                    className="mt-0.5 size-4 rounded border-border accent-[var(--accent)]"
                  />
                  <span>{t("einwilligung")}</span>
                </label>
                <Button type="submit" variant="accent" size="lg" className="mt-2">
                  {t("absenden")}
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
