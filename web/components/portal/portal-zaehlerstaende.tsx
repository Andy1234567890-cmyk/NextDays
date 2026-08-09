"use client";

// Eigentümer-Portal · Zählerstände: Historie lesen, neuen Wert hinzufügen.
//
// APPEND-ONLY. Es gibt hier bewusst keinen Bearbeiten- und keinen Löschen-Knopf
// — und zwar nicht als UI-Geste, sondern weil ein abgelesener Stand eine
// Messung ist: eine Korrektur ist ein NEUER Eintrag, damit der Verlauf lückenlos
// bleibt und eine Abrechnung nachvollziehbar ist. Der Contract kennt für
// meter_readings weder PATCH noch DELETE.
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { PortalRealtime } from "@/components/portal/portal-realtime";
import { Button } from "@nextdays/ui/button";
import { Card, CardContent } from "@nextdays/ui/card";
import { Input } from "@nextdays/ui/input";
import { Label } from "@nextdays/ui/label";
import { NativeSelect } from "@nextdays/ui/native-select";
import {
  type MeterReading,
  type PortalProperty,
  createMeterReading,
  getMeterReadings,
} from "@/lib/portal";

const DATUM_RE = /^\d{4}-\d{2}-\d{2}$/;

function gueltigesDatum(s: string): boolean {
  if (!DATUM_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return false;
  return d.toISOString().slice(0, 10) === s;
}

// Zählerarten des Contracts (meter_kind). Die Labels liegen unter
// portal.meter.kinds.* und sind in allen 24 Sprachen vorhanden.
const ARTEN = ["electricity", "water", "gas"] as const;

export function PortalZaehlerstaende({
  properties,
  error,
}: {
  properties: PortalProperty[];
  error: string | null;
}) {
  const t = useTranslations("portal");
  const locale = useLocale();

  const [propertyId, setPropertyId] = useState(properties[0]?.id ?? "");
  const [art, setArt] = useState<string>(ARTEN[0]);
  const [wert, setWert] = useState("");
  const [abgelesenAm, setAbgelesenAm] = useState("");
  const [liste, setListe] = useState<MeterReading[] | null>(null);
  const [ladeFehler, setLadeFehler] = useState<string | null>(null);
  const [sendet, setSendet] = useState(false);

  const laden = useCallback(async () => {
    if (!propertyId) {
      setListe([]);
      return;
    }
    const res = await getMeterReadings(propertyId);
    if (res.ok) {
      setListe(res.data.items);
      setLadeFehler(null);
    } else {
      setListe(null);
      setLadeFehler(res.error);
    }
  }, [propertyId]);

  useEffect(() => {
    void laden();
  }, [laden]);

  const speichern = async () => {
    if (sendet || !propertyId) return;
    const zahl = Number(wert.replace(",", "."));
    if (!wert.trim() || Number.isNaN(zahl) || zahl < 0) {
      toast.error(t("meter.invalidValue"));
      return;
    }
    if (!gueltigesDatum(abgelesenAm)) {
      toast.error(t("meter.invalidDate"));
      return;
    }
    setSendet(true);
    const res = await createMeterReading({
      property_id: propertyId,
      meter_kind: art,
      value: zahl,
      read_at: abgelesenAm,
    });
    setSendet(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(t("meter.saved"));
    setWert("");
    setAbgelesenAm("");
    // Kein manuelles Nachladen — das Abo auf meter_readings liefert den neuen
    // Eintrag.
  };

  return (
    <div className="flex flex-col gap-6">
      <PortalRealtime quellen={["meter_readings"]} onChange={() => void laden()} />

      <header className="flex flex-col gap-1">
        <h1 className="font-display text-3xl font-extrabold">
          {t("meter.title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("meter.hint")}</p>
      </header>

      {(error || ladeFehler) && (
        <div className="rounded-(--radius) border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error ?? ladeFehler}
        </div>
      )}

      {properties.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
              <Icon icon="ph:house-line" className="size-6" />
            </span>
            <p className="text-sm text-muted-foreground">
              {t("properties.empty")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="flex flex-col gap-4 py-5">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="zaehler-objekt">{t("meter.property")}</Label>
                  <NativeSelect
                    id="zaehler-objekt"
                    value={propertyId}
                    onChange={(e) => setPropertyId(e.target.value)}
                  >
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="zaehler-art">{t("meter.kind")}</Label>
                  <NativeSelect
                    id="zaehler-art"
                    value={art}
                    onChange={(e) => setArt(e.target.value)}
                  >
                    {ARTEN.map((a) => (
                      <option key={a} value={a}>
                        {t(`meter.kinds.${a}`)}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="zaehler-wert">{t("meter.value")}</Label>
                  <Input
                    id="zaehler-wert"
                    inputMode="decimal"
                    value={wert}
                    onChange={(e) => setWert(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="zaehler-datum">{t("meter.readAt")}</Label>
                  <Input
                    id="zaehler-datum"
                    type="date"
                    value={abgelesenAm}
                    onChange={(e) => setAbgelesenAm(e.target.value)}
                  />
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                {t("meter.appendOnlyHint")}
              </p>

              <div>
                <Button
                  type="button"
                  onClick={() => void speichern()}
                  disabled={sendet || !propertyId || !wert || !abgelesenAm}
                >
                  {sendet ? t("meter.saving") : t("meter.submit")}
                </Button>
              </div>
            </CardContent>
          </Card>

          <section className="flex flex-col gap-3">
            <h2 className="font-display text-xl font-extrabold">
              {t("meter.historyTitle")}
            </h2>
            {liste !== null && liste.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                  <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                    <Icon icon="ph:gauge" className="size-6" />
                  </span>
                  <p className="text-sm text-muted-foreground">
                    {t("meter.historyEmpty")}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <ul className="flex flex-col divide-y divide-border rounded-(--radius) border border-border">
                {(liste ?? []).map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center gap-4 p-4">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                      <Icon icon="ph:gauge" className="size-5" />
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium">
                        {ARTEN.includes(m.meter_kind as (typeof ARTEN)[number])
                          ? t(`meter.kinds.${m.meter_kind}`)
                          : m.meter_kind}
                      </span>
                      {/* Ablesedatum = der Zeitpunkt der MESSUNG, nicht
                          created_at (unsere Verarbeitungszeit, Wurzel 5b). */}
                      <span className="truncate text-xs text-muted-foreground">
                        {m.read_at}
                      </span>
                    </div>
                    <span className="shrink-0 text-sm font-semibold">
                      {new Intl.NumberFormat(locale).format(m.value)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
