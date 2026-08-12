"use client";

// Sub-Navigation des Eigentümer-Reportings — zwei Gruppen, wie es der
// Branchenstand führt (Lodgify „Reporting für Eigentümer"):
//
//   BERICHTE     Berichte · Zahlungen · Statistiken      — das Tagesgeschäft
//   EINRICHTEN   Empfänger · Geplante Berichte · Konditionen — die Konfiguration
//
// Die Trennung ist keine Kosmetik: „Einrichten" wird einmal gemacht und danach
// selten angefasst. Läge alles in einer Liste, stünde die Konfiguration
// gleichwertig neben der täglichen Arbeit und würde dauernd versehentlich
// geöffnet.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

const BASIS = "/eigentuemer/reporting";

const GRUPPEN = [
  {
    key: "reports",
    items: [
      { key: "reports", href: BASIS },
      { key: "payments", href: `${BASIS}/zahlungen` },
      { key: "statistics", href: `${BASIS}/statistiken` },
    ],
  },
  {
    key: "setup",
    items: [
      { key: "recipients", href: `${BASIS}/empfaenger` },
      { key: "schedules", href: `${BASIS}/geplant` },
      { key: "settings", href: `${BASIS}/einstellungen` },
    ],
  },
] as const;

export function ReportingNav() {
  const t = useTranslations("ownerReporting.nav");
  const pathname = usePathname();

  return (
    <nav className="flex w-full shrink-0 flex-col gap-6 lg:w-56">
      {GRUPPEN.map((gruppe) => (
        <div key={gruppe.key} className="flex flex-col gap-1">
          <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t(`groups.${gruppe.key}`)}
          </p>
          {gruppe.items.map((item) => {
            // Die Berichte-Übersicht liegt auf dem Basispfad; ohne die exakte
            // Prüfung wäre sie auf JEDER Unterseite aktiv markiert.
            const aktiv =
              item.href === BASIS
                ? pathname === BASIS || pathname.startsWith(`${BASIS}/berichte`)
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={aktiv ? "page" : undefined}
                className={`rounded-(--radius) px-3 py-2 text-sm transition-colors ${
                  aktiv
                    ? "bg-secondary font-semibold text-foreground"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                }`}
              >
                {t(`items.${item.key}`)}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
