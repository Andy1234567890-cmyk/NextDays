"use client";

// Seitennavigation des Backoffice. Die Rolle steuert nur die SICHTBARKEIT —
// die Autorisierung erzwingt immer der Server (require_platform_write).
// Ein ausgeblendeter Punkt ist kein Schutz, sondern Bequemlichkeit.
import { Icon } from "@iconify/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { abmelden } from "@/lib/auth";

type Punkt = {
  href: string;
  label: string;
  icon: string;
  /** true = nur für platform_admin (schreibende Bereiche). */
  nurAdmin?: boolean;
};

const PUNKTE: Punkt[] = [
  { href: "/", label: "Übersicht", icon: "ph:squares-four" },
  { href: "/betriebe", label: "Betriebe", icon: "ph:buildings" },
  { href: "/registrierungen", label: "Registrierungen", icon: "ph:user-plus" },
  { href: "/buchungen", label: "Buchungen", icon: "ph:calendar-check" },
  { href: "/freigaben", label: "Freigaben", icon: "ph:check-square", nurAdmin: true },
  { href: "/finanzen", label: "Stripe & Finanzen", icon: "ph:currency-eur" },
  { href: "/steuern", label: "Steuern", icon: "ph:scales" },
  { href: "/support", label: "Support", icon: "ph:lifebuoy" },
  // nurAdmin: eine Ankündigung geht an ALLE Betriebe und kann als Popup jedes
  // Kunden-Dashboard unterbrechen. platform_support darf so etwas nicht
  // auslösen — der Server erzwingt es zusätzlich (require_platform_write).
  {
    href: "/ankuendigungen",
    label: "Ankündigungen",
    icon: "ph:megaphone",
    nurAdmin: true,
  },
  { href: "/diagnose", label: "Diagnose", icon: "ph:activity" },
  { href: "/deploy", label: "Deploy-Monitor", icon: "ph:rocket-launch" },
  // Neben dem Deploy-Monitor, weil beide dieselbe Frage beantworten: läuft der
  // Hintergrund noch? Der eine für Ausrollen, der andere für die Jobs.
  { href: "/worker", label: "Worker-Monitor", icon: "ph:gear-six" },
  { href: "/protokoll", label: "Protokoll", icon: "ph:list-checks" },
  // Sichtbar für alle im Backoffice — wer Zugriff hat, soll nachsehen können,
  // wer sonst noch Zugriff hat. Ändern darf trotzdem nur platform_admin.
  { href: "/team", label: "Team", icon: "ph:users-three" },
];

export function BackofficeNav({
  email,
  rolle,
}: {
  email: string | null;
  rolle: "platform_admin" | "platform_support";
}) {
  const pathname = usePathname();
  const istAdmin = rolle === "platform_admin";

  return (
    <nav className="flex h-screen w-64 shrink-0 flex-col border-r border-border">
      <div className="px-6 pt-7">
        <p className="font-sans text-lg font-bold tracking-tight">
          myNextDays
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">Backoffice</p>
      </div>

      <div className="mt-8 min-h-0 flex-1 space-y-1 overflow-y-auto px-3">
        {PUNKTE.filter((p) => istAdmin || !p.nurAdmin).map((p) => {
          const aktiv =
            p.href === "/" ? pathname === "/" : pathname.startsWith(p.href);
          return (
            <Link
              key={p.href}
              href={p.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                aktiv
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              <Icon icon={p.icon} className="size-5 shrink-0" />
              {p.label}
            </Link>
          );
        })}
      </div>

      <div className="shrink-0 border-t border-border px-6 py-5">
        <p className="truncate text-sm font-medium">{email ?? "—"}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {istAdmin ? "Volle Rechte" : "Nur Lesen + Support"}
        </p>
        <button
          type="button"
          onClick={() => void abmelden()}
          className="mt-3 text-sm font-semibold underline-offset-4 hover:underline"
        >
          Abmelden
        </button>
      </div>
    </nav>
  );
}
