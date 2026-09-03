"use client";

// Preise der beauftragbaren Dienstleistungen (0531).
//
// WARUM ES DIESE MASKE BRAUCHT: Der Eigentümer bestellt im Portal eine
// Leistung, sie landet als Aufgabe beim Betrieb, und beim Abschluss entsteht
// ein Posten in seiner Abrechnung. Der Betrag kommt aus genau dieser Tabelle.
// Ohne gepflegten Preis entsteht KEIN Posten — die Leistung ist ausgeführt und
// unberechnet. Live gemeldet am 03.09.2026 an einer bestellten Endreinigung.
//
// Deshalb zeigt die Liste jeden Leistungstyp, AUCH den ohne Preis: der ist der
// Fall, in dem Geld verloren geht. Ein Typ ohne Preis trägt einen sichtbaren
// Hinweis, keine stille Leerzeile.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { Card, CardContent } from "@nextdays/ui/card";
import {
  type DienstleistungPreis,
  type DienstleistungTyp,
  deleteDienstleistungPreis,
  listDienstleistungPreise,
  setDienstleistungPreis,
} from "@/lib/tasks";

const FELD =
  "w-full rounded-xl border border-border bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-foreground";

export function DienstleistungPreise({
  properties,
}: {
  /** Für die Objekt-Ausnahme. Leer = nur Betriebsregeln möglich. */
  properties: { id: string; title: string | null }[];
}) {
  const t = useTranslations("tasks");
  // Die Namen der Leistungstypen stehen schon im Portal-Katalog (0330) — dort
  // wählt der Eigentümer sie aus. Eine zweite Kopie unter `tasks.*` hieße,
  // dass Bestellung und Preisliste denselben Typ verschieden benennen.
  const tTyp = useTranslations("portal.services.type");
  const [typen, setTypen] = useState<DienstleistungTyp[]>([]);
  const [preise, setPreise] = useState<DienstleistungPreis[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);
  const [offen, setOffen] = useState<string | null>(null);
  const [betrag, setBetrag] = useState("");
  const [waehrung, setWaehrung] = useState("");
  const [objekt, setObjekt] = useState("");
  const [laeuft, starte] = useTransition();

  const laden = useCallback(async () => {
    const res = await listDienstleistungPreise();
    if (!res.ok) {
      setFehler(res.error);
      return;
    }
    setTypen(res.data.typen);
    setPreise(res.data.preise);
    setFehler(null);
  }, []);

  useEffect(() => {
    void laden();
  }, [laden]);

  const schliessen = () => {
    setOffen(null);
    setBetrag("");
    setWaehrung("");
    setObjekt("");
  };

  const speichern = (typId: string) =>
    starte(async () => {
      // Komma UND Punkt annehmen: EU-Tastaturen schreiben „950,00".
      const zahl = Number(betrag.replace(",", "."));
      if (!Number.isFinite(zahl) || zahl < 0) {
        toast.error(t("servicePrices.amountInvalid"));
        return;
      }
      // Währung ist PFLICHT und wird nicht geraten (Wurzel 4): der Betrieb
      // kann in DKK führen und Objekte in EUR haben.
      if (waehrung.trim().length !== 3) {
        toast.error(t("servicePrices.currencyInvalid"));
        return;
      }
      const res = await setDienstleistungPreis({
        service_type_id: typId,
        property_id: objekt || null,
        amount: zahl,
        currency: waehrung.trim().toUpperCase(),
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(t("servicePrices.saved"));
      schliessen();
      await laden();
    });

  const entfernen = (preis: DienstleistungPreis) =>
    starte(async () => {
      const res = await deleteDienstleistungPreis(preis.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(t("servicePrices.removed"));
      await laden();
    });

  const objektName = (id: string | null) =>
    properties.find((p) => p.id === id)?.title ?? id ?? "";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-lg font-bold">{t("servicePrices.title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("servicePrices.intro")}
        </p>
      </div>

      {fehler && (
        <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {fehler}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {typen.map((typ) => {
          const regel = preise.find(
            (p) => p.service_type_id === typ.id && !p.property_id,
          );
          const ausnahmen = preise.filter(
            (p) => p.service_type_id === typ.id && p.property_id,
          );
          return (
            <Card key={typ.id}>
              <CardContent className="flex flex-col gap-3 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <Icon icon="ph:sparkle" className="size-4 text-muted-foreground" />
                    <span className="truncate font-medium">
                      {tTyp(typ.key)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {regel ? (
                      <span className="tabular-nums text-sm font-semibold">
                        {regel.amount.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}{" "}
                        {regel.currency}
                      </span>
                    ) : (
                      // Der Fall, in dem Geld verloren geht: sichtbar, nicht still.
                      <span className="flex items-center gap-1 text-sm text-accent">
                        <Icon icon="ph:warning-circle" className="size-4" />
                        {t("servicePrices.missing")}
                      </span>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => (offen === typ.id ? schliessen() : setOffen(typ.id))}
                    >
                      {regel
                        ? t("servicePrices.change")
                        : t("servicePrices.set")}
                    </Button>
                    {regel && (
                      <button
                        type="button"
                        disabled={laeuft}
                        onClick={() => entfernen(regel)}
                        className="text-xs text-destructive underline-offset-4 hover:underline"
                      >
                        {t("servicePrices.remove")}
                      </button>
                    )}
                  </div>
                </div>

                {ausnahmen.length > 0 && (
                  <ul className="divide-y divide-border border-t border-border text-sm">
                    {ausnahmen.map((a) => (
                      <li
                        key={a.id}
                        className="flex items-center justify-between gap-3 py-2"
                      >
                        <span className="truncate text-muted-foreground">
                          {objektName(a.property_id)}
                        </span>
                        <span className="flex items-center gap-3">
                          <span className="tabular-nums font-medium">
                            {a.amount.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                            })}{" "}
                            {a.currency}
                          </span>
                          <button
                            type="button"
                            disabled={laeuft}
                            onClick={() => entfernen(a)}
                            className="text-xs text-destructive underline-offset-4 hover:underline"
                          >
                            {t("servicePrices.remove")}
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                {offen === typ.id && (
                  <form
                    className="flex flex-wrap items-end gap-2 border-t border-border pt-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      speichern(typ.id);
                    }}
                  >
                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground">
                        {t("servicePrices.amount")}
                      </span>
                      <input
                        value={betrag}
                        onChange={(e) => setBetrag(e.target.value)}
                        inputMode="decimal"
                        placeholder="950,00"
                        className={`${FELD} w-32`}
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground">
                        {t("servicePrices.currency")}
                      </span>
                      <input
                        value={waehrung}
                        onChange={(e) => setWaehrung(e.target.value.toUpperCase())}
                        maxLength={3}
                        placeholder="DKK"
                        className={`${FELD} w-24`}
                      />
                    </label>
                    <label className="flex min-w-[12rem] flex-1 flex-col gap-1">
                      <span className="text-xs text-muted-foreground">
                        {t("servicePrices.scope")}
                      </span>
                      <select
                        value={objekt}
                        onChange={(e) => setObjekt(e.target.value)}
                        className={FELD}
                      >
                        <option value="">{t("servicePrices.allProperties")}</option>
                        {properties.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.title ?? p.id}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Button type="submit" size="sm" disabled={laeuft}>
                      {t("servicePrices.save")}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={schliessen}
                    >
                      {t("servicePrices.cancel")}
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
