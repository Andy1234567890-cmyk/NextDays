"use client";

// „Bei Airbnb sind schon Gebühren hinterlegt" — Angebot, sie zu übernehmen.
//
// WARUM: Beim Onboarding kommen über den Channel-Aggregator nur acht Felder,
// die Preis-Einstellungen sind nicht dabei. Der Betrieb hat seine Reinigungs-,
// Resort- und Haustiergebühr bei Airbnb längst gepflegt und müsste sie hier
// abtippen. Der Abruf holt sie; angelegt wird nur auf Klick, und nur was fehlt.
//
// Kein Automatismus: ein stiller Import beim ersten Abruf würde die
// Preisgestaltung des Betriebs verändern, ohne dass er es merkt.

import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { ChannelLogo } from "@/components/channel-logo";
import {
  type AirbnbGebuehr,
  type AirbnbGebuehrenVergleich,
  airbnbGebuehrenUebernehmen,
  getAirbnbGebuehren,
} from "@/lib/airbnb-gebuehren";
import { formatCurrency } from "@/lib/currency";
import { FEE_BASIS_KEYS, type FeeBasis } from "@/lib/pricing-meta";
import { Button } from "@nextdays/ui/button";

/** Kurzfassung einer Gebühr: Betrag und Berechnung.
 *
 *  Die Berechnung kommt aus denselben Schlüsseln wie die Gebührenliste
 *  (`FEE_BASIS_KEYS`) — sonst stünde hier „Pro Nacht" anders formuliert als
 *  zwei Zeilen darunter, in 24 Sprachen. */
function kurz(
  fee: AirbnbGebuehr,
  waehrung: string | null | undefined,
  locale: string,
  t: (key: string) => string,
): string {
  const wert =
    fee.mode === "percent"
      ? `${fee.amount}%`
      : // Ohne Währung symbollos rendern statt zu raten (Wurzel 4).
        formatCurrency(fee.amount, waehrung ?? "", locale);
  const basis = (FEE_BASIS_KEYS[fee.basis as FeeBasis] ?? [])
    .map((key) => t(key))
    .join(" · ");
  return [fee.name, wert, basis].filter(Boolean).join(" · ");
}

export function AirbnbGebuehrenImport({
  propertyId,
  /** Bekommt die vollständige neue Gebührenliste, wie der Server sie führt. */
  onUebernommen,
  /** Ändert sich mit den Gebühren des Objekts → Vergleich neu ziehen. */
  anzahlGebuehren,
}: {
  propertyId: string;
  onUebernommen: (fees: AirbnbGebuehr[]) => void;
  anzahlGebuehren: number;
}) {
  const t = useTranslations("objects.airbnbGebuehren");
  // Die Berechnungs-Schlüssel (`pricingForm.chargeSingle` …) liegen eine Ebene
  // höher — dieselbe Quelle wie die Gebührenliste, damit die Formulierung
  // identisch ist.
  const tb = useTranslations("objects");
  const locale = useLocale();
  const [stand, setStand] = useState<AirbnbGebuehrenVergleich | null>(null);
  const [busy, setBusy] = useState(false);

  const laden = useCallback(async () => {
    const res = await getAirbnbGebuehren(propertyId);
    if (res.ok) setStand(res.data);
    // Fehler bleiben still: das ist ein Zusatzangebot, keine Pflichtangabe —
    // eine Fehlerbox über der Preisliste wäre unverhältnismässig.
  }, [propertyId]);

  useEffect(() => {
    void laden();
  }, [laden, anzahlGebuehren]);

  async function uebernehmen(): Promise<void> {
    setBusy(true);
    const res = await airbnbGebuehrenUebernehmen(propertyId);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(t("uebernommen", { anzahl: res.data.uebernommen }));
    onUebernommen(res.data.fees);
    void laden();
  }

  // Nicht verbunden, nicht lesbar oder nichts Offenes → nichts anzeigen. Ein
  // „alles gleich"-Kasten über jeder Preisseite wäre Lärm.
  if (!stand?.verbunden || !stand.stand_bekannt) return null;
  if (stand.nur_airbnb.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 rounded-(--radius) border border-border bg-secondary/40 p-4">
      <div className="flex items-start gap-2">
        <ChannelLogo source="airbnb" className="mt-0.5 size-4 shrink-0" />
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-medium">
            {t("titel", { anzahl: stand.nur_airbnb.length })}
          </p>
          <p className="text-xs text-muted-foreground">{t("hinweis")}</p>
        </div>
      </div>
      <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
        {stand.nur_airbnb.map((f) => (
          <li key={f.id} className="flex items-center gap-1.5">
            <Icon icon="ph:plus-circle" className="size-3.5 shrink-0" />
            {kurz(f, stand.waehrung, locale, tb)}
          </li>
        ))}
      </ul>
      <Button
        className="self-start"
        disabled={busy}
        onClick={() => void uebernehmen()}
      >
        {busy ? t("laeuft") : t("uebernehmen")}
      </Button>
    </div>
  );
}
