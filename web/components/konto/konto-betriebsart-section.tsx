"use client";

// Betriebsart-Anzeige auf der Konto-Seite (/konto): Ferienvermietung vs. Hotel.
// Die Betriebsart wird beim Onboarding festgelegt und ist danach FIX — kein
// Hin-und-Her-Wechseln (Navigation, Module, Begriffe und Workflows hängen
// daran; ein Wechsel im laufenden Betrieb würde Daten/Prozesse brechen).
import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import type { AccommodationType } from "@/lib/api";
import { getMe } from "@/lib/auth";

const OPTIONS: { value: AccommodationType; icon: string }[] = [
  { value: "vacation_rental", icon: "ph:house-line" },
  { value: "hotel", icon: "ph:bed" },
];

export function KontoBetriebsartSection() {
  const t = useTranslations("accommodationType");
  const [current, setCurrent] = useState<AccommodationType | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      const me = await getMe();
      if (!active) return;
      setCurrent(me?.accommodation_type ?? null);
      setLoaded(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  if (!loaded) return null;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 className="font-display text-lg font-extrabold">{t("title")}</h3>
        <p className="text-sm text-muted-foreground">{t("hint")}</p>
      </div>
      {/* Container-Query statt Viewport-Breakpoint: die Karte steht in einer
          schmalen Spalte der Konto-Seite. Mit `sm:grid-cols-2` standen die zwei
          Kacheln ab 640 px VIEWPORT nebeneinander — auch wenn die Spalte selbst
          nur ~24 rem breit war, wodurch Titel und Hinweistext ineinander
          liefen. `@container` misst die Spalte, nicht das Fenster. */}
      <div className="@container">
        <div className="grid grid-cols-1 gap-3 @md:grid-cols-2">
          {OPTIONS.map((opt) => {
            const active = current === opt.value;
            return (
              <div
                key={opt.value}
                aria-current={active}
                className={
                  "relative flex items-center gap-3 rounded-(--radius) border p-4 pr-10 " +
                  (active
                    ? "border-primary bg-primary/5"
                    : "border-border opacity-60")
                }
              >
                <span
                  className={
                    "flex size-10 shrink-0 items-center justify-center rounded-full " +
                    (active
                      ? "bg-primary/10 text-primary"
                      : "bg-secondary text-muted-foreground")
                  }
                >
                  <Icon icon={opt.icon} className="size-5" />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm font-medium">{t(opt.value)}</span>
                  <span className="break-words text-xs text-muted-foreground">
                    {t(`${opt.value}Hint`)}
                  </span>
                </span>
                {/* Häkchen in der Ecke, nicht im Textfluss: sonst wandert es bei
                    umbrechendem Hinweistext in die Mitte der Kachel. */}
                {active && (
                  <Icon
                    icon="ph:check-circle-fill"
                    className="absolute right-3 top-3 size-5 text-primary"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon icon="ph:lock-simple" className="size-3.5 shrink-0" />
        {t("locked")}
      </p>
    </section>
  );
}
