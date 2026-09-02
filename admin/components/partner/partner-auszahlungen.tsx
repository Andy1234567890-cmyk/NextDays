"use client";

// Auszahlungsliste mit Lauf, CSV-Export, Bestätigung und Gutschrift.
// Der Export setzt die gewählten Zeilen auf „in Bearbeitung" — wer die CSV
// geladen hat, hat die Überweisung in der Hand.
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { datum } from "@/lib/datum";
import type { Auszahlung } from "@/lib/partner";
import {
  auszahlungBezahlt,
  auszahlungFehlgeschlagen,
  auszahlungenExport,
  auszahlungslaufStarten,
  gutschriftLesen,
} from "@/lib/partner-actions";

const STATUS_LABEL: Record<Auszahlung["status"], string> = {
  pending: "Offen",
  processing: "In Bearbeitung",
  paid: "Bezahlt",
  failed: "Fehlgeschlagen",
};

function herunterladen(name: string, inhalt: string, typ: string) {
  const blob = new Blob([inhalt], { type: typ });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function PartnerAuszahlungen({
  zahlungen,
  darfEntscheiden,
}: {
  zahlungen: Auszahlung[];
  darfEntscheiden: boolean;
}) {
  const [laeuft, starte] = useTransition();
  const [gewaehlt, setGewaehlt] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setGewaehlt((alt) => {
      const neu = new Set(alt);
      if (neu.has(id)) neu.delete(id);
      else neu.add(id);
      return neu;
    });
  }

  function exportieren(format: "wise" | "sepa" | "paypal") {
    const ids = zahlungen
      .filter((z) => gewaehlt.has(z.id) && z.method === format && z.status !== "paid")
      .map((z) => z.id);
    if (ids.length === 0) {
      toast.error(`Keine offene ${format.toUpperCase()}-Auszahlung ausgewählt.`);
      return;
    }
    starte(async () => {
      const res = await auszahlungenExport(format, ids);
      if (res.ok) {
        herunterladen(`partner-auszahlung-${format}.csv`, res.data, "text/csv;charset=utf-8");
        toast.success(`${ids.length} Auszahlung(en) exportiert — Status „in Bearbeitung".`);
      } else toast.error(res.fehler);
    });
  }

  function bezahlt(z: Auszahlung) {
    const ref = window.prompt(`Referenz der Überweisung für ${z.statement_no ?? z.id}:`);
    if (!ref || !ref.trim()) return;
    starte(async () => {
      const res = await auszahlungBezahlt(z.id, ref.trim());
      if (res.ok) toast.success("Als bezahlt bestätigt — Mail an den Partner ist raus.");
      else toast.error(res.fehler);
    });
  }

  function fehlgeschlagen(z: Auszahlung) {
    const grund = window.prompt("Grund (die Provisionen werden wieder frei):");
    if (!grund || grund.trim().length < 3) return;
    starte(async () => {
      const res = await auszahlungFehlgeschlagen(z.id, grund.trim());
      if (res.ok) toast.success("Als fehlgeschlagen markiert.");
      else toast.error(res.fehler);
    });
  }

  function gutschrift(z: Auszahlung) {
    starte(async () => {
      const res = await gutschriftLesen(z.id);
      if (res.ok) herunterladen(`${z.statement_no ?? z.id}.txt`, res.data, "text/plain;charset=utf-8");
      else toast.error(res.fehler);
    });
  }

  return (
    <>
      {darfEntscheiden && (
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={laeuft}
            onClick={() =>
              starte(async () => {
                const res = await auszahlungslaufStarten();
                if (res.ok) toast.success(`Lauf: ${res.data.angelegt} angelegt, ${res.data.unter_minimum} unter Minimum, ${res.data.gesperrt} gesperrt.`);
                else toast.error(res.fehler);
              })
            }
            className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background disabled:opacity-50"
          >
            Lauf jetzt ausführen
          </button>
          {(["wise", "sepa", "paypal"] as const).map((f) => (
            <button
              key={f}
              type="button"
              disabled={laeuft || gewaehlt.size === 0}
              onClick={() => exportieren(f)}
              className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold hover:border-foreground disabled:opacity-50"
            >
              CSV {f.toUpperCase()}
            </button>
          ))}
        </div>
      )}

      {zahlungen.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">Keine Auszahlungen in dieser Ansicht.</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[60rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="pb-2 pr-3" />
                <th className="pb-2 pr-4 font-semibold">Gutschrift</th>
                <th className="pb-2 pr-4 font-semibold">Partner</th>
                <th className="pb-2 pr-4 font-semibold">Betrag</th>
                <th className="pb-2 pr-4 font-semibold">Weg</th>
                <th className="pb-2 pr-4 font-semibold">Zeitraum</th>
                <th className="pb-2 pr-4 font-semibold">Status</th>
                <th className="pb-2 font-semibold">Aktion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {zahlungen.map((z) => (
                <tr key={z.id}>
                  <td className="py-2.5 pr-3">
                    {z.status !== "paid" && darfEntscheiden && (
                      <input type="checkbox" checked={gewaehlt.has(z.id)} onChange={() => toggle(z.id)} className="size-4" />
                    )}
                  </td>
                  <td className="py-2.5 pr-4 font-mono text-xs">{z.statement_no ?? "—"}</td>
                  <td className="py-2.5 pr-4">
                    <Link href={`/partner/${z.affiliate_id}`} className="font-mono text-xs underline-offset-4 hover:underline">
                      {z.affiliate_id.slice(0, 8)}…
                    </Link>
                  </td>
                  <td className="py-2.5 pr-4 font-medium">
                    {z.amount} {z.currency}
                  </td>
                  <td className="py-2.5 pr-4 uppercase text-muted-foreground">{z.method}</td>
                  <td className="py-2.5 pr-4 text-muted-foreground">
                    {datum(z.period_from)} – {datum(z.period_to)}
                  </td>
                  <td className="py-2.5 pr-4">
                    {STATUS_LABEL[z.status]}
                    {z.external_ref && <span className="text-muted-foreground"> · {z.external_ref}</span>}
                    {z.failed_reason && <p className="text-xs text-muted-foreground">{z.failed_reason}</p>}
                  </td>
                  <td className="py-2.5">
                    <div className="flex gap-3 text-xs">
                      <button type="button" disabled={laeuft} onClick={() => gutschrift(z)} className="underline-offset-4 hover:underline">
                        Gutschrift
                      </button>
                      {darfEntscheiden && z.status !== "paid" && z.status !== "failed" && (
                        <>
                          <button type="button" disabled={laeuft} onClick={() => bezahlt(z)} className="underline-offset-4 hover:underline">
                            bezahlt
                          </button>
                          <button type="button" disabled={laeuft} onClick={() => fehlgeschlagen(z)} className="underline-offset-4 hover:underline">
                            fehlgeschlagen
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
