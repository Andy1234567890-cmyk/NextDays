"use client";

// Linke Bereichs-Navigation der Kontoeinstellungen (Airbnb-Muster): oben die
// „E-Mail bestätigen"-Karte (schließbar), darunter die volle Bereichsliste mit
// Icons und einem Trenner vor den geschäftlichen Bereichen. Der aktive Bereich
// steckt im ?bereich=-Query-Param (Seite bleibt Server-Component).
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

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

  // Die „E-Mail bestätigen"-Karte stand hier OHNE Bedingung: sie behauptete
  // jedem Nutzer gegenüber, seine Adresse sei unbestätigt — auch wenn sie
  // es längst war —, und ihr Knopf hatte keinen Handler. Beides lässt sich
  // derzeit nicht ehrlich bauen: `/auth/me` liefert keinen Bestätigungs-
  // status, und einen Endpunkt zum erneuten Versand gibt es nur für
  // Einladungen (/invite/USER-ID/resend), nicht für die eigene Adresse.
  // Eine falsche Aussage plus toter Knopf ist schlechter als nichts —
  // zurück kommt die Karte, sobald Status und Endpunkt stehen.
  return (
    <div className="space-y-5">


      <nav className="space-y-1">
        {OBEN.map(Eintrag)}
        <div className="my-3 border-t border-border" />
        {UNTEN.map(Eintrag)}
      </nav>
    </div>
  );
}
