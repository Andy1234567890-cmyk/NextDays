// Dashboard-Startseite (Server Component). KPIs aus /reservations/stats +
// Schnellzugriff. Auth-Guard sitzt im Group-Layout. Werte fehlend → "—"
// (nie 0/Fantasiewert, Wurzel 4); Währung aus den Daten (kein €-Hardcode).
import { formatCurrency } from "@nextdays/currency";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { Card } from "@nextdays/ui/card";

import { getMe } from "@/lib/me";
import { getProperties } from "@/lib/properties";
import { getTenantStats, type Kpi } from "@/lib/stats";

const DASH = "—";

function kpiText(kpi: Kpi | null | undefined): string {
  if (!kpi || kpi.value === null || kpi.value === undefined) return DASH;
  return String(Math.round(kpi.value));
}

export default async function DashboardPage() {
  const t = await getTranslations("dashboard");
  const me = await getMe();
  // Objekte + Stats parallel; Stats dürfen fehlen (neues Konto ohne Buchungen).
  const [properties, stats] = await Promise.all([
    getProperties().catch(() => []),
    getTenantStats().catch(() => null),
  ]);

  const currency = stats?.currency || properties[0]?.currency || "";
  const revenue =
    stats?.revenue && stats.revenue.value != null && currency
      ? formatCurrency(stats.revenue.value, currency)
      : DASH;

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-8">
        <p className="text-sm text-muted-foreground">{t("begruessung")}</p>
        <h1 className="font-display text-2xl font-semibold">
          {me?.email ?? "myNextDays"}
        </h1>
      </header>

      {properties.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="mb-4 text-sm text-muted-foreground">
            {t("keineObjekte")}
          </p>
          <Link
            href="/objekte/neu"
            className="inline-flex rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background"
          >
            {t("objektAnlegen")}
          </Link>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label={t("kpiUmsatz")} value={revenue} />
          <Kpi label={t("kpiBuchungen")} value={kpiText(stats?.created_reservations)} />
          <Kpi
            label={t("kpiAuslastung")}
            value={
              stats?.occupancy_rate?.value != null
                ? `${Math.round(stats.occupancy_rate.value)} %`
                : DASH
            }
          />
          <Kpi label={t("kpiBewertung")} value={DASH} />
        </div>
      )}
    </main>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </Card>
  );
}
