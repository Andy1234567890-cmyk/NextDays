"use client";

// Kopf des CRM-Bereichs: Titel + Umschalter zwischen den zwei Flächen
// (Leads = Eigentümer-Akquise, Partner = B2B-Deals). Die Reiter sind PFADE,
// keine Query-Parameter — die Sidebar hebt so den richtigen Punkt hervor.
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useTranslations } from "next-intl";

export function CrmNav({ aktiv }: { aktiv: "leads" | "partner" }) {
  const t = useTranslations("crm");
  const reiter = [
    { key: "leads" as const, href: "/crm/leads", icon: "ph:funnel", label: t("leads.title") },
    { key: "partner" as const, href: "/crm/partner", icon: "ph:handshake", label: t("partner.title") },
  ];
  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{t("allgemein.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("allgemein.subtitle")}</p>
      </div>
      <nav className="inline-flex rounded-full border bg-secondary p-0.5 text-sm">
        {reiter.map((r) => (
          <Link
            key={r.key}
            href={r.href}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium transition-colors ${
              aktiv === r.key
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon icon={r.icon} className="size-4" />
            {r.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
