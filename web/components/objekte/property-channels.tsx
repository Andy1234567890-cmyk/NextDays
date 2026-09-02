"use client";

// Kanäle-Tab EINES Objekts (Lodgify: Kanäle global UND pro Objekt).
// Drei gleichrangige Gruppen, je Zeile ein Kanal:
//   Website (eigene Kundenseite)  · listed_on_website
//   Plattform (myBestDays-Markt)  · listed_on_marketplace
//   Portale (Channex → OTAs)      · pro OTA Mapping + Sync-Status
// Zwei getrennte Achsen (OwnerRez): Sichtbarkeit (an/pausiert) vs. Sync (ok/Fehler).
// „Portale" im Kundentext, NIE „Channex". Markup kommt in Phase 2.
import { Icon } from "@iconify/react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { channelLogo } from "@/lib/channel-logos";

import { ChannelConnectButton } from "@/components/channel-manager/channel-connect-button";
import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import { Switch } from "@nextdays/ui/switch";
import {
  type StoredChannelConnection,
  setConnectionActive,
} from "@/lib/channex";
import {
  type Property,
  publishProperty,
  updateProperty,
} from "@/lib/properties";
import { useRealtime } from "@/lib/use-realtime";

// Status-Punkt-Farben (semantische Tokens, keine arbitrary Hex). Pausiert/
// nicht-verbunden neutral (kein Alarm), „wartet" amber, nur Fehler rot.
function StatusDot({
  tone,
}: {
  tone: "active" | "paused" | "error" | "pending" | "off";
}) {
  const cls =
    tone === "active"
      ? "bg-emerald-500"
      : tone === "error"
        ? "bg-destructive"
        : tone === "pending"
          ? "bg-amber-500"
          : "bg-muted-foreground/40";
  return <span className={`size-2 rounded-full ${cls}`} aria-hidden />;
}

// Ein Kanal = eine Zeile: Logo/Icon+Name links, Status/Aktion rechts.
// Lokale Kanäle (Website/Plattform) nutzen ein neutrales Iconify-Icon; OTA-
// Portale bekommen ihr ECHTES Original-Logo (logoCode) oder nur den Namen —
// kein generisches Ersatz-Icon (Nutzer-Vorgabe).
function ChannelRow({
  icon,
  logoCode,
  name,
  children,
}: {
  icon?: string;
  logoCode?: string;
  name: string;
  children: React.ReactNode;
}) {
  const logo = logoCode ? channelLogo(logoCode) : null;
  return (
    <div className="flex items-center justify-between gap-3 rounded-(--radius) border border-border px-4 py-3">
      <span className="flex items-center gap-2.5">
        {logo ? (
          <Image
            src={logo}
            alt=""
            width={20}
            height={20}
            className="size-5 shrink-0 object-contain"
          />
        ) : icon ? (
          <Icon icon={icon} className="size-5 text-muted-foreground" />
        ) : null}
        <span className="font-medium">{name}</span>
      </span>
      <span className="flex items-center gap-3">{children}</span>
    </div>
  );
}

export function PropertyChannels({
  property,
  connections,
  accommodationType,
}: {
  property: Property;
  connections: StoredChannelConnection[];
  // Hotel: Portal wird EINMAL auf Betriebs-Ebene verbunden (eine Booking-Hotel-
  // ID), die Zimmer sind Room-Types darunter → hier kein „Portal verbinden" pro
  // Zimmer, nur Zuordnungs-/Sync-Status. FeWo/Agentur: jedes Objekt hat eine
  // eigene Booking-ID → „Portal verbinden" pro Objekt.
  accommodationType?: "hotel" | "vacation_rental" | null;
}) {
  const t = useTranslations("objects");
  const router = useRouter();
  const [p, setP] = useState<Property>(property);
  const [busy, setBusy] = useState<string | null>(null);

  // Realtime: eigene Objekt-Flags (Kanal-Sichtbarkeit) — properties bleibt für
  // authenticated lesbar und trägt genau dieses Ereignis.
  useRealtime({
    table: "properties",
    filter: `id=eq.${property.id}`,
    onChange: () => router.refresh(),
  });
  // channex_channel_connection ist für authenticated gesperrt (Wurzel 6,
  // Migration 0337) — Portal-Kontoverbindung, Vertriebsdaten nach §4.3.
  // Ersatzlos gestrichen statt still umgehängt: keine offene Tabelle bildet das
  // Verbinden/Trennen eines Portals ab. Das properties-Abo darüber bleibt und
  // deckt die Kanal-Sichtbarkeit des Objekts weiterhin live ab; NICHT abgedeckt
  // ist die Portal-Verbindung selbst — sie erscheint erst beim nächsten
  // Seitenaufruf.

  const isActive = p.status === "active";
  // Eigener Marktplatz: PFLICHTKANAL (0527, Master-Strategie 02.09.2026) — kein
  // Schalter mehr. Sichtbar wird ein Objekt dort, wenn es aktiv ist UND
  // myBestDays es als Anbieter freigegeben hat (0203). Ohne Freigabe stand hier
  // früher ein grüner Punkt, während das Objekt auf dem Marktplatz fehlte
  // (live 11.08.2026, 17 Objekte). `listed_on_marketplace` ist nur während
  // einer Verkaufs-Pause false — dann ist auch `status` nicht active.
  const marktFreigegeben = p.moderation_status === "approved";
  const marktWartet = isActive && p.listed_on_marketplace && !marktFreigegeben;

  // Nur die Website ist noch pro Kanal schaltbar — myBestDays ist Pflichtkanal (0527).
  async function toggleFlag(field: "listed_on_website", next: boolean) {
    setBusy(field);
    const res = await updateProperty(p.id, { [field]: next });
    setBusy(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setP(res.data);
  }

  async function togglePortal(portalCode: string, next: boolean) {
    setBusy(portalCode);
    const res = await setConnectionActive(p.id, portalCode, next);
    setBusy(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    router.refresh();
  }

  async function publishAll() {
    setBusy("__publish");
    const res = await publishProperty(p.id);
    setBusy(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setP(res.data);
    toast.success(t("channelsTab.publishedAll"));
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold">
            {t("channelsTab.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("channelsTab.subtitle")}
          </p>
        </div>
        {/* Komfort-Default „überall veröffentlichen" — jede Zeile bleibt
            einzeln übersteuerbar (belegtes Muster: 1 Klick, aber pro Kanal). */}
        <Button
          onClick={publishAll}
          disabled={busy !== null || !isActive}
          className="shrink-0"
        >
          <Icon icon="ph:rocket-launch" className="mr-1.5 size-4" />
          {t("channelsTab.publishAll")}
        </Button>
      </div>

      {!isActive && (
        <Card className="flex items-center gap-2 bg-muted/40 p-3 text-sm text-muted-foreground">
          <Icon icon="ph:info" className="size-4 shrink-0" />
          {t("channelsTab.draftHint")}
        </Card>
      )}

      {/* Gruppe 1 — Website */}
      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("channelsTab.groupWebsite")}
        </h2>
        <ChannelRow icon="ph:globe-simple" name={t("channelChips.website")}>
          <StatusDot
            tone={
              isActive && p.listed_on_website ? "active" : "paused"
            }
          />
          <Switch
            checked={p.listed_on_website}
            disabled={busy !== null}
            onCheckedChange={(c) => toggleFlag("listed_on_website", c)}
          />
        </ChannelRow>
      </section>

      {/* Gruppe 2 — Plattform (eigener Marktplatz) */}
      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("channelsTab.groupPlatform")}
        </h2>
        <ChannelRow icon="ph:storefront" name={t("channelChips.platform")}>
          {marktWartet && (
            <span className="text-xs font-medium text-amber-600">
              {t("channelsTab.marketplaceReview")}
            </span>
          )}
          <StatusDot
            tone={
              !isActive || !p.listed_on_marketplace
                ? "paused"
                : marktWartet
                  ? "pending"
                  : "active"
            }
          />
          <span className="text-xs text-muted-foreground">{t("channelsTab.marketplaceMandatory")}</span>
        </ChannelRow>
        {marktWartet && (
          <Card className="flex items-center gap-2 bg-muted/40 p-3 text-sm text-muted-foreground">
            <Icon icon="ph:hourglass-medium" className="size-4 shrink-0" />
            {t("channelsTab.marketplaceReviewHint")}
          </Card>
        )}
      </section>

      {/* Gruppe 3 — Portale (Channex → OTAs) */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("channelsTab.groupPortals")}
          </h2>
          {/* FeWo/Agentur: jedes Objekt hat seine EIGENE Booking-ID → „Portal
              verbinden" pro Objekt. Hotel: das Portal wird EINMAL auf Betriebs-
              Ebene verbunden (eine Hotel-ID, Zimmer = Room-Types) → hier kein
              Verbinden pro Zimmer. */}
          {accommodationType !== "hotel" && (
            <ChannelConnectButton
              presetPropertyId={p.id}
              accommodationType={accommodationType}
              onDone={() => router.refresh()}
              label={t("channelsTab.connectPortal")}
              variant="outline"
            />
          )}
        </div>
        {connections.length === 0 ? (
          <Card className="p-4 text-sm text-muted-foreground">
            {t("channelsTab.noPortals")}
          </Card>
        ) : (
          connections.map((c) => (
            <ChannelRow
              key={c.portal_code}
              logoCode={c.portal_code}
              name={c.portal}
            >
              <span className="text-xs text-muted-foreground">
                {c.hotel_id}
              </span>
              <StatusDot
                tone={
                  c.last_error
                    ? "error"
                    : c.is_active && isActive
                      ? "active"
                      : "paused"
                }
              />
              <Switch
                checked={c.is_active}
                disabled={busy !== null}
                onCheckedChange={(next) => togglePortal(c.portal_code, next)}
              />
            </ChannelRow>
          ))
        )}
      </section>
    </div>
  );
}
