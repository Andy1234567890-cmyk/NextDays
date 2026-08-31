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
import { ImportFortschritt } from "@/components/channel-manager/import-fortschritt";
import { PortalKontenButton } from "@/components/channel-manager/portal-konten";
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
  getCsvTemplate,
  type BestandsimportLauf,
  bestandsimportStand,
  bestandsimportStarten,
  runChannelAction,
  disconnectPortalConnection,
  setConnectionActive,
  syncChannexBookings,
  triggerFullSync,
  uebernehmeAirbnbListings,
} from "@/lib/channex";
import { formatCurrency } from "@/lib/currency";
import {
  type ExportBefund,
  csvAlsBefund,
  portalExportNachCsv,
} from "@/lib/portal-export";
import { channelLabelLoose } from "@/lib/channel-logos";
import { toast } from "sonner";

// Portal-Metadaten für die Detailseite (Code = stabiler Schlüssel wie im
// Backend-Katalog). Logo aus public/channels/*.svg, sonst Iconify-Fallback.
export type ChannelMeta = {
  code: string;
  label: string;
  logo?: string;
  icon?: string;
  // Wie ein weiterer Zugang dieses Portals verbunden wird: "oauth" = der
  // Vermieter autorisiert beim Portal (Airbnb), "credential" = Hotel-ID im
  // Assistenten eintragen (Booking.com & Co.). Entscheidet, ob das
  // Konten-Panel überhaupt einen Autorisierungs-Knopf anbietet.
  connection_type: "oauth" | "credential";
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

// Buchungen dieses Kanals.
//
// `ota_name` ist NICHT der Klarname, sondern Channex' Kanalcode — für
// Booking.com „BookingCom" ohne Punkt. Verglichen wurde vorher gegen
// `meta.label` („Booking.com"), also `"booking.com" !== "bookingcom"`: die
// Seite meldete „Buchungen (0)", obwohl sechs vorlagen. Bei Airbnb fiel es
// nicht auf, weil Code und Klarname dort zufällig zusammenfallen.
//
// Verglichen wird deshalb gegen den PORTAL-CODE, und auf der normalisierten
// Form — dieselbe Marke steht je nach Quelle als Code, Klarname oder mit
// Rechtsform-Zusatz in den Daten.
function schlank(wert: string): string {
  return wert.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function bookingsForPortal(
  bookings: ChannexBooking[],
  portalCode: string,
): ChannexBooking[] {
  const needle = schlank(portalCode);
  if (!needle) return [];
  return bookings.filter((b) => {
    const name = schlank(b.ota_name ?? "");
    return name === needle || name.startsWith(needle);
  });
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
  const portalBookings = bookingsForPortal(bookings, meta.code);
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
              {/* Konten verwalten (0304): eigenes Panel, weil eine Agentur je
                  Portal hunderte Zugänge führen kann. Dort wird ein weiteres
                  Konto verbunden und ein einzelnes getrennt — hier im Kopf ist
                  nur der Einstieg samt Zähler. */}
              <PortalKontenButton
                portalCode={meta.code}
                portalLabel={meta.label}
                connectionType={meta.connection_type}
                onGeaendert={() => router.refresh()}
              />
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
              label={`${meta.label} ${t("connect")}`}
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
        istAirbnb={meta.code === "AirBNB" && isConnected}
      />

      {/* Eingehende Buchungen dieses Kanals + manueller Sync */}
      <BookingsSection
        bookings={portalBookings}
        configured={configured}
        portalLabel={meta.label}
        channelId={channelId}
        channelIds={detail?.channel_ids ?? []}
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
  istAirbnb,
}: {
  mappings: ChannelMappingRow[];
  maps: PropertyMap[];
  portalCode: string;
  portalLabel: string;
  connectedCount: number;
  totalCount: number;
  accommodationType?: "hotel" | "vacation_rental" | null;
  /** Nur Airbnb kennt „neue Anzeigen nachholen" — dort entstehen Inserate am
   *  Portal, nicht bei uns. */
  istAirbnb: boolean;
}) {
  const t = useTranslations("channels");
  const router = useRouter();
  const [suche, setSuche] = useState("");
  const [suchtAnzeigen, setSuchtAnzeigen] = useState(false);
  const [anzeigenMeldung, setAnzeigenMeldung] = useState<string | null>(null);
  const [anzeigenFehler, setAnzeigenFehler] = useState(false);

  /** Die Airbnb-Anzeigen erneut lesen und anlegen, was bei uns fehlt.
   *
   *  Idempotent über `airbnb_listing_id` — bestehende Objekte werden
   *  aktualisiert, nicht verdoppelt. Findet der Lauf nichts Neues, sagt er das
   *  ausdrücklich UND nennt die Zahl der bei Airbnb gefundenen Anzeigen: fehlt
   *  dort eine, liegt es an Airbnb (nicht verbundene, pausierte oder
   *  ausgeblendete Anzeigen liefert der Aggregator nicht) — der Betrieb muss
   *  das sehen, statt sie bei uns vergeblich zu suchen. */
  function anzeigenSuchen() {
    setSuchtAnzeigen(true);
    setAnzeigenMeldung(null);
    void uebernehmeAirbnbListings().then((res) => {
      setSuchtAnzeigen(false);
      setAnzeigenFehler(!res.ok);
      if (!res.ok) {
        setAnzeigenMeldung(res.error);
        return;
      }
      const d = res.data;
      setAnzeigenMeldung(
        d.created > 0
          ? t("findNewListingsFound", {
              created: d.created,
              found: d.listings_gefunden,
            })
          : t("findNewListingsNone", { found: d.listings_gefunden }),
      );
      if (d.created > 0) router.refresh();
    });
  }
  // Hotel-ID einer BEREITS verbundenen Zeile: bei einem Hotel teilen alle
  // Zimmertypen EINE Hotel-ID. Weitere Zimmer müssen sie dann nicht erneut
  // eingeben — der Assistent überspringt den Hotel-ID-Schritt und geht direkt
  // ins Zimmer-Mapping.
  //
  // Das gilt aber NUR innerhalb eines Gebäudes, und darüber entscheidet der
  // Server (`shares_building`, aus `properties.building_id`). Vorher wurde die
  // ID hier stur aus der ersten verbundenen Zeile genommen und JEDER Zeile
  // mitgegeben. Bei einem Betrieb mit lauter einzelnen Ferienhäusern — jedes mit
  // eigener Booking.com-Hotel-ID — war damit nach der ERSTEN Verbindung keine
  // weitere mehr möglich: der Assistent sprang mit der fremden Hotel-ID ins
  // Mapping und bot nirgends eine Fläche, die eigene einzutragen (live
  // 10.08.2026: 19 Objekte ohne Gebäude, 2 verbunden, die übrigen 16
  // unverbindbar).
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
        <div className="flex items-center gap-3">
          {/* Neue Anzeigen nachholen. Ohne diesen Knopf kam ein NACHTRÄGLICH
              bei Airbnb angelegtes Inserat nie bei uns an: die Übernahme lief
              nur einmal im Anschluss an die Autorisierung, und danach gab es
              keinen Weg mehr — nur „Verbinden", das schon verbunden war. */}
          {istAirbnb && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={anzeigenSuchen}
              disabled={suchtAnzeigen}
            >
              <Icon
                icon={suchtAnzeigen ? "ph:spinner" : "ph:magnifying-glass"}
                className={"size-4 " + (suchtAnzeigen ? "animate-spin" : "")}
              />
              {t("findNewListings")}
            </Button>
          )}
          <span className="text-sm text-muted-foreground">
            {t("connectedOf", { connected: connectedCount, total: totalCount })}
          </span>
        </div>
      </div>
      {anzeigenMeldung && (
        <p
          className={
            "text-sm " +
            (anzeigenFehler ? "text-destructive" : "text-foreground")
          }
        >
          {anzeigenMeldung}
        </p>
      )}
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
        ) : row.needs_repair ? (
          /* Zuordnung ist da, das Portal kann sie nur nicht auflösen. Das ist
             KEIN „nicht verbunden": es sieht dort verbunden aus, aber Preise
             kommen nie an. Eigene Farbe und eigener Text, sonst hält der
             Betrieb es für ein bloßes „noch nicht eingerichtet". */
          <span
            className="inline-block rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
            title={t("repairHint")}
          >
            {t("statusBroken")}
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
              // Nur wenn dieses Objekt die Kennung wirklich TEILT (gemeinsames
              // Gebäude mit einem verbundenen Objekt). Sonst hat es seine eigene
              // Hotel-ID und muss danach gefragt werden.
              presetHotelId={row.shares_building ? connectedHotelId : null}
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
  channelIds,
  canPullFuture,
  istAirbnb,
}: {
  bookings: ChannexBooking[];
  configured: boolean;
  portalLabel: string;
  channelId: string | null;
  /** ALLE Kanäle dieses Portals (eine Kennung = ein Kanal). „Bestehende
   *  Buchungen laden" läuft über jeden einzelnen. */
  channelIds: string[];
  canPullFuture: boolean;
  /** Nur Airbnb: der Historien-Import geht direkt ans Portal, nicht über den
   *  Aggregator — er steht deshalb in keinem Kanal-Katalog. */
  istAirbnb: boolean;
}) {
  const t = useTranslations("channels");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  // Der serverseitige Historien-Lauf. Kommt beim Seitenaufruf einmal frisch
  // und danach per Realtime — die Seite darf jederzeit verlassen und wieder
  // geöffnet werden, der Balken steht dann am aktuellen Stand.
  const [lauf, setLauf] = useState<HistorieLauf | null>(null);
  // Der serverseitige Datei-Import. Wie `lauf` oben: der Klick reiht nur ein,
  // den Stand zeigt `ImportFortschritt` (Realtime + Nachfassen).
  const [laufImport, setLaufImport] = useState<BestandsimportLauf | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  // Vorschau der eingelesenen Datei. Der Import läuft ERST auf Bestätigung:
  // die Objektnamen des Portals müssen exakt auf unsere Objekttitel passen,
  // sonst überspringt der Import die Zeilen still. Diese Liste ist die einzige
  // Stelle, an der das VOR dem Schreiben auffällt.
  const [vorschau, setVorschau] = useState<ExportBefund | null>(null);

  useEffect(() => {
    if (!istAirbnb) return;
    void airbnbHistorieLaufStand().then((r) => {
      if (r.ok) setLauf(r.data.lauf);
    });
  }, [istAirbnb]);

  // Laeuft gerade ein Datei-Import? Ohne diesen Abruf boete eine frisch
  // geladene Seite den Knopf an, als sei nichts los — und ein zweiter Klick
  // liefe in den „schon ein Lauf offen"-Fall statt in den Balken.
  // Nur einen OFFENEN Lauf zeigen: ein vor Tagen abgeschlossener Import soll
  // nicht bei jedem Seitenaufruf sein Fenster wieder aufmachen.
  useEffect(() => {
    void bestandsimportStand().then((r) => {
      if (r.ok && r.data?.status === "laeuft") setLaufImport(r.data);
    });
  }, []);

  // KEIN Realtime-Abo mehr auf `airbnb_historie_lauf`: die Tabelle ist seit
  // Migration 0337 für `authenticated` gesperrt (Wurzel 6 — sie ist eine
  // Vertriebsdaten-Tabelle des Portal-Anschlusses). Ohne SELECT-Grant passt
  // keine Policy mehr; das Abo wäre eine stumme Attrappe.
  //
  // Eine erlaubte Ersatzquelle gibt es NICHT. `reservations` scheidet aus: der
  // Worker schreibt den Fortschritt (`objekte_fertig`, `objekte_gesamt`,
  // `aktuelles_objekt`, `status`) ausschließlich nach `airbnb_historie_lauf`
  // (`airbnb_historie_dienst.historie_lauf_ausfuehren`). Ein Objekt ohne neue
  // Buchungen rückt den Balken weiter, ohne eine einzige Reservierungszeile zu
  // berühren, und Start/Ende des Laufs stehen dort überhaupt nicht — ein Abo
  // auf `reservations` wäre ein stiller Ersatz, der einen falschen Stand
  // zeigte.
  //
  // WAS DADURCH ENTFÄLLT: Der Fortschrittsbalken des Historien-Imports läuft
  // nicht mehr live mit. Der Stand kommt beim Seitenaufruf einmal frisch
  // (Effekt oben) — ein erneutes Laden der Kanalseite zeigt den aktuellen
  // Stand. Das Ergebnis des Laufs meldet ohnehin die Glocke
  // (Benachrichtigung), die der Worker am Ende schreibt.

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

  // Buchungen holen, die VOR dem Verbinden im Portal entstanden sind — für
  // JEDEN Kanal dieses Portals.
  //
  // Vorher lief das nur auf `channelId`, also auf EINEM beliebigen Kanal. Das
  // stammt aus der Hotel-Annahme (ein Hotel, eine Hotel-ID, ein Kanal). Bei
  // einzelnen Ferienhäusern hat jedes seine eigene Hotel-ID und damit einen
  // eigenen Kanal: der Knopf stieß von 18 Häusern genau eines an, und die
  // übrigen 17 bekamen ihre bestehenden Buchungen NIE — sichtbar daran, dass
  // „Feriehus Kornblomst" dauerhaft ohne Buchung blieb, während der Aggregator
  // für dessen Hotel-ID auch nichts hatte (nie angestoßen).
  //
  // Nacheinander, nicht parallel: es sind schreibende Portal-Aktionen, und
  // Channex deckelt die Aufrufe je Konto und Minute.
  function pullFuture() {
    const ids = channelIds.length > 0 ? channelIds : channelId ? [channelId] : [];
    if (ids.length === 0) return;
    setMessage(null);
    startTransition(async () => {
      const fehler: string[] = [];
      // Was WIRKLICH angekommen ist. Der Server fasst nach dem Portal-Auftrag
      // nach und liefert die echten Zahlen; ohne sie stünde hier „wird geladen",
      // auch wenn null Buchungen kamen — und genau daraus entsteht der
      // Fehlschluss „das Portal hat keine" (Wurzel 4: keine geschönte Aussage).
      let geholt = 0;
      for (const id of ids) {
        const res = await runChannelAction(id, "load_future_reservations");
        if (!res.ok) fehler.push(res.error);
        else geholt += res.data.saved ?? 0;
      }
      setIsError(fehler.length > 0);
      // Teilerfolg ist der Normalfall bei vielen Kennungen — ihn als Erfolg oder
      // als Totalausfall darzustellen wäre beides falsch (Wurzel 4/5).
      setMessage(
        fehler.length === 0
          ? geholt > 0
            ? t("pullFutureDone", { count: geholt })
            : t("pullFutureEmpty")
          : fehler.length === ids.length
            ? fehler[0]
            : t("pullFuturePartial", {
                ok: ids.length - fehler.length,
                total: ids.length,
                error: fehler[0],
              }),
      );
      // Die geholten Buchungen sollen sofort in der Liste stehen.
      if (geholt > 0) router.refresh();
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

  // Der Datei-Weg für alles, was VOR dem Verbinden liegt und über keine
  // Schnittstelle mehr zu holen ist.
  //
  // WARUM ER HIER STEHEN MUSS: Booking.coms Reservations-API liefert
  // ausdrücklich nur Abreisen ab morgen, und der Aggregator kennt
  // ausschliesslich, was er selbst als Revision gesehen hat — beides beginnt
  // erst am Tag des Verbindens. Für einen Betrieb, der mitten im Jahr
  // wechselt, ist der Extranet-Export des Portals die EINZIGE Quelle für die
  // Monate davor (live gemessen: früheste über die Schnittstelle erreichbare
  // Anreise war der 03.08.2026, obwohl der Export ab Januar Buchungen führt).
  //
  // Der Import lag bisher nur im Onboarding-Assistenten. Bestandskunden
  // durchlaufen den nicht mehr — für sie war der Weg damit unerreichbar,
  // obwohl gerade sie ihn brauchen (der Wechsel liegt bei ihnen hinter dem
  // Onboarding). Deshalb steht er jetzt zusätzlich hier, an den Buchungen des
  // Portals, wo man ihn sucht.
  function downloadTemplate() {
    setCsvError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await getCsvTemplate();
      if (!res.ok) {
        setCsvError(res.error);
        return;
      }
      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "buchungen-vorlage.csv";
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  // Datei einlesen und PRÜFEN — noch nichts schreiben.
  //
  // Nimmt den Portal-Export so, wie das Portal ihn verschickt: Booking.com
  // liefert echtes altes Binär-Excel (.xls, CDFV2). Eine reine CSV-Annahme
  // hätte den Betrieb gezwungen, die Datei vorher selbst umzuspeichern — und
  // im Datei-Dialog war sie ausgegraut, also gar nicht wählbar.
  function onExportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Auswahl leeren: sonst löst dieselbe Datei kein `change` mehr aus, und ein
    // zweiter Versuch nach einer Korrektur bliebe wirkungslos.
    e.target.value = "";
    if (!file) return;
    setCsvError(null);
    setVorschau(null);
    setMessage(null);
    startTransition(async () => {
      try {
        // Eine fertige CSV geht direkt durch (Vorlagen-Weg); Excel wird hier
        // umgewandelt.
        const istCsv = /\.csv$/i.test(file.name);
        const befund = istCsv
          ? csvAlsBefund(await file.text())
          : portalExportNachCsv(await file.arrayBuffer(), { jahr: 0 });
        if (befund.uebernommen === 0) {
          setCsvError(t("csvNothingUsable"));
          return;
        }
        setVorschau(befund);
      } catch (err) {
        // Die echte Meldung zeigen, nicht „Fehler beim Lesen": bei einer
        // falschen Datei steht dort, WELCHE Spalte fehlt.
        setCsvError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  // Erst jetzt schreiben — nach Sicht auf die Objektnamen.
  //
  // Der Klick REIHT nur ein und wartet nicht auf das Ergebnis: bei 252 Zeilen
  // lief der frühere synchrone Weg rund 15 Minuten (live gemessen am
  // 31.08.2026, 3,6 s je Zeile), der Browser brach ab und zeigte „Backend nicht
  // erreichbar.", während der Server weiterschrieb. Den Fortschritt zeigt jetzt
  // `ImportFortschritt`; die Seite darf dabei geschlossen werden.
  function importBestaetigen() {
    if (!vorschau) return;
    setCsvError(null);
    startTransition(async () => {
      const res = await bestandsimportStarten(vorschau.csv, portalLabel);
      if (!res.ok) {
        setCsvError(res.error);
        return;
      }
      setLaufImport(res.data);
      setVorschau(null);
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

      {/* Datei-Import für die Zeit VOR dem Verbinden. Zwei Schritte, weil der
          Betrieb dazwischen selbst arbeitet: Vorlage holen, Export des Portals
          hineinschreiben, hochladen. */}
      <div className="flex flex-col gap-2 rounded-2xl border border-border p-3">
        <span className="text-sm font-medium">{t("csvTitle")}</span>
        <p className="text-xs text-muted-foreground">{t("csvText")}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={downloadTemplate}
            disabled={pending || laeuft}
          >
            <Icon icon="ph:download-simple" className="size-4" />
            {t("csvDownloadTemplate")}
          </Button>
          <label
            className={
              "inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium " +
              (pending || laeuft
                ? "cursor-not-allowed opacity-50"
                : "cursor-pointer hover:bg-secondary/50")
            }
          >
            <Icon icon="ph:upload-simple" className="size-4" />
            {t("csvUpload")}
            {/* .xls MUSS dabei sein: Booking.com verschickt den Export als
                altes Binär-Excel. Ohne diese Endung ist die Datei im
                Datei-Dialog ausgegraut und gar nicht wählbar. */}
            <input
              type="file"
              accept=".xls,.xlsx,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              onChange={onExportFile}
              disabled={pending || laeuft}
              className="hidden"
            />
          </label>
        </div>
        <p className="text-xs text-muted-foreground">{t("csvHint")}</p>

        {/* Vorschau VOR dem Schreiben. Der Import trifft den Objekttitel exakt
            — passt ein Portal-Name nicht, fällt die Zeile still aus. Hier ist
            die einzige Stelle, an der das vorher auffällt. */}
        {vorschau && (
          <div className="flex flex-col gap-2 rounded-(--radius) border border-accent/40 bg-accent/5 p-3 text-sm">
            <span className="font-medium">
              {t("csvPreview", {
                count: vorschau.uebernommen,
                from: vorschau.von,
                to: vorschau.bis,
              })}
            </span>
            {Object.keys(vorschau.ausgelassen).length > 0 && (
              <ul className="list-disc pl-5 text-xs text-muted-foreground">
                {Object.entries(vorschau.ausgelassen).map(([grund, n]) => (
                  <li key={grund}>
                    {n} × {grund}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium">
                {t("csvPreviewProperties")}
              </span>
              {/* Die Namen SO, wie sie in der Datei stehen. Wer hier einen
                  Namen sieht, der nicht seinem Objekttitel entspricht, weiss
                  vor dem Import, dass diese Zeilen ausfallen. */}
              <ul className="max-h-40 overflow-y-auto text-xs text-muted-foreground">
                {Object.entries(vorschau.objekte)
                  .sort((a, b) => b[1] - a[1])
                  .map(([name, n]) => (
                    <li key={name} className="flex justify-between gap-3">
                      <span className="truncate">{name}</span>
                      <span className="shrink-0 tabular-nums">{n}</span>
                    </li>
                  ))}
              </ul>
            </div>
            {vorschau.ohneNummer > 0 && (
              <span className="text-xs text-amber-700 dark:text-amber-500">
                {t("csvPreviewNoRef", { count: vorschau.ohneNummer })}
              </span>
            )}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                type="button"
                size="sm"
                onClick={importBestaetigen}
                disabled={pending}
              >
                <Icon
                  icon={pending ? "ph:spinner" : "ph:check"}
                  className={"size-4 " + (pending ? "animate-spin" : "")}
                />
                {t("csvConfirm", { count: vorschau.uebernommen })}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setVorschau(null)}
                disabled={pending}
              >
                {t("csvCancel")}
              </Button>
            </div>
          </div>
        )}

        {csvError && (
          <p className="rounded-(--radius) bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {csvError}
          </p>
        )}

        {/* Das ERGEBNIS steht im Fortschritts-Fenster (`ImportFortschritt`),
            nicht mehr hier: es zeigt dieselben drei Zahlen plus die
            Fehlerzeilen, aber schon WAEHREND des Laufs. Ein Ergebnisblock an
            dieser Stelle koennte erst nach ~7 Minuten erscheinen — und der
            Betrieb hat die Seite laengst verlassen. */}
      </div>

      {/* Fortschritt des Datei-Imports. Eigenes Fenster statt eines Blocks in
          der Seite: der Lauf dauert Minuten, und der Betrieb soll sehen, dass
          etwas passiert, ohne die Stelle suchen zu muessen. */}
      <ImportFortschritt
        lauf={laufImport}
        setLauf={setLaufImport}
        // Angelegte Buchungen sollen ohne Neuladen unten in der Liste stehen.
        onFertig={() => router.refresh()}
      />

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
                  {b.ota_name ? channelLabelLoose(b.ota_name) : t("channelFallback")} ·{" "}
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
