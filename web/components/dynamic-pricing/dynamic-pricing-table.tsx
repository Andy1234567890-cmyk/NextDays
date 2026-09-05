"use client";

// Dynamic-Pricing-Objekt-Tabelle (Hostaway-Modell). Je Objekt: Basispreis +
// Modus-Label, Min/Max, Aktiv-Toggle (sofortiges Speichern), Bearbeiten (öffnet
// den Basispreis-Slider) und 30-Tage-Vorschau. Live-Aktualisierung über die
// dp_settings-/rate_plans-Tabellen.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { RealtimeRefresh } from "@/components/realtime-refresh";
import { Card } from "@nextdays/ui/card";
import { Switch } from "@nextdays/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@nextdays/ui/tooltip";
import { formatCurrency } from "@/lib/currency";
import {
  type BaseMode,
  type BaseRateMode,
  type DpOverviewItem,
  saveDpSettings,
} from "@/lib/dynamic-pricing";

import { DpEditSheet } from "./dp-edit-sheet";

const BASE_MODE_LABEL: Record<BaseMode, string> = {
  data_driven: "Grundpreis",
  market: "Marktpreis",
  manual: "Manuell",
};

// Sende-Status je Objekt (Hostaway: SUBSCRIBED – PRICES SYNCED / NOT SYNCED).
function sendeStatus(it: DpOverviewItem): { label: string; cls: string } {
  if (!it.enabled) {
    return { label: "Automatik aus", cls: "bg-muted text-muted-foreground" };
  }
  if (it.freigabe_noetig && it.offene_tage > 0) {
    return {
      label: `${it.offene_tage} warten auf Freigabe`,
      cls: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    };
  }
  return {
    label: "Preise gesendet",
    cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  };
}
const RATE_MODE_LABEL: Record<BaseRateMode, string> = {
  conservative: "Konservativ",
  recommended: "Empfohlen",
  aggressive: "Aggressiv",
};

// Objekt-Status-Badge (Aktiv/Entwurf/Inaktiv).
const STATUS_BADGE: Record<
  DpOverviewItem["status"],
  { label: string; cls: string }
> = {
  active: { label: "Aktiv", cls: "bg-green-100 text-green-800" },
  draft: { label: "Entwurf", cls: "bg-amber-100 text-amber-800" },
  inactive: { label: "Inaktiv", cls: "bg-muted text-muted-foreground" },
};

// Verteilkanal-Code → Marken-Logo (Original-Logos, white-label-konform) + Label.
// Codes: eigene Plattform + Channex-OTA-Portal-Codes (BookingCom/AirBNB/VRBO/…).
const CHANNEL_LOGO: Record<string, { label: string; icon: string }> = {
  platform: { label: "myBestDays", icon: "ph:house-line-fill" },
  BookingCom: { label: "Booking.com", icon: "simple-icons:bookingdotcom" },
  AirBNB: { label: "Airbnb", icon: "simple-icons:airbnb" },
  Expedia: { label: "Expedia", icon: "simple-icons:expedia" },
  // Vrbo: simple-icons fuehrt die Marke nicht. Das ECHTE Logo liegt als
  // /channels/vrbo.svg und steht in `lib/channel-logos.ts` — diese Tabelle
  // rendert aber ueber <Icon> und kann nur Iconify-Namen. Bis die Zelle auf
  // die zentrale Logo-Quelle umgestellt ist, steht hier ein neutrales
  // Zeichen statt eines nachgezeichneten Markenlogos (Projektregel: Logos
  // nur echt, sonst keins).
  VRBO: { label: "Vrbo", icon: "ph:house-line" },
  OpenChannel: { label: "Testkanal", icon: "ph:plug-fill" },
};

function channelLogo(code: string): { label: string; icon: string } {
  return CHANNEL_LOGO[code] ?? { label: code, icon: "ph:globe-hemisphere-west-fill" };
}

// Spalten-Header mit optionalem „?"-Erklär-Tooltip.
function Th({
  children,
  hint,
  className,
}: {
  children: React.ReactNode;
  hint?: string;
  className?: string;
}) {
  const t = useTranslations("dynamicPricing");
  return (
    <th className={`px-4 py-3 font-medium ${className ?? ""}`}>
      {hint ? (
        <span className="inline-flex items-center gap-1.5">
          {children}
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={t("tableExplanation")}
                  className="text-muted-foreground/70 transition-colors hover:text-foreground"
                >
                  <Icon icon="ph:question" className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs leading-relaxed normal-case tracking-normal">
                {hint}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </span>
      ) : (
        children
      )}
    </th>
  );
}

function fmtMoney(value: number | null, currency: string | null): string {
  if (value === null) return "—";
  return formatCurrency(value, currency ?? undefined);
}

export function DynamicPricingTable({ items }: { items: DpOverviewItem[] }) {
  const t = useTranslations("dynamicPricing");
  const router = useRouter();
  const [editing, setEditing] = useState<DpOverviewItem | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function toggleActive(item: DpOverviewItem, next: boolean) {
    setBusyId(item.property_id);
    await saveDpSettings(item.property_id, { enabled: next });
    setBusyId(null);
    router.refresh();
  }

  if (items.length === 0) {
    return (
      <Card className="p-6 text-sm text-muted-foreground">
        Noch keine Objekte. Lege zuerst ein Objekt mit Grundpreis an.
      </Card>
    );
  }

  return (
    <>
      <RealtimeRefresh tables={["dp_settings", "rate_plans"]} />
      <div className="w-full overflow-x-auto">
        <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <Th className="whitespace-nowrap">Objekt-ID</Th>
                <Th className="w-full">Objekt</Th>
                <Th
                  className="whitespace-nowrap"
                  hint="Automatik aus: der Grundpreis gilt. Preise gesendet: die berechneten Preise sind an den Portalen. Warten auf Freigabe: berechnet, aber noch nicht gesendet — im Kalender freigeben."
                >
                  Status
                </Th>
                <Th
                  className="whitespace-nowrap"
                  hint="Der aktuelle Basispreis (Anker) dieses Objekts und der gewählte Modus darunter (Grundpreis oder Marktpreis mit Konservativ/Empfohlen/Aggressiv, oder Manuell). Auf diesen Preis rechnen alle Regeln."
                >
                  Basispreis
                </Th>
                <Th hint="Mindestpreis: Unter diesen Wert geht die Engine nie. „—“ = kein Limit gesetzt.">
                  Min
                </Th>
                <Th hint="Höchstpreis: Über diesen Wert geht die Engine nie. „—“ = kein Limit gesetzt.">
                  Max
                </Th>
                <Th className="text-center">Bearbeiten</Th>
                <Th
                  className="text-center"
                  hint="Schaltet Dynamic Pricing für dieses Objekt an/aus. Aus = der feste Grundpreis gilt. Wird sofort gespeichert."
                >
                  Aktiv
                </Th>
                <Th
                  className="text-center"
                  hint="Öffnet die 30-Tage-Vorschau: die von der Engine empfohlenen Tagespreise dieses Objekts."
                >
                  Vorschau
                </Th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.property_id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted-foreground">
                    {it.property_id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-(--radius) bg-secondary">
                        {it.photo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={it.photo} alt="" className="size-full object-cover" />
                        ) : (
                          <Icon icon="ph:house-line" className="size-4 text-muted-foreground" />
                        )}
                      </span>
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="font-medium">{it.title}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[it.status].cls}`}
                        >
                          {STATUS_BADGE[it.status].label}
                        </span>
                        {/* Verteilkanäle mit Original-Logos — hinter dem Badge. */}
                        {it.channels.length > 0 ? (
                          <span className="flex items-center gap-1.5">
                            {it.channels.map((code) => {
                              const ch = channelLogo(code);
                              return (
                                <span
                                  key={code}
                                  title={ch.label}
                                  className="flex size-5 items-center justify-center rounded-full bg-muted"
                                >
                                  <Icon icon={ch.icon} className="size-3.5" />
                                </span>
                              );
                            })}
                          </span>
                        ) : (
                          <TooltipProvider delayDuration={150}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="cursor-help text-xs text-muted-foreground underline decoration-dotted underline-offset-2">
                                  Nicht verteilt
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs text-xs leading-relaxed">
                                Dieses Objekt ist auf keinem Kanal aktiv. Aktiviere
                                es auf deiner Plattform oder verbinde es im Channel
                                Manager mit OTAs (Booking.com, Airbnb …), damit
                                Preise dorthin verteilt werden.
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {(() => {
                      const st = sendeStatus(it);
                      return (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}>
                          {st.label}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="leading-tight">
                      <span>{fmtMoney(it.base_rate, it.currency)}</span>
                      <span className="block text-xs text-muted-foreground">
                        {it.base_mode === "manual"
                          ? BASE_MODE_LABEL.manual
                          : `${BASE_MODE_LABEL[it.base_mode]} · ${RATE_MODE_LABEL[it.base_rate_mode]}`}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {it.saison_mindestpreis ? (
                      // Regel an: der Mindestpreis kommt aus dem Saisonkalender.
                      <span className="whitespace-nowrap">
                        {it.saison_preis_von == null || it.saison_preis_bis == null
                          ? "—"
                          : it.saison_preis_von === it.saison_preis_bis
                            ? fmtMoney(it.saison_preis_von, it.currency)
                            : `${fmtMoney(it.saison_preis_von, it.currency)} – ${fmtMoney(it.saison_preis_bis, it.currency)}`}
                      </span>
                    ) : (
                      fmtMoney(it.min_price, it.currency)
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {fmtMoney(it.max_price, it.currency)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center">
                      <button
                        type="button"
                        onClick={() => setEditing(it)}
                        aria-label="Bearbeiten"
                        className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                      >
                        <Icon icon="ph:pencil-simple" className="size-4" />
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center">
                      <Switch
                        checked={it.enabled}
                        disabled={busyId === it.property_id}
                        onCheckedChange={(c) => toggleActive(it, c)}
                        aria-label={t("active")}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center">
                      <Link
                        href={`/dynamic-pricing/${it.property_id}`}
                        className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm text-accent hover:bg-accent/10"
                      >
                        <Icon icon="ph:eye" className="size-4" />
                        Vorschau
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
      </div>

      {editing && (
        <DpEditSheet
          item={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
