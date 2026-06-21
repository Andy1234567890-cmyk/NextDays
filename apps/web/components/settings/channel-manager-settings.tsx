"use client";

// Channel-Manager (Channex) — Einstellungs-Abschnitt. Zeigt den Verbindungs-
// status, die verbundenen Objekte (Property-Mappings) und erlaubt einen
// manuellen Buchungs-Sync. Business-Logik liegt im Backend (lib/channex.ts).
import { Icon } from "@iconify/react";
import { useState, useTransition } from "react";

import { ChannelConnectButton } from "@/components/channel-manager/channel-connect-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ChannexBooking, PropertyMap } from "@/lib/channex";
import { syncChannexBookings } from "@/lib/channex";

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
                <li key={m.id} className="flex items-center gap-3 p-3">
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
                        ` · ${(b.amount_cents / 100).toLocaleString("de-DE", {
                          style: "currency",
                          currency: b.currency ?? "EUR",
                        })}`}
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
