// Trial — "myNextDays 30 Tage kostenlos testen" mit 3 Vorteils-Icons (links)
// und Anmeldeformular (rechts). Figma: peach-Hintergrund-Block, zweispaltig.
"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";

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
    <section className="bg-secondary/40">
      <div className="mx-auto max-w-7xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            {t("heading")}
          </h2>
          <p className="mt-3 text-muted-foreground">{t("sub")}</p>
        </div>

        <div className="mt-12 grid gap-12 lg:grid-cols-2">
          <div className="flex flex-col justify-center">
            <h3 className="font-display text-xl font-semibold">{t("seitenHeading")}</h3>
            <ul className="mt-8 flex flex-col gap-6">
              {PERKS.map((perk) => (
                <li key={perk.key} className="flex gap-4">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                    <Icon icon={perk.icon} className="size-6" />
                  </span>
                  <div>
                    <p className="font-semibold">{t(`perks.${perk.key}.title`)}</p>
                    <p className="text-sm text-muted-foreground">
                      {t(`perks.${perk.key}.text`)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-border bg-card p-8 shadow-lg">
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
