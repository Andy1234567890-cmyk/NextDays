"use client";

// Mindest-/Höchstpreis je Zeitraum (SiteMinder „Floor and ceiling overrides").
//
// Ein globales Min/Max reicht nicht: Hochsaison-Mindestpreis 900 und
// Nebensaison-Mindestpreis 450 ließen sich bisher nicht abbilden. Hier legt
// der Betrieb Ausnahmen an — Zeitraum, optional Wochentage, optional jährlich.
// Die spezifischste gewinnt (Server, zusatzsignale.preisgrenzen_je_tag).
//
// Speichert SOFORT je Eintrag (eigene Tabelle, nicht Teil des Sheet-Payloads):
// eine Liste, die erst mit „Speichern" ganz unten greift, verliert Einträge,
// wenn jemand das Panel schließt.
import { Icon } from "@iconify/react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";
import { Label } from "@nextdays/ui/label";
import { formatCurrency } from "@/lib/currency";
import {
  createPreisgrenze,
  deletePreisgrenze,
  listPreisgrenzen,
  type Preisgrenze,
} from "@/lib/dynamic-pricing";

const WOCHENTAGE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function datumKurz(iso: string, jaehrlich: boolean): string {
  const d = new Date(iso + "T00:00:00");
  return jaehrlich
    ? d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })
    : d.toLocaleDateString("de-DE");
}

export function DpPreisgrenzen({
  propertyId,
  currency,
}: {
  propertyId: string;
  currency: string | null;
}) {
  const [grenzen, setGrenzen] = useState<Preisgrenze[] | null>(null);
  const [neu, setNeu] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Formular für einen neuen Eintrag.
  const [bez, setBez] = useState("");
  const [von, setVon] = useState("");
  const [bis, setBis] = useState("");
  const [tage, setTage] = useState<number[]>([]);
  const [jaehrlich, setJaehrlich] = useState(false);
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");

  const laden = useCallback(async () => {
    const res = await listPreisgrenzen(propertyId);
    if (res.ok) setGrenzen(res.data);
    else setFehler(res.error);
  }, [propertyId]);

  useEffect(() => {
    void laden();
  }, [laden]);

  async function anlegen() {
    setBusy(true);
    setFehler(null);
    const res = await createPreisgrenze(propertyId, {
      bezeichnung: bez.trim(),
      von,
      bis,
      wochentage: tage.length > 0 && tage.length < 7 ? [...tage].sort() : null,
      jaehrlich,
      min_price: min === "" ? null : Number(min),
      max_price: max === "" ? null : Number(max),
    });
    setBusy(false);
    if (!res.ok) {
      setFehler(res.error);
      return;
    }
    setNeu(false);
    setBez("");
    setVon("");
    setBis("");
    setTage([]);
    setJaehrlich(false);
    setMin("");
    setMax("");
    await laden();
  }

  async function loeschen(id: string) {
    setBusy(true);
    const res = await deletePreisgrenze(propertyId, id);
    setBusy(false);
    if (!res.ok) {
      setFehler(res.error);
      return;
    }
    await laden();
  }

  const bereit =
    bez.trim().length > 0 &&
    von !== "" &&
    bis !== "" &&
    bis >= von &&
    (min !== "" || max !== "") &&
    (min === "" || max === "" || Number(max) >= Number(min));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm">Ausnahmen je Zeitraum</Label>
        {!neu && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setNeu(true)}
          >
            <Icon icon="ph:plus" className="size-4" /> Ausnahme
          </Button>
        )}
      </div>

      {grenzen === null && !fehler && (
        <p className="text-xs text-muted-foreground">lädt…</p>
      )}
      {grenzen && grenzen.length === 0 && !neu && (
        <p className="text-xs text-muted-foreground">
          Keine Ausnahmen — überall gelten Mindest- und Höchstpreis von oben.
        </p>
      )}
      {grenzen && grenzen.length > 0 && (
        <ul className="flex flex-col divide-y rounded-(--radius) border text-sm">
          {grenzen.map((g) => (
            <li key={g.id} className="flex items-center gap-3 px-3 py-2">
              <div className="min-w-0 flex-1 leading-tight">
                <span className="font-medium">{g.bezeichnung}</span>
                <span className="block text-xs text-muted-foreground">
                  {datumKurz(g.von, g.jaehrlich)} – {datumKurz(g.bis, g.jaehrlich)}
                  {g.jaehrlich && " · jährlich"}
                  {g.wochentage && ` · ${g.wochentage.map((w) => WOCHENTAGE[w]).join(", ")}`}
                </span>
              </div>
              <span className="whitespace-nowrap text-xs">
                {g.min_price !== null && <>min {formatCurrency(g.min_price, currency)}</>}
                {g.min_price !== null && g.max_price !== null && " · "}
                {g.max_price !== null && <>max {formatCurrency(g.max_price, currency)}</>}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Entfernen"
                disabled={busy}
                onClick={() => loeschen(g.id)}
              >
                <Icon icon="ph:trash" className="size-4 text-muted-foreground" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {neu && (
        <div className="flex flex-col gap-3 rounded-(--radius) border p-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pg-bez">Bezeichnung</Label>
            <Input
              id="pg-bez"
              value={bez}
              placeholder="z. B. Hochsaison, Weihnachten"
              onChange={(e) => setBez(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pg-von">Von</Label>
              <Input id="pg-von" type="date" value={von} onChange={(e) => setVon(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pg-bis">Bis</Label>
              <Input
                id="pg-bis"
                type="date"
                value={bis}
                min={von}
                onChange={(e) => setBis(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Wochentage (leer = alle)</Label>
            <div className="flex flex-wrap gap-1">
              {WOCHENTAGE.map((w, i) => {
                const an = tage.includes(i);
                return (
                  <button
                    key={w}
                    type="button"
                    onClick={() =>
                      setTage(an ? tage.filter((x) => x !== i) : [...tage, i])
                    }
                    className={`rounded-full border px-2.5 py-1 text-xs ${
                      an ? "border-accent bg-accent/10 text-accent" : "text-muted-foreground"
                    }`}
                  >
                    {w}
                  </button>
                );
              })}
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={jaehrlich}
              onChange={(e) => setJaehrlich(e.target.checked)}
              className="accent-[var(--accent)]"
            />
            Jedes Jahr wiederholen (gleiche Kalendertage)
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pg-min">{currency ? `Mindestpreis (${currency})` : "Mindestpreis"}</Label>
              <Input
                id="pg-min"
                type="number"
                min={0}
                value={min}
                placeholder="leer = keine"
                onChange={(e) => setMin(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pg-max">{currency ? `Höchstpreis (${currency})` : "Höchstpreis"}</Label>
              <Input
                id="pg-max"
                type="number"
                min={0}
                value={max}
                placeholder="leer = keine"
                onChange={(e) => setMax(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setNeu(false)}>
              Abbrechen
            </Button>
            <Button type="button" size="sm" onClick={anlegen} disabled={busy || !bereit}>
              {busy ? "speichert…" : "Ausnahme anlegen"}
            </Button>
          </div>
        </div>
      )}
      {fehler && <p className="text-xs text-destructive">{fehler}</p>}
    </div>
  );
}
