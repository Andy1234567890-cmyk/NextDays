"use client";

// Gebühren, die Booking-Buchungen DIESES Objekts mitbringen und die hier fehlen.
//
// WARUM (03.09.2026): Die Booking-Buchung 5522296055 für „Feriehus Kornblomst"
// brachte „Stromkosten DKK 125,00" mit. Am Objekt standen nur Resort, Reinigung
// und Haustier. Die Eigentümer-Abrechnung blockierte mit „Die Gebührenart
// `electricity` ist nicht zugeordnet" — für eine Angabe, die im Payload JEDER
// Buchung steht. Der Betrieb sollte sie von Hand nachtragen, obwohl das System
// sie längst geliefert bekam.
//
// NUR BOOKING.COM. Diese Komponente liest ausschließlich Bookings Daten und ist
// von keinem anderen Portal abgeleitet. Jedes Portal hat sein eigenes
// Datenmodell (CLAUDE.md: „NIE ein Portal aus einem anderen ableiten") —
// Booking liefert seine Gebühren an der BUCHUNG (`rooms[].meta`), inklusive
// Gastname, Betrag, Berechnungsart (`charge_frequency`) und Lage im Preis
// (`charge_periods[].excluded`).
//
// Rendert NICHTS, wenn nichts fehlt — der Normalfall soll keine Höhe kosten.
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { ChannelLogo } from "@/components/channel-logo";
import { formatCurrency } from "@/lib/currency";
import { feeDisplayName, type Fee } from "@/lib/pricing-meta";
import {
  getBookingGebuehren,
  uebernehmeBookingGebuehren,
} from "@/lib/properties";
import { Button } from "@nextdays/ui/button";

export function BookingGebuehrenImport({
  propertyId,
  onUebernommen,
}: {
  propertyId: string;
  /** Die neue, vollständige Gebührenliste des Objekts nach dem Schreiben. */
  onUebernommen: (fees: Fee[]) => void;
}) {
  const t = useTranslations("objects.pricingForm");
  const locale = useLocale();
  const [fehlende, setFehlende] = useState<Fee[]>([]);
  // Arten, die am Objekt SCHON stehen, aber keine Abrechnungs-Zuordnung
  // haben. Ohne sie blieb der Block stumm, sobald die Gebühr einmal
  // übernommen war — und die Abrechnung blockierte weiter (live 03.09.2026).
  const [offene, setOffene] = useState<Fee[]>([]);
  const [currency, setCurrency] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Ein Ladefehler wird ANGEZEIGT und nicht verschluckt (Wurzel 5): eine
  // Komponente, die bei jedem Fehler einfach verschwindet, ist von „nichts
  // gefunden" nicht unterscheidbar.
  const [fehler, setFehler] = useState<string | null>(null);

  const laden = useCallback(async () => {
    const res = await getBookingGebuehren(propertyId);
    if (!res.ok) {
      setFehler(res.error);
      return;
    }
    setFehler(null);
    setFehlende(res.data.items);
    setOffene(res.data.unassigned);
    setCurrency(res.data.currency);
  }, [propertyId]);

  useEffect(() => {
    void laden();
  }, [laden]);

  async function uebernehmen() {
    setBusy(true);
    const res = await uebernehmeBookingGebuehren(propertyId);
    setBusy(false);
    if (!res.ok) {
      setFehler(res.error);
      return;
    }
    setFehler(null);
    setFehlende([]);
    setOffene([]);
    onUebernommen(res.data.fees);
    toast.success(t("bookingFeesTaken", { count: res.data.uebernommen.length }));
  }

  if (fehler) {
    return <p className="mt-3 text-sm text-destructive">{fehler}</p>;
  }
  if (fehlende.length === 0 && offene.length === 0) return null;
  // Nur-Zuordnung: die Gebühren stehen schon am Objekt, es fehlt allein die
  // Angabe, wem sie gehören. Dann heißt der Knopf auch danach.
  const nurZuordnung = fehlende.length === 0;
  const zeilen = nurZuordnung ? offene : fehlende;

  return (
    <div className="mt-3 flex flex-col gap-3 rounded-(--radius) border border-border bg-secondary/30 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <ChannelLogo source="booking" className="size-5 shrink-0" />
        <span className="text-sm font-medium">
          {t(nurZuordnung ? "bookingFeesAssignTitle" : "bookingFeesTitle")}
        </span>
      </div>
      <p className="text-sm text-muted-foreground">
        {t(nurZuordnung ? "bookingFeesAssignHint" : "bookingFeesHint")}
      </p>

      <ul className="flex flex-col gap-2">
        {zeilen.map((f) => (
          <li
            key={f.id}
            className="flex flex-wrap items-baseline gap-2 rounded-(--radius) bg-background px-3 py-2"
          >
            <span className="text-sm font-medium">
              {feeDisplayName(f, locale)}
            </span>
            <span className="text-sm text-muted-foreground">
              {currency ? formatCurrency(f.amount, currency, locale) : f.amount}
              {" · "}
              {t(
                f.basis === "per_night"
                  ? "bookingFeesPerNight"
                  : "bookingFeesPerStay",
              )}
            </span>
          </li>
        ))}
      </ul>

      <Button
        className="self-start"
        disabled={busy}
        onClick={() => void uebernehmen()}
      >
        {busy ? (
          <Icon icon="ph:spinner" className="size-4 animate-spin" />
        ) : (
          <Icon icon="ph:plus" className="size-4" />
        )}
        {t(nurZuordnung ? "bookingFeesAssign" : "bookingFeesTake")}
      </Button>
    </div>
  );
}
