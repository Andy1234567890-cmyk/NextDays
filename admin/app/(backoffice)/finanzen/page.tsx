// Stripe & Finanzen: Provisionen je Währung, jüngste Buchungen, Rückstände.
//
// Währungen werden GETRENNT ausgewiesen — eine Gesamtsumme über mehrere
// Währungen bräuchte einen Umrechnungskurs, den wir nicht erfinden (Wurzel 4).
import Link from "next/link";

import { formatCurrency } from "@nextdays/currency";

import { getFinanzen } from "@/lib/backoffice";

/** Cent-Betrag mit der jeweiligen Währung formatieren (nie mit €-Hardcode). */
function cent(betrag: number | null, waehrung: string | null): string {
  if (betrag == null) return "—";
  return formatCurrency(betrag / 100, waehrung, "de-DE", 2);
}

export default async function FinanzenSeite() {
  const f = await getFinanzen(50);

  return (
    <div className="px-8 py-8 lg:px-12 lg:py-12">
      <h1 className="font-sans text-[2rem] font-bold tracking-tight">
        Stripe &amp; Finanzen
      </h1>
      <p className="mt-2 text-[0.9375rem] text-muted-foreground">
        Provisionen der Plattform, je Währung getrennt.
      </p>

      {/* Kennzahlen je Währung */}
      {f.kennzahlen.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">
          Noch keine Provisionsbuchungen.
        </p>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {f.kennzahlen.map((k) => (
            <div key={k.currency} className="rounded-2xl border border-border p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {k.currency}
              </p>
              <p className="mt-2 font-sans text-2xl font-bold tracking-tight">
                {cent(k.fee_amount_cents, k.currency)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Provision aus {cent(k.gross_amount_cents, k.currency)} Volumen
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                {k.fee_count} Buchungen
                {k.reversed_amount_cents > 0 &&
                  ` · ${cent(k.reversed_amount_cents, k.currency)} erstattet`}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Betriebs-Status */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-border p-6">
          <p className="text-sm text-muted-foreground">
            Betriebe ohne Zahlungsfreigabe
          </p>
          <p className="mt-2 font-sans text-2xl font-bold tracking-tight">
            {f.tenants_ohne_zahlung}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Können nicht veröffentlichen — Stripe-Onboarding offen.
          </p>
        </div>
        <div className="rounded-2xl border border-border p-6">
          <p className="text-sm text-muted-foreground">Abos</p>
          {Object.keys(f.abos).length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Keine Abos.</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {Object.entries(f.abos).map(([status, anzahl]) => (
                <li key={status} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{status}</span>
                  <span className="font-medium">{anzahl}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Jüngste Provisionsbuchungen */}
      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Letzte Provisionsbuchungen
        </h2>
        {f.letzte.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Keine Einträge.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[52rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 pr-4 font-semibold">Datum</th>
                  <th className="pb-2 pr-4 font-semibold">Betrieb</th>
                  <th className="pb-2 pr-4 font-semibold">Volumen</th>
                  <th className="pb-2 pr-4 font-semibold">Provision</th>
                  <th className="pb-2 pr-4 font-semibold">Satz</th>
                  <th className="pb-2 pr-4 font-semibold">Gateway</th>
                  <th className="pb-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {f.letzte.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap py-3 pr-4 text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString("de-DE")}
                    </td>
                    <td className="py-3 pr-4">
                      <Link
                        href={`/betriebe/${r.tenant_id}`}
                        className="underline-offset-4 hover:underline"
                      >
                        {r.tenant_name ?? r.tenant_id}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      {cent(r.gross_amount_cents, r.currency)}
                    </td>
                    <td className="py-3 pr-4 font-medium">
                      {cent(r.fee_amount_cents, r.currency)}
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      {r.fee_bps != null ? `${r.fee_bps / 100} %` : "—"}
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      {r.gateway ?? "—"}
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {r.status ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
