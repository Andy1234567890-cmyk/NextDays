"use client";

// Zusatzleistungen im Reservierungs-Detail (Schnelltaste). Listet die zu dieser
// Buchung gekauften Upsells (mit Zahlstatus + „als bezahlt markieren") und bietet
// ein Schnell-Hinzufügen aus dem Objekt-Katalog — funktioniert für JEDEN Kanal,
// auch OTA (z. B. Booking): die Hausverwaltung bucht ein Extra-Angebot
// (z. B. Erstausstattung/Einkauf) provisionsfrei am OTA vorbei dazu.
import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import {
  addReservationAddon,
  availableReservationAddons,
  listReservationAddons,
  markReservationAddonPaid,
  type Addon,
  type ReservationAddon,
} from "@/lib/addons";

const STATUS_LABEL: Record<ReservationAddon["status"], string> = {
  pending: "Offen",
  paid: "Bezahlt",
  cancelled: "Storniert",
};

function localized(name: Record<string, string>): string {
  return name.de || name.en || Object.values(name)[0] || "Zusatzleistung";
}

export function ReservationAddonsSection({
  reservationId,
  currency,
  onChanged,
}: {
  reservationId: string;
  currency: string;
  onChanged?: () => void;
}) {
  const [purchased, setPurchased] = useState<ReservationAddon[]>([]);
  const [catalog, setCatalog] = useState<Addon[]>([]);
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);

  const money = (v: number) =>
    v.toLocaleString("de-DE", { style: "currency", currency: currency || "EUR" });

  async function reload() {
    const [bought, avail] = await Promise.all([
      listReservationAddons(reservationId),
      availableReservationAddons(reservationId),
    ]);
    if (bought.ok) setPurchased(bought.data.items);
    if (avail.ok) setCatalog(avail.data.items);
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservationId]);

  async function add() {
    if (!pick) return;
    setBusy(true);
    const res = await addReservationAddon(reservationId, pick);
    setBusy(false);
    if (res.ok) {
      setPurchased(res.data.items);
      setPick("");
      toast.success("Zusatzleistung hinzugefügt.");
      onChanged?.();
    } else {
      toast.error(res.error);
    }
  }

  async function markPaid(id: string) {
    const res = await markReservationAddonPaid(id);
    if (res.ok) {
      await reload();
      toast.success("Als bezahlt markiert.");
    } else {
      toast.error(res.error);
    }
  }

  const total = purchased
    .filter((p) => p.status !== "cancelled")
    .reduce((s, p) => s + p.total, 0);

  return (
    <div className="rounded-(--radius) border p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Zusatzleistungen
      </p>

      {purchased.length > 0 ? (
        <div className="mb-3 flex flex-col gap-2">
          {purchased.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate">{localized(p.name)}</span>
                {p.qty > 1 && (
                  <span className="text-muted-foreground">×{p.qty}</span>
                )}
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    p.status === "paid"
                      ? "bg-secondary"
                      : p.status === "cancelled"
                        ? "bg-muted text-muted-foreground"
                        : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {STATUS_LABEL[p.status]}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span>{money(p.total)}</span>
                {p.status === "pending" && (
                  <button
                    type="button"
                    onClick={() => void markPaid(p.id)}
                    className="text-xs font-medium text-accent hover:underline"
                  >
                    bezahlt
                  </button>
                )}
              </span>
            </div>
          ))}
          <div className="mt-1 flex justify-between border-t pt-1.5 text-sm font-semibold">
            <span>Summe Zusatzleistungen</span>
            <span>{money(total)}</span>
          </div>
        </div>
      ) : (
        <p className="mb-3 text-sm text-muted-foreground">
          Noch keine Zusatzleistungen gebucht.
        </p>
      )}

      {/* Schnell-Hinzufügen aus dem Objekt-Katalog (jeder Kanal, auch OTA). */}
      {catalog.length > 0 ? (
        <div className="flex items-center gap-2">
          <NativeSelect
            value={pick}
            onChange={(e) => setPick(e.target.value)}
            className="flex-1"
          >
            <option value="">Zusatzleistung wählen …</option>
            {catalog.map((a) => (
              <option key={a.id} value={a.id}>
                {localized(a.name)} · {money(a.price)}
              </option>
            ))}
          </NativeSelect>
          <Button type="button" size="sm" onClick={() => void add()} disabled={!pick || busy}>
            <Icon icon="ph:plus" className="size-4" />
            {busy ? "…" : "Hinzufügen"}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Für dieses Objekt sind keine Zusatzleistungen angelegt.
        </p>
      )}
    </div>
  );
}
