"use client";

// Zusatzleistungen im Reservierungs-Detail (Schnelltaste). Listet die zu dieser
// Buchung gekauften Upsells (mit Zahlstatus + „als bezahlt markieren") und bietet
// ein Schnell-Hinzufügen aus dem Objekt-Katalog — funktioniert für JEDEN Kanal,
// auch OTA (z. B. Booking): die Hausverwaltung bucht ein Extra-Angebot
// (z. B. Erstausstattung/Einkauf) provisionsfrei am OTA vorbei dazu.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { NativeSelect } from "@nextdays/ui/native-select";
import {
  addReservationAddon,
  availableReservationAddons,
  listReservationAddons,
  markReservationAddonPaid,
  type Addon,
  type ReservationAddon,
} from "@/lib/addons";
import { formatCurrency } from "@/lib/currency";
import { useRealtime } from "@/lib/use-realtime";

function localized(
  name: Record<string, string>,
  fallback: string,
): string {
  return name.de || name.en || Object.values(name)[0] || fallback;
}

export function ReservationAddonsSection({
  reservationId,
  currency,
  onChanged,
}: {
  reservationId: string;
  // Währung der Reservierung (kann null sein, wenn keine hinterlegt ist).
  currency: string | null;
  onChanged?: () => void;
}) {
  const t = useTranslations("calendar");
  const STATUS_LABEL: Record<ReservationAddon["status"], string> = {
    pending: t("reservationAddonsSection.statusPending"),
    paid: t("reservationAddonsSection.statusPaid"),
    cancelled: t("reservationAddonsSection.statusCancelled"),
  };
  const [purchased, setPurchased] = useState<ReservationAddon[]>([]);
  const [catalog, setCatalog] = useState<Addon[]>([]);
  // Währung: bevorzugt die der Reservierung, sonst die vom Backend gelieferte
  // Objekt-Währung. Kein €-Fallback (Mehrwährung über 27 EU-Länder).
  const [cur, setCur] = useState<string | null>(currency);
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);

  const money = (v: number) =>
    cur ? formatCurrency(v, cur) : v.toLocaleString("de-DE");

  async function reload() {
    const [bought, avail] = await Promise.all([
      listReservationAddons(reservationId),
      availableReservationAddons(reservationId),
    ]);
    if (bought.ok) {
      setPurchased(bought.data.items);
      if (bought.data.currency) setCur(bought.data.currency);
    }
    if (avail.ok) {
      setCatalog(avail.data.items);
      if (avail.data.currency) setCur((c) => c ?? avail.data.currency);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservationId]);

  // Echtes Realtime (Supabase WebSocket): Käufe/Statuswechsel dieser Reservierung
  // sofort spiegeln — kein Polling (Projekt-Grundsatz).
  useRealtime({
    table: "reservation_addons",
    filter: `reservation_id=eq.${reservationId}`,
    onChange: () => void reload(),
  });

  async function add() {
    if (!pick) return;
    setBusy(true);
    const res = await addReservationAddon(reservationId, pick);
    setBusy(false);
    if (res.ok) {
      setPurchased(res.data.items);
      setPick("");
      toast.success(t("reservationAddonsSection.addSuccess"));
      onChanged?.();
    } else {
      toast.error(res.error);
    }
  }

  async function markPaid(id: string) {
    const res = await markReservationAddonPaid(id);
    if (res.ok) {
      await reload();
      toast.success(t("reservationAddonsSection.markPaidSuccess"));
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
        {t("reservationAddonsSection.title")}
      </p>

      {purchased.length > 0 ? (
        <div className="mb-3 flex flex-col gap-2">
          {purchased.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate">
                  {localized(p.name, t("reservationAddonsSection.fallbackAddonName"))}
                </span>
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
                    {t("reservationAddonsSection.markPaidAction")}
                  </button>
                )}
              </span>
            </div>
          ))}
          <div className="mt-1 flex justify-between border-t pt-1.5 text-sm font-semibold">
            <span>{t("reservationAddonsSection.totalLabel")}</span>
            <span>{money(total)}</span>
          </div>
        </div>
      ) : (
        <p className="mb-3 text-sm text-muted-foreground">
          {t("reservationAddonsSection.emptyPurchased")}
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
            <option value="">{t("reservationAddonsSection.pickPlaceholder")}</option>
            {catalog.map((a) => (
              <option key={a.id} value={a.id}>
                {localized(a.name, t("reservationAddonsSection.fallbackAddonName"))} ·{" "}
                {money(a.price)}
              </option>
            ))}
          </NativeSelect>
          <Button type="button" size="sm" onClick={() => void add()} disabled={!pick || busy}>
            <Icon icon="ph:plus" className="size-4" />
            {busy ? t("reservationAddonsSection.addBusy") : t("reservationAddonsSection.addAction")}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {t("reservationAddonsSection.emptyCatalog")}
        </p>
      )}
    </div>
  );
}
