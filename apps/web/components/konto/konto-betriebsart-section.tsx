"use client";

// Betriebsart-Abschnitt direkt auf der Konto-Seite (/konto, gebündelt statt
// eigener Tab): Ferienvermietung vs. Hotel. Steuert die Dashboard-Navigation
// (Begriffe wie „Objekte"/„Zimmer", Eigentümer-Modul). Umstellen dürfen nur
// Nutzer mit manage_tenant (Admin); alle anderen sehen den Ist-Zustand.
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Separator } from "@/components/ui/separator";
import type { AccommodationType } from "@/lib/api";
import { getMe, setAccommodationType } from "@/lib/auth";

const OPTIONS: { value: AccommodationType; icon: string }[] = [
  { value: "vacation_rental", icon: "ph:house-line" },
  { value: "hotel", icon: "ph:bed" },
];

export function KontoBetriebsartSection() {
  const t = useTranslations("accommodationType");
  const router = useRouter();
  const [current, setCurrent] = useState<AccommodationType | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    void (async () => {
      const me = await getMe();
      if (!active) return;
      setCurrent(me?.accommodation_type ?? null);
      setCanManage(
        me?.role === "admin" || (me?.capabilities ?? []).includes("manage_tenant"),
      );
      setLoaded(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  function onSelect(value: AccommodationType) {
    if (!canManage || value === current) return;
    setError(null);
    startTransition(async () => {
      const res = await setAccommodationType(value);
      if (res.ok) {
        setCurrent(res.data.accommodation_type);
        toast.success(t("saved"));
        // Sidebar (Server Component) sofort auf die neue Betriebsart bringen.
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  if (!loaded) return null;

  return (
    <section className="flex flex-col gap-4">
      <Separator className="my-2" />
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("hint")}</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:max-w-2xl">
        {OPTIONS.map((opt) => {
          const active = current === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              disabled={!canManage || pending}
              aria-pressed={active}
              onClick={() => onSelect(opt.value)}
              className={
                "flex items-center gap-3 rounded-(--radius) border p-4 text-left transition disabled:cursor-not-allowed " +
                (active
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-secondary/50 disabled:hover:bg-transparent")
              }
            >
              <span
                className={
                  "flex size-10 shrink-0 items-center justify-center rounded-full " +
                  (active ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground")
                }
              >
                <Icon icon={opt.icon} className="size-5" />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-sm font-medium">{t(opt.value)}</span>
                <span className="text-xs text-muted-foreground">
                  {t(`${opt.value}Hint`)}
                </span>
              </span>
              {active && (
                <Icon icon="ph:check-circle-fill" className="ml-auto size-5 shrink-0 text-primary" />
              )}
            </button>
          );
        })}
      </div>
      {!canManage && (
        <p className="text-xs text-muted-foreground">{t("adminOnly")}</p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </section>
  );
}
