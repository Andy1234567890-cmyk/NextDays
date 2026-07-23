"use client";

// Linke Bereichs-Navigation der Kontoeinstellungen (Airbnb-Muster): oben die
// „E-Mail bestätigen"-Karte (schließbar), darunter die volle Bereichsliste mit
// Icons und einem Trenner vor den geschäftlichen Bereichen. Der aktive Bereich
// steckt im ?bereich=-Query-Param (Seite bleibt Server-Component).
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

// Obere Gruppe (persönlich/sicherheit) und untere Gruppe (geschäftlich) —
// getrennt durch eine Linie, wie bei Airbnb. `badge` = „Neu"-Chip.
const OBEN = [
  { key: "persoenlich", label: "navPersoenlich", icon: "solar:user-line-duotone" },
  { key: "sicherheit", label: "navSicherheit", icon: "solar:shield-keyhole-line-duotone" },
  { key: "datenschutz", label: "navDatenschutz", icon: "solar:hand-stars-line-duotone" },
  { key: "benachrichtigungen", label: "navBenachrichtigungen", icon: "solar:bell-line-duotone" },
  { key: "steuern", label: "navSteuern", icon: "solar:calculator-line-duotone" },
  { key: "zahlungen", label: "navZahlungen", icon: "solar:card-line-duotone", badge: true },
  { key: "sprache", label: "navSprache", icon: "solar:global-line-duotone" },
  { key: "buchungsrechte", label: "navBuchungsrechte", icon: "solar:calendar-line-duotone" },
] as const;

const UNTEN = [
  { key: "unternehmen", label: "navUnternehmen", icon: "solar:case-line-duotone" },
  { key: "profitools", label: "navProfiTools", icon: "solar:widget-line-duotone" },
] as const;

export function KontoNav() {
  const t = useTranslations("konto");
  const params = useSearchParams();
  const aktiv = params.get("bereich") ?? "persoenlich";
  const [bannerZu, setBannerZu] = useState(false);

  function Eintrag(item: {
    key: string;
    label: string;
    icon: string;
    badge?: boolean;
  }) {
    const active = aktiv === item.key;
    return (
      <Link
        key={item.key}
        href={`/konto?bereich=${item.key}`}
        className={`flex items-center gap-3 rounded-xl px-4 py-3 text-[0.9375rem] transition-colors ${
          active
            ? "bg-muted font-medium text-foreground"
            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
        }`}
      >
        <Icon icon={item.icon} className="size-5 shrink-0" />
        <span className="flex-1">{t(item.label)}</span>
        {item.badge && (
          <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[0.6875rem] font-semibold text-white">
            {t("badgeNeu")}
          </span>
        )}
      </Link>
    );
  }

  return (
    <div className="space-y-5">
      {/* „E-Mail bestätigen"-Karte */}
      {!bannerZu && (
        <div className="rounded-2xl bg-muted/50 p-4">
          <div className="flex items-start gap-3">
            <Icon
              icon="solar:letter-line-duotone"
              className="mt-0.5 size-5 shrink-0 text-foreground"
            />
            <div className="min-w-0 flex-1">
              <p className="text-[0.9375rem] font-semibold leading-snug">
                {t("emailBestaetigenTitel")}
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {t("emailBestaetigenText")}
              </p>
            </div>
            <button
              type="button"
              aria-label={t("abbrechen")}
              onClick={() => setBannerZu(true)}
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              <Icon icon="ph:x" className="size-4" />
            </button>
          </div>
          <button
            type="button"
            className="mt-3 w-full rounded-xl bg-background py-2.5 text-sm font-semibold shadow-sm ring-1 ring-border transition-colors hover:bg-muted"
          >
            {t("emailBestaetigen")}
          </button>
        </div>
      )}

      <nav className="space-y-1">
        {OBEN.map(Eintrag)}
        <div className="my-3 border-t border-border" />
        {UNTEN.map(Eintrag)}
      </nav>
    </div>
  );
}
