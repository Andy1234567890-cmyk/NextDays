"use client";

// Schwellen der Reichweiten-Verdachtsprüfung bearbeiten (0521). Jede Zeile
// speichert einzeln; ein leeres Feld = Regel aus (NULL). Die Berechtigung
// prüft der Server — hier wird für platform_support nur der Knopf versteckt.
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { datumZeit } from "@/lib/datum";
import { SCHWELLE_LABEL, type Schwelle } from "@/lib/reichweite";
import { schwelleSetzen } from "@/lib/reichweite-actions";

function Zeile({ s, darfSchreiben }: { s: Schwelle; darfSchreiben: boolean }) {
  const [wert, setWert] = useState(s.value === null ? "" : String(s.value));
  const [laeuft, starte] = useTransition();
  const geaendert = wert !== (s.value === null ? "" : String(s.value));
  return (
    <tr>
      <td className="py-2 pr-4">
        <p className="font-medium">{SCHWELLE_LABEL[s.key] ?? s.key}</p>
        <p className="text-xs text-muted-foreground">{s.description}</p>
      </td>
      <td className="py-2 pr-4">
        <input
          type="number"
          step="any"
          min={0}
          value={wert}
          disabled={!darfSchreiben}
          onChange={(e) => setWert(e.target.value)}
          placeholder="aus"
          className="w-32 rounded-full border border-border bg-transparent px-4 py-1.5 text-sm tabular-nums outline-none focus-visible:border-foreground disabled:opacity-60"
        />
      </td>
      <td className="py-2 pr-4 text-xs text-muted-foreground">{datumZeit(s.updated_at)}</td>
      <td className="py-2 text-right">
        {darfSchreiben && (
          <button
            type="button"
            disabled={laeuft || !geaendert}
            onClick={() =>
              starte(async () => {
                const n = wert.trim() === "" ? null : Number(wert.replace(",", "."));
                if (n !== null && !Number.isFinite(n)) {
                  toast.error("Keine Zahl.");
                  return;
                }
                const res = await schwelleSetzen(s.key, n);
                if (res.ok) toast.success(n === null ? "Regel ausgeschaltet." : "Schwelle gespeichert.");
                else toast.error(res.fehler);
              })
            }
            className="rounded-full bg-foreground px-4 py-1.5 text-xs font-semibold text-background disabled:opacity-40"
          >
            Speichern
          </button>
        )}
      </td>
    </tr>
  );
}

export function SchwellenFormular({ schwellen, darfSchreiben }: { schwellen: Schwelle[]; darfSchreiben: boolean }) {
  if (schwellen.length === 0) {
    return <p className="mt-3 text-sm text-accent">Keine Schwellen hinterlegt — Migration 0521 fehlt. Keine Verdachtsregel ist aktiv.</p>;
  }
  // Fachliche Reihenfolge (Regel, dann ihr „ab Followerzahl") statt alphabetisch.
  const reihenfolge = Object.keys(SCHWELLE_LABEL);
  const sortiert = [...schwellen].sort(
    (a, b) => (reihenfolge.indexOf(a.key) + 1 || 99) - (reihenfolge.indexOf(b.key) + 1 || 99),
  );
  return (
    <div className="mt-4 overflow-x-auto rounded-2xl border border-border p-5">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[0.6875rem] uppercase tracking-wide text-muted-foreground">
            <th className="pb-1 pr-4 font-semibold">Regel</th>
            <th className="pb-1 pr-4 font-semibold">Wert</th>
            <th className="pb-1 pr-4 font-semibold">Geändert</th>
            <th className="pb-1" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {sortiert.map((s) => (
            <Zeile key={s.key} s={s} darfSchreiben={darfSchreiben} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
