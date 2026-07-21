"use client";

// Rechte Hauptfläche der Kanal-Detailseite (Lodgify-Muster): Kanal-Kopf mit
// Logo + Verbinden-Button, darunter die Mapping-Tabelle (unser Objekt ↔ OTA-
// Listing ↔ Sync-Status) sowie Voll-Abgleich/Pausieren je Objekt. Darunter die
// eingehenden Buchungen dieses Kanals + Verlauf. Alle Aktionen über den
// Backend-Slice (lib/channex.ts); Realtime-Pflicht (Route abonniert die Tabellen).
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { ChannelConnectButton } from "@/components/channel-manager/channel-connect-button";
import { Button } from "@/components/ui/button";
import type {
  ChannelDetail as ChannelDetailData,
  ChannelMappingRow,
  ChannexBooking,
  PropertyMap,
} from "@/lib/channex";
import {
  disconnectChannel,
  setConnectionActive,
  syncChannexBookings,
  triggerFullSync,
} from "@/lib/channex";
import { formatCurrency } from "@/lib/currency";
import { toast } from "sonner";

// Portal-Metadaten für die Detailseite (Code = stabiler Schlüssel wie im
// Backend-Katalog). Logo aus public/channels/*.svg, sonst Iconify-Fallback.
export type ChannelMeta = {
  code: string;
  label: string;
  logo?: string;
  icon?: string;
};

type Props = {
  meta: ChannelMeta;
  configured: boolean;
  detail: ChannelDetailData | null;
  propertyMaps: PropertyMap[];
  bookings: ChannexBooking[];
};

// Buchungen dieses Kanals: ota_name ist der Klarname (z.B. „Booking.com").
function bookingsForPortal(
  bookings: ChannexBooking[],
  label: string,
): ChannexBooking[] {
  const needle = label.trim().toLowerCase();
  return bookings.filter(
    (b) => (b.ota_name ?? "").trim().toLowerCase() === needle,
  );
}

// Map-ID eines Objekts (für Voll-Abgleich) aus den Property-Maps auflösen.
function mapIdFor(maps: PropertyMap[], propertyId: string): string | null {
  return maps.find((m) => m.property_id === propertyId)?.id ?? null;
}

export function ChannelDetail({
  meta,
  configured,
  detail,
  propertyMaps,
  bookings,
}: Props) {
  const router = useRouter();
  const [disconnecting, startDisconnect] = useTransition();
  const portalBookings = bookingsForPortal(bookings, meta.label);
  const mappings = detail?.mappings ?? [];
  // Ist das Portal verbunden? (mind. eine Verbindung + Channex-Kanal vorhanden)
  const channelId = detail?.channel_id ?? null;
  const isConnected = mappings.some((m) => m.connected) && !!channelId;

  // „Alles lösen": den einen Channex-Kanal des Portals trennen (bei Hotels teilen
  // sich alle Zimmer diesen Kanal → alle Zimmer-Verbindungen sind danach weg).
  const disconnectAll = () => {
    if (!channelId) return;
    if (
      !window.confirm(
        `${meta.label} komplett trennen? Alle verbundenen Objekte dieses Portals ` +
          "werden getrennt.",
      )
    ) {
      return;
    }
    startDisconnect(async () => {
      const res = await disconnectChannel(channelId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${meta.label} getrennt.`);
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Kanal-Kopf: Logo + Verbinden (auf dieses Portal vorgewählt) */}
      <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          {meta.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={meta.logo}
              alt={meta.label}
              className="h-[2.5rem] w-auto max-w-[14rem] object-contain"
            />
          ) : (
            <Icon
              icon={meta.icon ?? "ph:broadcast"}
              className="size-10 text-foreground"
            />
          )}
        </div>
        {/* Verbinden-Button im Kopf: EIN Hotel = EINE Booking-Hotel-ID = EIN
            Verbinden fürs ganze Hotel. Der Assistent fragt die Hotel-ID EINMAL ab,
            danach werden alle Zimmer (Objekte) im Mapping-Schritt den Booking-
            Zimmertypen zugeordnet. Nicht pro Zimmer verbinden (das ist EIN Hotel,
            keine drei getrennten Betriebe). Ist das Portal schon verbunden, steht
            hier stattdessen „Verbindung trennen" (löst den gemeinsamen Kanal). */}
        {configured &&
          (isConnected ? (
            <Button
              type="button"
              variant="outline"
              onClick={disconnectAll}
              disabled={disconnecting}
              className="text-destructive hover:bg-destructive/10"
            >
              <Icon
                icon={disconnecting ? "ph:spinner" : "ph:plugs"}
                className={"size-4 " + (disconnecting ? "animate-spin" : "")}
              />
              Verbindung trennen
            </Button>
          ) : (
            <ChannelConnectButton
              label={`${meta.label} verbinden`}
              variant="accent"
              presetPortalCode={meta.code}
              onDone={() => router.refresh()}
            />
          ))}
      </header>

      {!configured ? (
        <p className="rounded-(--radius) border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
          Die Kanal-Anbindung ist noch nicht aktiv. Sobald sie freigeschaltet
          ist, kannst du deine Objekte mit diesem Portal verbinden.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Veröffentliche, synchronisiere und verwalte deine {meta.label}-Angebote
          an einem Ort.
        </p>
      )}

      {/* Mapping-Tabelle: unser Objekt ↔ OTA-Listing ↔ Sync-Status */}
      <MappingTable
        mappings={mappings}
        maps={propertyMaps}
        portalCode={meta.code}
        portalLabel={meta.label}
        connectedCount={detail?.connected_count ?? 0}
        totalCount={detail?.total_count ?? mappings.length}
      />

      {/* Eingehende Buchungen dieses Kanals + manueller Sync */}
      <BookingsSection
        bookings={portalBookings}
        configured={configured}
        portalLabel={meta.label}
      />
    </div>
  );
}

// Die Mapping-Tabelle (SiteMinder/Hostaway-Muster): eine Zeile JE OBJEKT —
// verbundene mit Status + Voll-Abgleich/Pausieren, nicht verbundene mit einem
// „Verbinden"-Button (öffnet den Assistenten für genau dieses Objekt). Zähler
// „X von Y verbunden" im Kopf.
function MappingTable({
  mappings,
  maps,
  portalCode,
  portalLabel,
  connectedCount,
  totalCount,
}: {
  mappings: ChannelMappingRow[];
  maps: PropertyMap[];
  portalCode: string;
  portalLabel: string;
  connectedCount: number;
  totalCount: number;
}) {
  const router = useRouter();
  // Hotel-ID einer BEREITS verbundenen Zeile: bei Hotels teilen alle Zimmer eine
  // Hotel-ID. Weitere Zimmer müssen sie NICHT erneut eingeben — der Assistent
  // überspringt dann den Hotel-ID-Schritt und geht direkt ins Zimmer-Mapping.
  const connectedHotelId =
    mappings.find((m) => m.connected && m.ota_hotel_id)?.ota_hotel_id ?? null;

  if (mappings.length === 0) {
    return (
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Objekte</h2>
        <p className="rounded-(--radius) border border-border p-4 text-sm text-muted-foreground">
          Du hast noch keine aktiven Objekte. Lege zuerst ein Objekt an, um es
          mit {portalLabel} zu verbinden.
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Objekte</h2>
        <span className="text-sm text-muted-foreground">
          {connectedCount} von {totalCount} verbunden
        </span>
      </div>
      <div className="overflow-x-auto rounded-(--radius) border border-border">
        <table className="w-full min-w-[36rem] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="p-3 font-medium">Objekt bei myNextDays</th>
              <th className="p-3 font-medium">Objekt bei {portalLabel}</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium text-right">Aktion</th>
            </tr>
          </thead>
          <tbody>
            {mappings.map((row) => (
              <MappingRow
                key={row.property_id}
                row={row}
                portalCode={portalCode}
                mapId={mapIdFor(maps, row.property_id)}
                connectedHotelId={connectedHotelId}
                onConnected={() => router.refresh()}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MappingRow({
  row,
  portalCode,
  mapId,
  connectedHotelId,
  onConnected,
}: {
  row: ChannelMappingRow;
  portalCode: string;
  mapId: string | null;
  connectedHotelId: string | null;
  onConnected: () => void;
}) {
  const [pending, startTransition] = useTransition();
  // Optimistischer An/Aus-Zustand; der Realtime-Refresh der Route korrigiert bei
  // Fehler ohnehin. setConnectionActive erwartet property_id + portal_code —
  // den Code liefert die Route (dieselbe Kanal-Detailseite).
  const [active, setActive] = useState(row.is_active);

  const statusLabel = !active
    ? "Pausiert"
    : row.last_sync_status === "error"
      ? "Fehler"
      : "Synchronisiert";
  const statusTone = !active
    ? "bg-muted text-muted-foreground"
    : row.last_sync_status === "error"
      ? "bg-destructive/10 text-destructive"
      : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300";

  function fullSync() {
    if (!mapId) return;
    startTransition(async () => {
      await triggerFullSync(mapId);
    });
  }

  function toggle() {
    const next = !active;
    setActive(next); // optimistisch
    startTransition(async () => {
      const res = await setConnectionActive(row.property_id, portalCode, next);
      if (!res.ok) setActive(!next); // zurückrollen bei Fehler
    });
  }

  return (
    <tr className="border-b border-border last:border-0">
      <td className="p-3">
        <span className="font-medium">{row.property_title ?? "Objekt"}</span>
      </td>
      <td className="p-3 text-muted-foreground">
        {/* Der OTA-Zimmertyp, auf den dieses Objekt gemappt ist (Name + Code),
            NICHT die Hotel-ID — die ist für alle Zimmer eines Hotels gleich. */}
        {row.connected ? (
          <div className="flex flex-col">
            <span className="font-medium text-foreground">
              {row.ota_room_title ?? row.property_title ?? "Zimmer"}
            </span>
            {row.ota_room_type_code && (
              <span className="font-mono text-xs">{row.ota_room_type_code}</span>
            )}
          </div>
        ) : (
          "—"
        )}
      </td>
      <td className="p-3">
        {row.connected ? (
          <span
            className={
              "inline-block rounded-full px-2.5 py-1 text-xs font-medium " +
              statusTone
            }
            title={row.last_sync_error ?? undefined}
          >
            {statusLabel}
          </span>
        ) : (
          <span className="inline-block rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
            Nicht verbunden
          </span>
        )}
      </td>
      <td className="p-3">
        <div className="flex items-center justify-end gap-2">
          {row.connected ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={fullSync}
                disabled={pending || !mapId || !active}
                title="Verfügbarkeit, Preise und Restriktionen komplett neu übertragen"
              >
                <Icon
                  icon={pending ? "ph:spinner" : "ph:arrows-counter-clockwise"}
                  className={"size-4 " + (pending ? "animate-spin" : "")}
                />
                Voll-Abgleich
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={toggle}
                disabled={pending}
              >
                {active ? "Pausieren" : "Aktivieren"}
              </Button>
            </>
          ) : (
            // Nicht verbunden: Assistent für GENAU dieses Objekt + Portal öffnen.
            <ChannelConnectButton
              label="Verbinden"
              variant="accent"
              presetPortalCode={portalCode}
              presetPropertyId={row.property_id}
              presetHotelId={connectedHotelId}
              onDone={onConnected}
            />
          )}
        </div>
      </td>
    </tr>
  );
}

// Eingehende OTA-Buchungen dieses Kanals + manueller Sync (der Sync zieht
// account-weit; wir zeigen aber nur die Buchungen dieses Portals).
function BookingsSection({
  bookings,
  configured,
  portalLabel,
}: {
  bookings: ChannexBooking[];
  configured: boolean;
  portalLabel: string;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  function handleSync() {
    setMessage(null);
    startTransition(async () => {
      const res = await syncChannexBookings();
      if (res.ok) {
        setIsError(false);
        setMessage(
          `Sync ok — ${res.data.fetched} geladen, ${res.data.saved} gespeichert, ${res.data.acknowledged} bestätigt.`,
        );
      } else {
        setIsError(true);
        setMessage(res.error);
      }
    });
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">
          Buchungen von {portalLabel}{" "}
          <span className="text-muted-foreground">({bookings.length})</span>
        </h2>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={pending || !configured}
        >
          <Icon
            icon={pending ? "ph:spinner" : "ph:arrows-clockwise"}
            className={"size-4 " + (pending ? "animate-spin" : "")}
          />
          {pending ? "Synchronisiere …" : "Buchungen synchronisieren"}
        </Button>
      </div>

      {message && (
        <p
          className={
            "text-sm " + (isError ? "text-destructive" : "text-foreground")
          }
        >
          {message}
        </p>
      )}

      {bookings.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Noch keine Buchungen von diesem Portal.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-(--radius) border border-border">
          {bookings.slice(0, 8).map((b) => (
            <li key={b.id} className="flex items-center gap-3 p-3">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">
                  {b.ota_name ?? "Kanal"} ·{" "}
                  {b.ota_reservation_code ?? b.external_id}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {b.arrival_date} → {b.departure_date}
                  {b.amount_cents != null &&
                    b.currency != null &&
                    ` · ${formatCurrency(b.amount_cents / 100, b.currency)}`}
                </span>
              </div>
              <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
                {b.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
