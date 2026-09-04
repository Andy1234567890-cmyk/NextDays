// Dynamic Pricing → Jahres-Vorschau eines Objekts: read-only-Monatsraster mit
// dem geltenden Tagespreis (Resolver: dynamisch bei aktivem DP > Override >
// Wochentag > Basis). Manuelle Tagespreise setzt man im normalen Kalender.
// Server Component lädt die Verfügbarkeit des Vorschau-Horizonts.
import Link from "next/link";
import { notFound } from "next/navigation";

import { DpFreigabeLeiste } from "@/components/dynamic-pricing/dp-freigabe-leiste";
import { DpPreviewGrid } from "@/components/dynamic-pricing/dp-preview-grid";
import { KiBeraterKarte } from "@/components/dynamic-pricing/ki-berater-karte";
import { ModulVerkaufsseite } from "@/components/erweiterungen/modul-verkaufsseite";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { Card } from "@nextdays/ui/card";
import { getAvailability, getBoard } from "@/lib/calendar";
import { getDpOverview } from "@/lib/dynamic-pricing";
import { erweiterungFuerModul } from "@/lib/erweiterungen";
import { getProperty } from "@/lib/properties";

export const dynamic = "force-dynamic";

// Wie viele Monate die Vorschau vorhält. Der Autopilot rechnet 540 Tage voraus
// (recompute.DEFAULT_HORIZON_DAYS); 18 Monate decken das ab und erlauben den
// Sprung auf denselben Monat im Folgejahr ("nächstes Jahr Juni").
const VORSCHAU_MONATE = 18;

/** Monatserster als ISO-Datum, `offset` Monate von diesem Monat aus. */
function isoMonatsErster(offsetMonate: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  // Tag ZUERST auf 1 setzen: sonst rutscht der 31. beim Monatssprung in den
  // Folgemonat (31.03. + 1 Monat = 01.05. statt 01.04.).
  d.setDate(1);
  d.setMonth(d.getMonth() + offsetMonate);
  // Lokale Zeitzone, nicht toISOString() — das rechnet nach UTC um und
  // liefert östlich von Greenwich den Vormonats-Letzten.
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${m}-01`;
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Ab dem MONATSERSTEN laden, nicht ab heute: das Raster zeigt ganze Monate,
  // sonst fehlten im laufenden Monat die bereits vergangenen Tage.
  const start = isoMonatsErster(0);
  const end = isoMonatsErster(VORSCHAU_MONATE); // exklusiv
  const [prop, avail, board, overview] = await Promise.all([
    getProperty(id),
    getAvailability(id, start, end),
    // Objekt-Währung (aus dem Rate-Plan) für die Preisanzeige — kein €-Hardcode.
    getBoard([id], start, end),
    // Modul-Status: die Vorschau ist Teil des kostenpflichtigen Moduls. Ein
    // Direktaufruf dieser URL darf es nicht umgehen (gleicher Scope wie die
    // Liste, Wurzel 9) — ohne Buchung stünde hier ohnehin ein leeres Raster.
    getDpOverview(),
  ]);
  const modul = erweiterungFuerModul("dynamische_preise");
  if (overview.ok && !overview.data.module_active && modul) {
    return (
      <div className="flex w-full flex-col p-6">
        <ModulVerkaufsseite eintrag={modul} />
      </div>
    );
  }
  const currency =
    (board.ok ? board.data.items[0]?.currency : null) ?? null;
  // Zustand dieses Objekts aus der ohnehin geladenen Übersicht.
  const dpStand = overview.ok
    ? overview.data.items.find((x) => x.property_id === id)
    : undefined;
  if (!prop.ok) {
    // Nicht gefunden ODER keine Berechtigung (manage_calendar) → für diesen
    // Nutzer existiert die Vertriebs-Vorschau nicht (Wurzel 3), kein 403-Kasten.
    if (prop.status === 403 || prop.error.includes("nicht gefunden")) notFound();
    return (
      <div className="mx-auto w-full max-w-5xl p-6">
        <Card className="p-5 text-sm text-destructive">
          Objekt konnte nicht geladen werden: {prop.error}
        </Card>
      </div>
    );
  }
  return (
    <div className="flex w-full flex-col gap-6 p-6">
      {/* Realtime-Pflicht: ALLE preis-speisenden Tabellen der Resolver-Kette live —
          ein manueller Tagespreis (price_overrides, greift wenn DP aus ist), ein geänderter
          Basispreis (rate_plans) oder Wochentagspreis (property_pricing_config)
          erscheint sofort, ohne dass die Seite manuell neu geladen werden muss. */}
      <RealtimeRefresh
        tables={[
          "price_overrides",
          "dynamic_prices",
          "property_pricing_config",
          "rate_plans",
          "availability",
          "dp_settings",
        ]}
      />
      <header className="flex flex-col gap-1">
        <Link
          href="/dynamic-pricing"
          className="text-sm text-accent hover:underline"
        >
          ← Dynamic Pricing
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl font-extrabold">
            {prop.data.title}
          </h1>
          {/* Zustand auf einen Blick: rechnet die Automatik hier überhaupt,
              und ist alles gesendet? Aus der bereits geladenen Übersicht —
              keine zweite Abfrage. */}
          {dpStand && (
            <span
              className={
                dpStand.enabled
                  ? "rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                  : "rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground"
              }
            >
              {dpStand.enabled ? "Automatik an" : "Automatik aus"}
            </span>
          )}
          {dpStand?.freigabe_noetig && dpStand.offene_tage > 0 && (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              {dpStand.offene_tage} Tage nicht gesendet
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Berechnete Tagespreise, Monat für Monat. Solange Dynamic Pricing an
          ist, gelten sie überall — auch vor einem im Kalender gesetzten
          Tagespreis. Schaltest du ab, greift dieser sofort wieder.
        </p>
      </header>
      {/* Regel-Berater ÜBER dem Kalender: er ändert die Regeln, deren Wirkung
          man darunter sofort sieht. */}
      <DpFreigabeLeiste propertyId={id} />
      <KiBeraterKarte propertyId={id} currency={currency} />
      {avail.ok ? (
        <DpPreviewGrid days={avail.data} propertyId={id} currency={currency} />
      ) : (
        <Card className="p-5 text-sm text-destructive">
          Preise konnten nicht geladen werden: {avail.error}
        </Card>
      )}
    </div>
  );
}
