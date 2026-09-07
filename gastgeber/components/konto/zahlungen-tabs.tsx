"use client";

// Reiter-Leiste des Zahlungsbereichs (Airbnb-Vorbild: Zahlungen · Auszahlungen ·
// Spenden, dazu „Kontostand" — Saldo und jede Buchung mit ihrem Auszahlungs-
// stand, damit der Gastgeber nachvollziehen kann, wo sein Geld steht). Der
// aktive Reiter steckt im ?tab=-Query-Param, damit die Seite eine
// Server-Component bleiben kann — wie ?bereich= in der linken Navigation.
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export type ZahlungenTab = "zahlungen" | "kontostand" | "auszahlungen" | "spenden";

const TABS: { key: ZahlungenTab; label: string }[] = [
  { key: "zahlungen", label: "tabZahlungen" },
  { key: "kontostand", label: "tabKontostand" },
  { key: "auszahlungen", label: "tabAuszahlungen" },
  { key: "spenden", label: "tabSpenden" },
];

export function ZahlungenTabs() {
  const t = useTranslations("konto");
  const params = useSearchParams();
  const aktiv = (params.get("tab") as ZahlungenTab) ?? "zahlungen";

  return (
    <nav
      aria-label={t("zahlungenTitel")}
      className="mb-8 flex gap-8 border-b border-border"
    >
      {TABS.map((tab) => {
        const active = aktiv === tab.key;
        return (
          <Link
            key={tab.key}
            href={`/konto?bereich=zahlungen&tab=${tab.key}`}
            aria-current={active ? "page" : undefined}
            className={`-mb-px border-b-2 pb-4 text-[0.9375rem] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 ${
              active
                ? "border-foreground font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t(tab.label)}
          </Link>
        );
      })}
    </nav>
  );
}
