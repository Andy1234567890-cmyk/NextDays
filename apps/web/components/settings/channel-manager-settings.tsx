"use client";

// Channel-Manager (Channex) — Einstellungs-Abschnitt. Zeigt den Verbindungs-
// status, die verbundenen Objekte (Property-Mappings) und erlaubt einen
// manuellen Buchungs-Sync. Business-Logik liegt im Backend (lib/channex.ts).
import { Icon } from "@iconify/react";
import { useCallback, useEffect, useState, useTransition } from "react";

import { ChannelConnectButton } from "@/components/channel-manager/channel-connect-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  ChannexBooking,
  PropertyMap,
  StoredChannelConnection,
} from "@/lib/channex";
import {
  listChannelConnections,
  setConnectionActive,
  syncChannexBookings,
  triggerFullSync,
} from "@/lib/channex";
import { formatCurrency } from "@/lib/currency";
import { useRealtime } from "@/lib/use-realtime";

type Props = {
  configured: boolean;
  propertyMaps: PropertyMap[];
  bookings: ChannexBooking[];
};

export function ChannelManagerSettings({
  configured,
  propertyMaps,
  bookings,
}: Props) {
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
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Icon icon="ph:broadcast" className="size-5 text-accent" />
              Channel-Manager
            </CardTitle>
            <CardDescription>
              Verteile deine Objekte automatisch an Booking.com, Airbnb, Expedia
              und weitere Kanäle.
            </CardDescription>
          </div>
          <span
            className={
              "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium " +
              (configured
                ? "bg-secondary text-secondary-foreground"
                : "bg-muted text-muted-foreground")
            }
          >
            {configured ? "Verbunden" : "Nicht konfiguriert"}
          </span>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        {!configured && (
          <p className="rounded-(--radius) border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
            Die Kanal-Anbindung ist noch nicht aktiv. Sobald sie freigeschaltet
            ist, kannst du deine Objekte mit den Buchungsportalen verbinden.
          </p>
        )}

        {/* Kanäle verbinden (eingebettete white-label UI) */}
        {configured && (
          <section className="flex flex-col gap-2">
            <h4 className="text-sm font-medium">Kanäle verbinden</h4>
            <p className="text-sm text-muted-foreground">
              Verbinde deine Buchungsportale (Booking.com, Airbnb, Expedia …) und
              ordne deine Objekte zu.
            </p>
            <ChannelConnectButton label="Portale verbinden" variant="accent" />
          </section>
        )}

        {/* Verbundene Objekte */}
        <section className="flex flex-col gap-2">
          <h4 className="text-sm font-medium">Verbundene Objekte</h4>
          {propertyMaps.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Noch keine Objekte mit den Kanälen verbunden.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-border rounded-(--radius) border border-border">
              {propertyMaps.map((m) => (
                <li key={m.id} className="flex flex-col gap-2 p-3">
                  <div className="flex items-center gap-3">
                    <Icon
                      icon="ph:house-line"
                      className="size-5 text-muted-foreground"
                    />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium">
                        {m.property_title ?? "Objekt"}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {m.last_sync_status === "error"
                          ? `Fehler: ${m.last_sync_error ?? "unbekannt"}`
                          : m.last_sync_at
                            ? `Letzter Sync: ${new Date(m.last_sync_at).toLocaleString("de-DE")}`
                            : "Noch nicht synchronisiert"}
                      </span>
                    </div>
                    <span
                      className={
                        "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium " +
                        (m.sync_enabled
                          ? "bg-secondary text-secondary-foreground"
                          : "bg-muted text-muted-foreground")
                      }
                    >
                      {m.sync_enabled ? "Aktiv" : "Pausiert"}
                    </span>
                    <FullSyncButton mapId={m.id} disabled={!m.sync_enabled} />
                  </div>
                  <PropertyConnections propertyId={m.property_id} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Buchungen */}
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-sm font-medium">
              OTA-Buchungen{" "}
              <span className="text-muted-foreground">({bookings.length})</span>
            </h4>
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

          {bookings.length > 0 && (
            <ul className="flex flex-col divide-y divide-border rounded-(--radius) border border-border">
              {bookings.slice(0, 8).map((b) => (
                <li key={b.id} className="flex items-center gap-3 p-3">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">
                      {b.ota_name ?? "Kanal"} · {b.ota_reservation_code ?? b.external_id}
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
      </CardContent>
    </Card>
  );
}

// Voll-Abgleich (Verfügbarkeit + Preise/Restriktionen, 500 Tage) für ein
// verbundenes Objekt sofort anstoßen — Wiederanlauf nach Ausfall/Drift.
function FullSyncButton({
  mapId,
  disabled,
}: {
  mapId: string;
  disabled: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<"ok" | "error" | null>(null);

  function handleClick() {
    setDone(null);
    startTransition(async () => {
      const res = await triggerFullSync(mapId);
      setDone(res.ok ? "ok" : "error");
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={pending || disabled}
      title="Verfügbarkeit, Preise und Restriktionen komplett neu an die Portale übertragen"
    >
      <Icon
        icon={
          pending
            ? "ph:spinner"
            : done === "ok"
              ? "ph:check"
              : done === "error"
                ? "ph:warning"
                : "ph:arrows-counter-clockwise"
        }
        className={"size-4 " + (pending ? "animate-spin" : "")}
      />
      {pending ? "Wird eingereiht …" : "Voll-Abgleich"}
    </Button>
  );
}

// Verbundene Buchungsportale eines Objekts (Hotel-ID + Status pro Portal).
// White-label: zeigt nur Portal-Label, Hotel-ID und Status.
function PropertyConnections({ propertyId }: { propertyId: string }) {
  const [items, setItems] = useState<StoredChannelConnection[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await listChannelConnections(propertyId);
    setItems(res.ok ? res.data.items : []);
    setLoaded(true);
  }, [propertyId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime-Pflicht: Kanal-An/Aus eines anderen Nutzers/einer anderen Session
  // sofort übernehmen (kein Polling). Nur Verbindungen DIESES Objekts.
  useRealtime({
    table: "channex_channel_connection",
    filter: `property_id=eq.${propertyId}`,
    onChange: () => void load(),
  });

  async function toggle(c: StoredChannelConnection) {
    const next = !c.is_active;
    setToggling(c.portal_code);
    // Optimistisch umschalten; bei Fehler aus dem Backend zurücksetzen.
    setItems((prev) =>
      prev.map((x) =>
        x.portal_code === c.portal_code ? { ...x, is_active: next } : x,
      ),
    );
    const res = await setConnectionActive(propertyId, c.portal_code, next);
    if (!res.ok) await load();
    setToggling(null);
  }

  if (!loaded || items.length === 0) return null;

  return (
    <ul className="flex flex-wrap gap-2 pl-8">
      {items.map((c) => (
        <li
          key={c.portal_code}
          className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs"
          title={c.last_error ?? undefined}
        >
          <span
            className={
              "size-1.5 rounded-full " +
              (c.is_active ? "bg-emerald-500" : "bg-amber-500")
            }
          />
          <span className="font-medium">{c.portal}</span>
          <span className="text-muted-foreground">· {c.hotel_id}</span>
          <button
            type="button"
            onClick={() => toggle(c)}
            disabled={toggling === c.portal_code}
            className="ml-1 rounded-full px-2 py-0.5 font-medium text-accent hover:underline disabled:opacity-50"
          >
            {c.is_active ? "Pausieren" : "Aktivieren"}
          </button>
        </li>
      ))}
    </ul>
  );
}
