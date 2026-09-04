"use client";

// „Preise verwalten" — Modus für einen Datumsbereich setzen.
//
// Drei Modi, wie sie die grossen Anbieter führen:
//   Dynamischer Preis            der berechnete Preis gilt unverändert
//   Dynamisch mit Anpassung      derselbe Preis ± Prozent
//   Fester Preis                 ein Betrag; die Automatik lässt den Tag in Ruhe
//
// WARUM EIN BEREICH UND NICHT EIN TAG
// Der häufigste Fall ist eine Woche oder ein Ferienzeitraum, nicht ein
// einzelner Tag. Ein Dialog je Tag hiesse siebenmal dasselbe klicken — und
// wer das umgeht, indem er die globale Regel verstellt, ändert damit
// ungewollt das ganze Jahr.
import { useState } from "react";

import { Button } from "@nextdays/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@nextdays/ui/dialog";
import { Input } from "@nextdays/ui/input";
import { Label } from "@nextdays/ui/label";
import { formatCurrency } from "@/lib/currency";
import { setTagesmodus, type Tagesmodus } from "@/lib/dynamic-pricing";

/** Ein Modus mit seiner Erklärung — die Wahl braucht mehr als ein Etikett. */
const MODI: { wert: Tagesmodus; titel: string; hilfe: string }[] = [
  {
    wert: "dynamisch",
    titel: "Dynamischer Preis",
    hilfe: "Die Automatik bestimmt den Preis nach deinen Regeln.",
  },
  {
    wert: "anpassung",
    titel: "Dynamisch mit Anpassung",
    hilfe: "Der berechnete Preis, um einen Prozentsatz verschoben.",
  },
  {
    wert: "manuell",
    titel: "Fester Preis",
    hilfe: "Ein Betrag, den die Automatik nicht verändert.",
  },
];

export function DpTagesmodusDialog({
  propertyId,
  currency,
  startDatum,
  berechneterPreis,
  offen,
  onSchliessen,
  onGespeichert,
}: {
  propertyId: string;
  currency: string | null;
  /** Vorbelegung für Start und Ende (der angeklickte Tag). */
  startDatum: string;
  /** Was die Automatik für diesen Tag errechnet hat — als Vorschau. */
  berechneterPreis: number | null;
  offen: boolean;
  onSchliessen: () => void;
  onGespeichert: () => void;
}) {
  const [von, setVon] = useState(startDatum);
  const [bis, setBis] = useState(startDatum);
  const [modus, setModus] = useState<Tagesmodus>("dynamisch");
  const [anpassung, setAnpassung] = useState("10");
  const [preis, setPreis] = useState(
    berechneterPreis != null ? String(Math.round(berechneterPreis)) : "",
  );
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  // Bei jedem Öffnen auf den angeklickten Tag zurück: ein Dialog, der noch
  // den Bereich von vorhin zeigt, schreibt sonst unbemerkt woanders hin.
  const [zuletztGeoeffnet, setZuletztGeoeffnet] = useState(startDatum);
  if (offen && zuletztGeoeffnet !== startDatum) {
    setZuletztGeoeffnet(startDatum);
    setVon(startDatum);
    setBis(startDatum);
    setModus("dynamisch");
    setFehler(null);
    setPreis(
      berechneterPreis != null ? String(Math.round(berechneterPreis)) : "",
    );
  }

  const pct = Number(anpassung);
  const pctGueltig = Number.isFinite(pct) && pct >= -90 && pct <= 300;
  // Vorschau: was der Gast am Ende sähe. Ohne sie ist „+10 %" eine abstrakte
  // Zahl — mit ihr eine Entscheidung.
  const vorschau =
    modus === "anpassung" && berechneterPreis != null && pctGueltig
      ? berechneterPreis * (1 + pct / 100)
      : null;

  async function speichern() {
    setBusy(true);
    setFehler(null);
    const res = await setTagesmodus(propertyId, {
      von,
      bis,
      modus,
      adjust_pct: modus === "anpassung" ? pct : null,
      preis: modus === "manuell" ? Number(preis) : null,
    });
    setBusy(false);
    if (!res.ok) {
      setFehler(res.error);
      return;
    }
    onGespeichert();
    onSchliessen();
  }

  const bereitZumSpeichern =
    von <= bis &&
    (modus !== "anpassung" || pctGueltig) &&
    (modus !== "manuell" || (preis !== "" && Number(preis) >= 0));

  return (
    <Dialog open={offen} onOpenChange={(o) => !o && onSchliessen()}>
      <DialogContent className="max-w-md">
        <DialogTitle>Preise verwalten</DialogTitle>
        <DialogDescription>
          Gilt für jeden Tag im gewählten Zeitraum.
        </DialogDescription>

        <div className="mt-2 grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dp-von">Von</Label>
            <Input
              id="dp-von"
              type="date"
              value={von}
              onChange={(e) => setVon(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dp-bis">Bis</Label>
            <Input
              id="dp-bis"
              type="date"
              value={bis}
              min={von}
              onChange={(e) => setBis(e.target.value)}
            />
          </div>
        </div>

        <fieldset className="mt-4 flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">Preis bestimmt</legend>
          {MODI.map((m) => (
            <label
              key={m.wert}
              className={
                modus === m.wert
                  ? "flex cursor-pointer gap-2.5 rounded-(--radius) border border-accent bg-accent/5 p-2.5"
                  : "flex cursor-pointer gap-2.5 rounded-(--radius) border p-2.5 hover:bg-muted/50"
              }
            >
              <input
                type="radio"
                name="dp-modus"
                className="mt-1 accent-[var(--accent)]"
                checked={modus === m.wert}
                onChange={() => setModus(m.wert)}
              />
              <span>
                <span className="text-sm font-medium">{m.titel}</span>
                <span className="block text-xs text-muted-foreground">
                  {m.hilfe}
                </span>
              </span>
            </label>
          ))}
        </fieldset>

        {modus === "anpassung" && (
          <div className="mt-3 flex flex-col gap-1.5">
            <Label htmlFor="dp-pct">Anpassung in Prozent</Label>
            <div className="flex items-center gap-2">
              <Input
                id="dp-pct"
                type="number"
                min={-90}
                max={300}
                value={anpassung}
                onChange={(e) => setAnpassung(e.target.value)}
                className="w-28"
              />
              <span className="text-sm text-muted-foreground">%</span>
              {vorschau != null && (
                <span className="text-sm">
                  {formatCurrency(berechneterPreis ?? 0, currency)} →{" "}
                  <span className="font-semibold">
                    {formatCurrency(vorschau, currency)}
                  </span>
                </span>
              )}
            </div>
            {!pctGueltig && (
              <p className="text-xs text-destructive">
                Erlaubt sind −90 % bis +300 %.
              </p>
            )}
          </div>
        )}

        {modus === "manuell" && (
          <div className="mt-3 flex flex-col gap-1.5">
            <Label htmlFor="dp-preis">Preis je Nacht</Label>
            <Input
              id="dp-preis"
              type="number"
              min={0}
              value={preis}
              onChange={(e) => setPreis(e.target.value)}
              className="w-40"
            />
            <p className="text-xs text-muted-foreground">
              Die Automatik lässt diese Tage unverändert, bis du wieder auf
              „Dynamischer Preis" stellst.
            </p>
          </div>
        )}

        {fehler && <p className="mt-3 text-sm text-destructive">{fehler}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onSchliessen}>
            Abbrechen
          </Button>
          <Button
            type="button"
            onClick={speichern}
            disabled={busy || !bereitZumSpeichern}
          >
            {busy ? "speichert…" : "Übernehmen"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
