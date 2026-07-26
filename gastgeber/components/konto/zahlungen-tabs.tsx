"use client";

// Reiter-Leiste des Zahlungsbereichs (Airbnb-Vorbild: Zahlungen · Auszahlungen ·
// Spenden). Der aktive Reiter steckt im ?tab=-Query-Param, damit die Seite eine
// Server-Component bleiben kann — wie ?bereich= in der linken Navigation.
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export type ZahlungenTab = "zahlungen" | "auszahlungen" | "spenden";

const TABS: { key: ZahlungenTab; label: string }[] = [
  { key: "zahlungen", label: "Zahlungen" },
  { key: "auszahlungen", label: "Auszahlungen" },
  { key: "spenden", label: "Spenden" },
];

export function ZahlungenTabs() {
  const params = useSearchParams();
  const aktiv = (params.get("tab") as ZahlungenTab) ?? "zahlungen";

  return (
    <nav
      aria-label="Zahlungsbereiche"
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
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
