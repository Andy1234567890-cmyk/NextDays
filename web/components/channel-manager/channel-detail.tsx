"use client";

// Rechte Hauptfläche der Kanal-Detailseite (Lodgify-Muster): Kanal-Kopf mit
// Logo + Verbinden-Button, darunter die Mapping-Tabelle (unser Objekt ↔ OTA-
// Listing ↔ Sync-Status) sowie Voll-Abgleich/Pausieren je Objekt. Darunter die
// eingehenden Buchungen dieses Kanals + Verlauf. Alle Aktionen über den
// Backend-Slice (lib/channex.ts); Realtime-Pflicht (Route abonniert die Tabellen).
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { ChannelConnectButton } from "@/components/channel-manager/channel-connect-button";
import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";
import type {
  ChannelDetail as ChannelDetailData,
  ChannelMappingRow,
  ChannexBooking,
  HistorieLauf,
  PropertyMap,
} from "@/lib/channex";
import {
  activateChannel,
  airbnbHistorieLaufStand,
  airbnbHistorieLaufStarten,
  disconnectChannel,
  runChannelAction,
  disconnectPortalConnection,
  setConnectionActive,
  syncChannexBookings,
  triggerFullSync,
} from "@/lib/channex";
import { formatCurrency } from "@/lib/currency";
import { useRealtime } from "@/lib/use-realtime";
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
  // Hotel oder Ferienobjekt — steuert das Verbinden-Modell im Assistenten.
  accommodationType?: "hotel" | "vacation_rental" | null;
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
  accommodationType,
}: Props) {
  const t = useTranslations("channels");
  const router = useRouter();
  const [disconnecting, startDisconnect] = useTransition();
  const [activating, startActivate] = useTransition();
  const portalBookings = bookingsForPortal(bookings, meta.label);
  const mappings = detail?.mappings ?? [];
  // Ist das Portal verbunden? (mind. eine Verbindung + Channex-Kanal vorhanden)
  const channelId = detail?.channel_id ?? null;
  const isConnected = mappings.some((m) => m.connected) && !!channelId;
  // Verbunden ≠ aktiv: Channex legt Kanäle INAKTIV an. `false` heißt „steht auf
  // Disabled", `null` heißt „konnten wir nicht abrufen" — nur bei `false` gibt
  // es etwas zu tun, sonst behaupteten wir einen Zustand, den wir nicht kennen.
  const channelInactive = !!channelId && detail?.channel_active === false;

  // Kanal live schalten. Fehlen Channex noch Angaben, antwortet das Backend 422
  // mit dem Grund im Klartext — der wird gezeigt, statt still zu scheitern.
  const activate = () => {
    if (!channelId) return;
    startActivate(async () => {
      const res = await activateChannel(channelId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (res.data.channel_active) {
        toast.success(t("activateDone", { portal: meta.label }));
      } else {
        toast.error(res.data.readiness_offen ?? t("activateFailed"));
      }
      router.refresh();
    });
  };

  // „Alles lösen": den einen Channex-Kanal des Portals trennen (bei Hotels teilen
  // sich alle Zimmer diesen Kanal → alle Zimmer-Verbindungen sind danach weg).
  const disconnectAll = () => {
    if (!channelId) return;
    if (
      !window.confirm(t("disconnectConfirm", { portal: meta.label }))
    ) {
      return;
    }
    startDisconnect(async () => {
      const res = await disconnectChannel(channelId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(t("disconnectDone", { portal: meta.label }));
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
            <div className="flex flex-wrap items-center gap-2">
              {/* Steht der Kanal bei Channex auf „Disabled", ist das Verbinden
                  allein wirkungslos — nichts geht raus. Der Knopf ist der
                  einzige Weg zurück, wenn die Aktivierung beim Verbinden an
                  einer inzwischen behobenen Lücke gescheitert ist. */}
              {channelInactive && (
                <Button
                  type="button"
                  variant="accent"
                  onClick={activate}
                  disabled={activating}
                >
                  <Icon
                    icon={activating ? "ph:spinner" : "ph:play-circle"}
                    className={"size-4 " + (activating ? "animate-spin" : "")}
                  />
                  {t("activateChannel")}
                </Button>
              )}
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
                {t("disconnectChannel")}
              </Button>
            </div>
          ) : (
            <ChannelConnectButton
              label={`${meta.label} verbinden`}
              variant="accent"
              presetPortalCode={meta.code}
              accommodationType={accommodationType}
              onDone={() => router.refresh()}
            />
          ))}
      </header>

      {/* Der Zustand wird BENANNT, nicht nur ein Knopf angeboten: „verbunden,
          aber nicht aktiv" ist der Fall, in dem alles eingerichtet aussieht und
          trotzdem nichts an das Portal geht. Fehlen Channex noch Angaben,
          stehen sie hier — sonst sucht der Betrieb den Grund nirgends. */}
      {channelInactive && (
        <div className="flex flex-col gap-1 rounded-(--radius) border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <span className="font-medium text-amber-800 dark:text-amber-300">
            {t("channelInactiveTitle", { portal: meta.label })}
          </span>
          <span className="text-amber-800/90 dark:text-amber-300/90">
            {detail?.readiness_offen
              ? t("channelInactiveMissing", { fields: detail.readiness_offen })
              : t("channelInactiveReady")}
          </span>
        </div>
      )}

      {!configured ? (
        <p className="rounded-(--radius) border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
          {t("notConfiguredHint")}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          {t("channelIntro", { portal: meta.label })}
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
        accommodationType={accommodationType}
      />

      {/* Eingehende Buchungen dieses Kanals + manueller Sync */}
      <BookingsSection
        bookings={portalBookings}
        configured={configured}
        portalLabel={meta.label}
        channelId={channelId}
        // „Zukünftige Buchungen laden" bietet nicht jedes Portal an — der
        // Kanal-Katalog sagt, was geht (kein geratener Knopf).
        canPullFuture={
          (detail?.actions ?? []).includes("load_future_reservations") &&
          isConnected
        }
        // Der Historien-Import geht DIREKT an Airbnb, nicht über den
        // Aggregator — er steht deshalb nicht im Kanal-Katalog und wird am
        // Portal-Code erkannt.
        istAirbnb={meta.code === "AirBNB" && isConnected}
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
  accommodationType,
}: {
  mappings: ChannelMappingRow[];
  maps: PropertyMap[];
  portalCode: string;
  portalLabel: string;
  connectedCount: number;
  totalCount: number;
  accommodationType?: "hotel" | "vacation_rental" | null;
}) {
  const t = useTranslations("channels");
  const router = useRouter();
  const [suche, setSuche] = useState("");
  // Hotel-ID einer BEREITS verbundenen Zeile: bei Hotels teilen alle Zimmer eine
  // Hotel-ID. Weitere Zimmer müssen sie NICHT erneut eingeben — der Assistent
  // überspringt dann den Hotel-ID-Schritt und geht direkt ins Zimmer-Mapping.
  const connectedHotelId =
    mappings.find((m) => m.connected && m.ota_hotel_id)?.ota_hotel_id ?? null;

  if (mappings.length === 0) {
    return (
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t("propertiesHeading")}</h2>
        <p className="rounded-(--radius) border border-border p-4 text-sm text-muted-foreground">
          {t("noPropertiesYet", { portal: portalLabel })}
        </p>
      </section>
    );
  }

  // Suche über beide Seiten der Zuordnung: Objektname, Portal-Zimmername und
  // die Kennungen. Bei 15 Ferienhäusern ist Scrollen keine Suche.
  const needle = suche.trim().toLowerCase();
  const sichtbar = needle
    ? mappings.filter((m) =>
        [
          m.property_title,
          m.ota_room_title,
          m.ota_hotel_id,
          m.ota_room_type_code,
          m.property_id,
        ]
          .filter(Boolean)
          .some((v) => (v as string).toLowerCase().includes(needle)),
      )
    : mappings;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t("propertiesHeading")}</h2>
        <span className="text-sm text-muted-foreground">
          {t("connectedOf", { connected: connectedCount, total: totalCount })}
        </span>
      </div>
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
              <th className="p-3 font-medium">{t("propertyAtBrand")}</th>
              <th className="p-3 font-medium">
                {t("propertyAtPortal", { portal: portalLabel })}
              </th>
              <th className="p-3 font-medium">{t("syncStatusColumn")}</th>
              <th className="p-3 font-medium text-right">{t("actionColumn")}</th>
            </tr>
          </thead>
          <tbody>
            {sichtbar.map((row) => (
              <MappingRow
                key={row.property_id}
                row={row}
                portalCode={portalCode}
                mapId={mapIdFor(maps, row.property_id)}
                connectedHotelId={connectedHotelId}
                accommodationType={accommodationType}
                onConnected={() => router.refresh()}
              />
            ))}
            {sichtbar.length === 0 && (
              <tr>
                <td colSpan={4} className="p-4 text-sm text-muted-foreground">
                  {t("noSearchResults")}
                </td>
              </tr>
            )}
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
  accommodationType,
  onConnected,
}: {
  row: ChannelMappingRow;
  portalCode: string;
  mapId: string | null;
  connectedHotelId: string | null;
  accommodationType?: "hotel" | "vacation_rental" | null;
  onConnected: () => void;
}) {
  const t = useTranslations("channels");
  const [pending, startTransition] = useTransition();
  // Optimistischer An/Aus-Zustand; der Realtime-Refresh der Route korrigiert bei
  // Fehler ohnehin. setConnectionActive erwartet property_id + portal_code —
  // den Code liefert die Route (dieselbe Kanal-Detailseite).
  const [active, setActive] = useState(row.is_active);
  // Der optimistische Zustand darf den echten nicht überdauern: nach dem
  // Verbinden liefert der Realtime-Refresh eine frische Zeile — ohne diesen
  // Abgleich bliebe die Zeile auf dem Stand des ERSTEN Renders („Pausiert",
  // obwohl der Kanal längst aktiv ist).
  useEffect(() => {
    setActive(row.is_active);
  }, [row.is_active]);

  const statusLabel = !active
    ? t("statusPaused")
    : row.last_sync_status === "error"
      ? t("statusError")
      : t("statusSynced");
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

  // Trennen ist NICHT das Gegenstück zu „Pausieren": es löst die Zuordnung
  // dieser Anzeige zu diesem Objekt. Gebraucht, wenn falsch verbunden wurde.
  // Rückfrage, weil danach neu zugeordnet werden muss — und weil der Verkauf
  // über dieses Portal sofort stoppt.
  function trennen() {
    // Eigener Key, NICHT `disconnectConfirm`: das gehört zur Komplett-Trennung
    // des Portals („alle verbundenen Objekte") und erwartet `portal`. Hier geht
    // es um genau EIN Objekt — denselben Text zu benutzen hieße, dem Nutzer den
    // falschen Umfang zu nennen.
    if (
      !window.confirm(
        t("disconnectRowConfirm", {
          // Ohne Titel die Kennung nennen — dieselbe, die in der Zeile steht.
          // Ein leerer Name in der Rückfrage („Verbindung von „“ trennen?")
          // sagt dem Nutzer nicht, was er gerade trennt.
          property: row.property_title || row.property_id.slice(0, 8),
        }),
      )
    )
      return;
    startTransition(async () => {
      const res = await disconnectPortalConnection(row.property_id, portalCode);
      if (res.ok) {
        setActive(false);
        onConnected();
      }
    });
  }

  return (
    <tr className="border-b border-border last:border-0">
      <td className="p-3">
        {/* Bild + Name + eigene Kennung — so steht das Objekt auch in unserer
            Objektliste, damit beide Listen dieselbe Sprache sprechen. */}
        <div className="flex items-center gap-3">
          {row.property_photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={row.property_photo}
              alt=""
              className="size-10 shrink-0 rounded-(--radius) object-cover"
            />
          ) : (
            <span className="flex size-10 shrink-0 items-center justify-center rounded-(--radius) bg-muted text-muted-foreground">
              <Icon icon="ph:house" className="size-5" />
            </span>
          )}
          <span className="flex flex-col items-start">
            {/* Nur der NAME ist der Link, nicht die ganze Zeile: rechts stehen
                Voll-Abgleich/Pausieren/Bearbeiten/Trennen, und ein Klickziel
                über der Zeile würde jeden Fehlklick daneben zur Navigation
                machen — beim „Trennen" der teuerste mögliche Fehlklick.
                Dasselbe Ziel wie in der Objektliste und im Kalender
                (`/objekte/{id}`), damit alle drei Listen gleich funktionieren. */}
            <Link
              href={`/objekte/${row.property_id}`}
              className="font-medium hover:underline"
            >
              {row.property_title}
            </Link>
            <span className="font-mono text-xs text-muted-foreground">
              {t("idPrefix")} {row.property_id.slice(0, 8)}
            </span>
          </span>
        </div>
      </td>
      <td className="p-3 text-muted-foreground">
        {/* Portal-Seite: Zimmername plus die Kennungen in der Schreibweise des
            Extranets (Hotel-ID|Zimmer-ID) — damit lässt sich dort nachsehen. */}
        {row.connected ? (
          <div className="flex flex-col">
            <span className="font-medium text-foreground">
              {row.ota_room_title ?? row.property_title}
            </span>
            <span className="font-mono text-xs">
              {[row.ota_hotel_id, row.ota_room_type_code]
                .filter(Boolean)
                .join("|")}
            </span>
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
            {t("notConnectedStatus")}
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
                title={t("fullResync")}
              >
                <Icon
                  icon={pending ? "ph:spinner" : "ph:arrows-counter-clockwise"}
                  className={"size-4 " + (pending ? "animate-spin" : "")}
                />
                {t("fullResyncShort")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={toggle}
                disabled={pending}
              >
                {active ? t("pause") : t("activate")}
              </Button>
              {/* „Bearbeiten" führt auf die Einstellungen dieses Paars
                  (Objekt × Portal) — von hier kam man bisher nirgendwohin. */}
              <Link
                href={`/objekte/${row.property_id}/synchronisierung/${portalCode}`}
                className="text-sm font-medium hover:underline"
              >
                {t("edit")}
              </Link>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={trennen}
                disabled={pending}
                className="text-destructive hover:text-destructive"
              >
                {t("disconnect")}
              </Button>
            </>
          ) : (
            // Nicht verbunden: Assistent für GENAU dieses Objekt + Portal öffnen.
            <ChannelConnectButton
              label={t("connect")}
              variant="accent"
              presetPortalCode={portalCode}
              presetPropertyId={row.property_id}
              presetHotelId={connectedHotelId}
              accommodationType={accommodationType}
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
  channelId,
  canPullFuture,
  istAirbnb,
}: {
  bookings: ChannexBooking[];
  configured: boolean;
  portalLabel: string;
  channelId: string | null;
  canPullFuture: boolean;
  /** Nur Airbnb: der Historien-Import geht direkt ans Portal, nicht über den
   *  Aggregator — er steht deshalb in keinem Kanal-Katalog. */
  istAirbnb: boolean;
}) {
  const t = useTranslations("channels");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  // Der serverseitige Historien-Lauf. Kommt beim Seitenaufruf einmal frisch
  // und danach per Realtime — die Seite darf jederzeit verlassen und wieder
  // geöffnet werden, der Balken steht dann am aktuellen Stand.
  const [lauf, setLauf] = useState<HistorieLauf | null>(null);

  useEffect(() => {
    if (!istAirbnb) return;
    void airbnbHistorieLaufStand().then((r) => {
      if (r.ok) setLauf(r.data.lauf);
    });
  }, [istAirbnb]);

  useRealtime<HistorieLauf>({
    table: "airbnb_historie_lauf",
    enabled: istAirbnb,
    // onEvent statt onChange: die Zeile trägt den Stand schon bei sich, ein
    // Nachladen wäre ein zweiter Weg zur selben Wahrheit. Bei DELETE ist
    // `new` ein leeres Objekt — dann nichts übernehmen (sonst stünde eine
    // Zeile ohne Zahlen im Balken).
    onEvent: (p) => {
      if (p.new && "id" in p.new) setLauf(p.new as HistorieLauf);
    },
  });

  function handleSync() {
    setMessage(null);
    startTransition(async () => {
      const res = await syncChannexBookings();
      if (res.ok) {
        setIsError(false);
        setMessage(
          t("syncResult", {
            fetched: res.data.fetched,
            saved: res.data.saved,
            acked: res.data.acknowledged,
          }),
        );
      } else {
        setIsError(true);
        setMessage(res.error);
      }
    });
  }

  // Buchungen holen, die VOR dem Verbinden im Portal entstanden sind.
  function pullFuture() {
    if (!channelId) return;
    setMessage(null);
    startTransition(async () => {
      const res = await runChannelAction(channelId, "load_future_reservations");
      setIsError(!res.ok);
      setMessage(
        res.ok
          ? t("pullFutureStarted")
          : res.error,
      );
    });
  }

  // Die VERGANGENHEIT holen — direkt bei Airbnb, für alle verbundenen Objekte.
  // `load_future_reservations` (oben) liefert nur Zukünftiges und nur, was der
  // Aggregator selbst gesehen hat; alles vor dem Verbinden fehlt dort (live
  // gemessen: 0 gegenüber 462 bei Airbnb). Mehrfach klickbar — bestehende
  // Buchungen werden über den Bestätigungscode aktualisiert, nicht verdoppelt.
  //
  // Der Klick REIHT NUR EIN, er wartet nicht: ein Lauf über 18 Objekte dauert
  // Minuten, und so lange bleibt kein Betrieb auf der Seite. Vorher fuhr der
  // Browser die Objekte selbst durch — Tab zu hieß Abbruch mittendrin. Jetzt
  // arbeitet der Worker, der Fortschritt kommt per Realtime, und das Ergebnis
  // landet am Ende in der Glocke.
  function pullHistorie() {
    setMessage(null);
    setIsError(false);
    const bis = new Date().toISOString().slice(0, 10);
    const von = `${new Date().getFullYear() - 6}-01-01`;
    startTransition(async () => {
      const res = await airbnbHistorieLaufStarten(von, bis);
      if (!res.ok) {
        setIsError(true);
        setMessage(res.error);
        return;
      }
      setLauf(res.data);
    });
  }

  const laeuft = lauf?.status === "laeuft";
  // Objekte sind die Fortschritts-Einheit: „12 von 18" ist die einzige Zahl,
  // die vor dem Lauf feststeht. Wie viele Buchungen kommen, weiß niemand
  // vorher — deshalb steht die Buchungszahl daneben, nicht im Balken.
  const prozent = lauf
    ? Math.round(
        (lauf.objekte_fertig / Math.max(1, lauf.objekte_gesamt)) * 100,
      )
    : 0;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">
          {t("bookingsFrom", { portal: portalLabel })}{" "}
          <span className="text-muted-foreground">({bookings.length})</span>
        </h2>
        {/* EIN Knopf für „alles Bestehende holen". Bei Airbnb geht er direkt
            ans Portal (auch Vergangenheit, alle verbundenen Objekte); bei den
            übrigen Portalen bleibt die Aggregator-Aktion der einzige Weg, die
            nur Zukünftiges liefert. Zwei Knöpfe nebeneinander hätten den
            Betrieb raten lassen, welcher der richtige ist — und der schwächere
            hätte wie der vollständige ausgesehen. */}
        {(istAirbnb || canPullFuture) && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={istAirbnb ? pullHistorie : pullFuture}
            disabled={pending || laeuft}
          >
            <Icon
              icon={
                pending || laeuft ? "ph:spinner" : "ph:clock-counter-clockwise"
              }
              className={"size-4 " + (pending || laeuft ? "animate-spin" : "")}
            />
            {t("pullFuture")}
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={pending || laeuft || !configured}
        >
          <Icon
            icon={pending ? "ph:spinner" : "ph:arrows-clockwise"}
            className={"size-4 " + (pending ? "animate-spin" : "")}
          />
          {pending ? t("syncing") : t("syncBookings")}
        </Button>
      </div>

      {/* Fortschritt des Historien-Imports: Prozent, Objektzähler und wie viele
          Buchungen bisher eingelesen sind. Ohne diese Zahlen wäre ein Lauf über
          18 Objekte minutenlang nur ein drehender Spinner. */}
      {laeuft && lauf && (
        <div className="flex flex-col gap-1.5 rounded-2xl border border-border p-3">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="truncate">
              {t("historieProgress", {
                done: lauf.objekte_fertig,
                total: lauf.objekte_gesamt,
                property: lauf.aktuelles_objekt ?? "",
              })}
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {prozent}%
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={prozent}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-1.5 overflow-hidden rounded-full bg-muted"
          >
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-300"
              style={{ width: `${prozent}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground">
            {t("historieProgressCount", {
              count: lauf.angelegt + lauf.aktualisiert,
            })}
            {" · "}
            {t("historieKeepsRunning")}
          </span>
        </div>
      )}

      {/* Ergebnis des letzten Laufs — auch dann sichtbar, wenn der Betrieb
          während des Imports weg war und die Seite neu geladen hat. */}
      {lauf && !laeuft && lauf.beendet_at && (
        <p
          className={
            "text-sm " +
            (lauf.status === "fertig" ? "text-foreground" : "text-destructive")
          }
        >
          {lauf.status === "fertig"
            ? t("historieResult", {
                objects: lauf.objekte_gesamt,
                created: lauf.angelegt,
                updated: lauf.aktualisiert,
              })
            : t("historieIncomplete", {
                objects: lauf.objekte_gesamt - lauf.gescheitert.length,
                created: lauf.angelegt,
                failed:
                  lauf.gescheitert.map((g) => g.titel).join(", ") ||
                  String(lauf.gescheitert.length),
              })}
        </p>
      )}

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
        <p className="text-sm text-muted-foreground">{t("noBookingsYet")}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-(--radius) border border-border">
          {bookings.slice(0, 8).map((b) => (
            <li key={b.id} className="flex items-center gap-3 p-3">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">
                  {b.ota_name ?? t("channelFallback")} ·{" "}
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
