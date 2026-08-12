"use client";

// Detailfläche des EIGENEN Marktplatzes (myBestDays) — /channels/mybestdays.
// Gleiche Fläche wie eine OTA-Kanalseite (Kopf + Objekttabelle), aber ohne
// Channex: über die Sichtbarkeit auf myBestDays entscheiden DREI Achsen und
// keine Zuordnung —
//   1. Objekt-Lebenszyklus  `properties.status = 'active'`
//   2. Kanal-Schalter       `properties.listed_on_marketplace` (0159)
//   3. Freigabe des Betreibers `moderation_status = 'approved'` (0203)
// Genau diese drei fragt der öffentliche Marktplatz ab
// (`booking_engine.list_listings`); die Tabelle zeigt sie deshalb einzeln, statt
// sie zu einem grünen Punkt zusammenzufassen.
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";
import { Switch } from "@nextdays/ui/switch";
import type { MarketplaceDetail, MarketplacePropertyRow } from "@/lib/channex";
import { updateProperty } from "@/lib/properties";

// Zwei Dateien wie auf der Kanal-Karte: das dunkle Logo auf hellem Grund, die
// helle Variante im Dark-Mode (sonst verschwindet die Wortmarke).
const LOGO = "/marketing/brand/mybestdays-logo.png";
const LOGO_DARK = "/marketing/brand/mybestdays-logo-light.png";

// Farbe je Zustand wie überall im Kanalmanager: grün = verkauft wirklich,
// amber = wartet (kein Fehler), neutral = aus (Wille des Betriebs).
const STATE_DOT: Record<MarketplacePropertyRow["state"], string> = {
  active: "bg-emerald-500",
  pending: "bg-amber-500",
  paused: "bg-muted-foreground/40",
};

function ZustandsPunkt({ state }: { state: MarketplacePropertyRow["state"] }) {
  return <span className={`size-2 rounded-full ${STATE_DOT[state]}`} aria-hidden />;
}

function Zeile({
  row,
  onGeaendert,
}: {
  row: MarketplacePropertyRow;
  onGeaendert: () => void;
}) {
  const t = useTranslations("channels");
  const [busy, setBusy] = useState(false);
  const aktiv = row.status === "active";

  async function schalten(next: boolean) {
    setBusy(true);
    const res = await updateProperty(row.property_id, {
      listed_on_marketplace: next,
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    onGeaendert();
  }

  // Der Zustand wird BENANNT: „nicht sichtbar" hat drei verschiedene Gründe,
  // und nur einer davon liegt beim Betrieb.
  const zustandLabel =
    row.state === "active"
      ? t("marketplace.stateActive")
      : row.state === "pending"
        ? t("marketplace.statePending")
        : aktiv
          ? t("marketplace.stateNotListed")
          : t("marketplace.stateInactiveProperty");

  const freigabe = row.moderation_status
    ? t(`marketplace.moderation.${row.moderation_status}` as never)
    : "—";

  return (
    <tr className="border-b border-border last:border-0">
      <td className="p-3">
        <Link
          href={`/objekte/${row.property_id}`}
          className="flex items-center gap-3 hover:underline"
        >
          {row.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={row.photo}
              alt=""
              className="size-10 shrink-0 rounded-(--radius) object-cover"
            />
          ) : (
            <span className="flex size-10 shrink-0 items-center justify-center rounded-(--radius) bg-muted">
              <Icon icon="ph:house" className="size-5 text-muted-foreground" />
            </span>
          )}
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{row.title}</span>
            {(row.city || row.country) && (
              <span className="truncate text-xs text-muted-foreground">
                {[row.city, row.country].filter(Boolean).join(", ")}
              </span>
            )}
          </span>
        </Link>
      </td>
      <td className="p-3">
        <div className="flex items-center gap-2">
          <Switch
            checked={row.listed}
            disabled={busy}
            onCheckedChange={(c) => void schalten(c)}
            aria-label={t("marketplace.columnVisibility")}
          />
          <ZustandsPunkt state={row.state} />
          <span
            className={
              "text-xs " +
              (row.state === "pending"
                ? "text-amber-600"
                : "text-muted-foreground")
            }
          >
            {zustandLabel}
          </span>
        </div>
      </td>
      <td className="p-3 text-sm text-muted-foreground">{freigabe}</td>
      <td className="p-3 text-sm">{row.bookings_count}</td>
      <td className="p-3 text-right">
        {/* Link NUR auf eine Seite, die es wirklich gibt: ohne Freigabe (oder
            ohne konfigurierte Marktplatz-Adresse) liefert das Backend keine URL
            — dann steht hier nichts, statt in einen 404 zu führen. */}
        {row.listing_url ? (
          <a
            href={row.listing_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
          >
            {t("marketplace.viewListing")}
            <Icon icon="ph:arrow-square-out" className="size-4" />
          </a>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </td>
    </tr>
  );
}

export function MarketplaceDetailView({ detail }: { detail: MarketplaceDetail }) {
  const t = useTranslations("channels");
  const router = useRouter();
  const [suche, setSuche] = useState("");

  const aus = detail.items.filter((i) => i.state === "paused").length;
  const needle = suche.trim().toLowerCase();
  const sichtbar = needle
    ? detail.items.filter((i) =>
        [i.title, i.city, i.country, i.property_id]
          .filter(Boolean)
          .some((v) => (v as string).toLowerCase().includes(needle)),
      )
    : detail.items;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-start sm:justify-between">
        <span className="flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={LOGO}
            alt={detail.label}
            className="h-[2.5rem] w-auto max-w-[14rem] object-contain dark:hidden"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={LOGO_DARK}
            alt={detail.label}
            className="hidden h-[2.5rem] w-auto max-w-[14rem] object-contain dark:block"
          />
        </span>
        {/* Marktplatz öffnen — nur wenn die Adresse konfiguriert ist. */}
        {detail.marketplace_url && (
          <Button asChild variant="outline" className="shrink-0">
            <a href={detail.marketplace_url} target="_blank" rel="noreferrer">
              <Icon icon="ph:arrow-square-out" className="size-4" />
              {t("marketplace.openMarketplace")}
            </a>
          </Button>
        )}
      </header>

      <p className="text-sm text-muted-foreground">{t("marketplace.intro")}</p>

      {/* Zähler getrennt: „gelistet" ist nicht „sichtbar". */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <span className="flex items-center gap-2">
          <ZustandsPunkt state="active" />
          {t("marketplace.summaryVisible", { count: detail.listed_count })}
        </span>
        <span className="flex items-center gap-2">
          <ZustandsPunkt state="pending" />
          {t("marketplace.summaryWaiting", { count: detail.pending_count })}
        </span>
        <span className="flex items-center gap-2">
          <ZustandsPunkt state="paused" />
          {t("marketplace.summaryOff", { count: aus })}
        </span>
      </div>

      {detail.pending_count > 0 && (
        <div className="flex items-start gap-2 rounded-(--radius) border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
          <Icon icon="ph:hourglass-medium" className="mt-0.5 size-4 shrink-0" />
          <span>{t("marketplace.reviewHint")}</span>
        </div>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">
          {t("marketplace.propertiesHeading")}
        </h2>
        {detail.items.length === 0 ? (
          <p className="rounded-(--radius) border border-border p-4 text-sm text-muted-foreground">
            {t("marketplace.noProperties")}
          </p>
        ) : (
          <>
            <Input
              value={suche}
              onChange={(e) => setSuche(e.target.value)}
              placeholder={t("searchProperty")}
              aria-label={t("searchProperty")}
            />
            <div className="overflow-x-auto rounded-(--radius) border border-border">
              <table className="w-full min-w-[44rem] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="p-3 font-medium">
                      {t("marketplace.columnProperty")}
                    </th>
                    <th className="p-3 font-medium">
                      {t("marketplace.columnVisibility")}
                    </th>
                    <th className="p-3 font-medium">
                      {t("marketplace.columnApproval")}
                    </th>
                    <th className="p-3 font-medium">
                      {t("marketplace.columnBookings")}
                    </th>
                    <th className="p-3 font-medium text-right">
                      {t("actionColumn")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sichtbar.map((row) => (
                    <Zeile
                      key={row.property_id}
                      row={row}
                      onGeaendert={() => router.refresh()}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
