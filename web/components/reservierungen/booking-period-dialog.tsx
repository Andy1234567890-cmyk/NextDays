"use client";

// Zeitraum einer Buchung ändern (verlängern/verkürzen/verschieben) — von der
// Buchungs-Detailseite aus.
//
// Warum es das gibt: `moveReservation` hing bis 24.08.2026 ausschließlich am
// Kalender-Drag. Wer eine Buchung geöffnet hatte und den Aufenthalt eines
// Gastes verlängern wollte, fand dort NICHTS — die Detailseite zeigte An- und
// Abreise, ohne einen Weg, sie zu ändern. Gemeldet vom Betrieb („ich kann
// nicht finden wo das geht").
//
// Derselbe Endpunkt wie der Kalender-Drag, dieselben Regeln serverseitig
// (Doppelbuchung, Stop-Sell, eingecheckt, OTA-Buchung) — dieser Dialog schickt
// nur den neuen Zeitraum. Das Objekt bleibt, wie es ist: ein Objektwechsel
// gehört an den Kalender, wo man die Zielzeile sieht.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@nextdays/ui/button";
import { DatePicker } from "@nextdays/ui/date-picker";
import { moveReservation } from "@/lib/reservations";

/** Nächte zwischen zwei ISO-Tagen; <= 0, wenn die Reihenfolge nicht stimmt. */
function naechte(von: string, bis: string): number {
  const a = Date.parse(`${von}T00:00:00Z`);
  const b = Date.parse(`${bis}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

export function BookingPeriodDialog({
  reservationId,
  propertyId,
  checkIn,
  checkOut,
  onClose,
  onChanged,
}: {
  reservationId: string;
  propertyId: string;
  checkIn: string;
  checkOut: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const t = useTranslations("reservations");
  const [von, setVon] = useState(checkIn);
  const [bis, setBis] = useState(checkOut);
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const anzahl = naechte(von, bis);
  const unveraendert = von === checkIn && bis === checkOut;
  const speicherbar = anzahl > 0 && !unveraendert && !busy;

  async function speichern(reprice: boolean) {
    setBusy(true);
    setFehler(null);
    console.debug("[BookingPeriodDialog] Zeitraum ändern", {
      reservationId,
      von,
      bis,
      reprice,
    });
    const res = await moveReservation(
      reservationId,
      propertyId,
      von,
      bis,
      reprice,
    );
    setBusy(false);
    if (!res.ok) {
      // Die Backend-Meldung WÖRTLICH zeigen: sie unterscheidet belegt,
      // Stop-Sell, eingecheckt, OTA-Buchung und „keiner Einheit zugeordnet".
      // Ein eigener Sammeltext machte aus fünf Ursachen eine (Wurzel 5).
      console.debug("[BookingPeriodDialog] abgelehnt", { error: res.error });
      setFehler(res.error);
      return;
    }
    onChanged();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40"
        role="presentation"
        onClick={() => !busy && onClose()}
      />
      <div className="relative z-10 flex w-full max-w-md flex-col rounded-2xl bg-card shadow-xl">
        <div className="flex items-center justify-between gap-4 border-b px-5 py-4">
          <h2 className="font-display text-lg font-extrabold">
            {t("bookingPeriod.title")}
          </h2>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onClose}
            disabled={busy}
            aria-label={t("bookingPeriod.closeAriaLabel")}
          >
            <Icon icon="ph:x" className="size-4" />
          </Button>
        </div>

        <div className="flex flex-col gap-4 px-5 py-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("bookingDetail.arrival")}
              </span>
              <DatePicker value={von} onChange={setVon} disabled={busy} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("bookingDetail.departure")}
              </span>
              <DatePicker value={bis} onChange={setBis} disabled={busy} />
            </label>
          </div>

          {anzahl > 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("bookingDetail.nightsCount", { count: anzahl })}
              {" · "}
              {t("bookingPeriod.recheck")}
            </p>
          ) : (
            <p className="text-sm text-destructive">
              {t("bookingPeriod.orderInvalid")}
            </p>
          )}

          {fehler && (
            <p className="rounded-(--radius) border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              <Icon
                icon="ph:warning-circle"
                className="mr-1.5 inline size-4 align-text-bottom"
              />
              {fehler}
            </p>
          )}

          {/* Preisverhalten (protel-Modell) — dieselbe Wahl wie am Kalender:
              der vereinbarte Preis ist bindend, das Neurechnen ist eine
              bewusste Entscheidung des Betriebs, nie ein Automatismus. */}
          <p className="text-xs text-muted-foreground">
            {t("bookingPeriod.priceHint")}
          </p>
        </div>

        <div className="flex flex-col gap-2 border-t px-5 py-4">
          <Button
            type="button"
            onClick={() => speichern(false)}
            disabled={!speicherbar}
          >
            {busy ? t("bookingPeriod.saving") : t("bookingPeriod.keepPrice")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => speichern(true)}
            disabled={!speicherbar}
          >
            {busy ? t("bookingPeriod.saving") : t("bookingPeriod.recalcPrice")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={busy}
          >
            {t("bookingDetail.cancel")}
          </Button>
        </div>
      </div>
    </div>
  );
}
