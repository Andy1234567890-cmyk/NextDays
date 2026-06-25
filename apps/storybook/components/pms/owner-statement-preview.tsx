// PMS-Baustein: Eigentümer-Abrechnung als A4-Beleg (Präsentation).
// Spiegelt das Layout des PDF-/Vorschau-Belegs: Aussteller (PM) + Eigentümer,
// Vermietungs-Aktivität, Provision je Objekt, Mehrwährung (Owner-Auszahlung in
// Owner-Währung mit Tageskurs), Verwaltungsanteil je Quellwährung.
type Row = {
  guest: string;
  nights: number;
  listing: string;
  channel: string;
  totalPrice: number;
  payout: number;
  ownerPayout: number; // Quellwährung
  currency: string; // Quellwährung
  ownerConverted: number; // Owner-Währung
  fxRate: number;
  fxDate: string;
};

export type OwnerStatement = {
  pmName: string;
  pmAddress: string;
  pmTaxId: string;
  ownerName: string;
  ownerCurrency: string; // Zielwährung
  periodFrom: string;
  periodTo: string;
  rows: Row[];
};

function fmt(amount: number, currency: string): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency }).format(
    amount,
  );
}

export function OwnerStatementPreview({ st }: { st: OwnerStatement }) {
  const mixed = st.rows.some((r) => r.currency !== st.ownerCurrency);
  const ownerTotal = st.rows.reduce((s, r) => s + r.ownerConverted, 0);
  // Verwaltungsanteil je Quellwährung (keine Mischsumme).
  const pmByCur = new Map<string, number>();
  for (const r of st.rows) {
    pmByCur.set(r.currency, (pmByCur.get(r.currency) ?? 0) + (r.payout - r.ownerPayout));
  }

  return (
    <div className="mx-auto w-[48rem] rounded-(--radius) border border-border bg-white p-10 text-[0.75rem] text-foreground shadow-sm">
      <h1 className="font-display text-2xl font-extrabold">Eigentümer-Abrechnung</h1>
      <p className="mb-6 text-muted-foreground">
        Zeitraum {st.periodFrom} – {st.periodTo}
      </p>

      <div className="mb-7 flex justify-between gap-10">
        <div className="w-1/2">
          <h3 className="mb-1.5 text-[0.65rem] font-semibold uppercase text-muted-foreground">
            Aussteller
          </h3>
          <p className="font-semibold">{st.pmName}</p>
          <p>{st.pmAddress}</p>
          <p>USt-IdNr.: {st.pmTaxId}</p>
        </div>
        <div className="w-1/2">
          <h3 className="mb-1.5 text-[0.65rem] font-semibold uppercase text-muted-foreground">
            Eigentümer
          </h3>
          <p className="font-semibold">{st.ownerName}</p>
        </div>
      </div>

      <div className="mb-2 text-[0.8rem] font-bold">Vermietungs-Aktivität</div>
      <table className="mb-6 w-full border-collapse">
        <thead>
          <tr className="border-b border-border text-left text-[0.6rem] uppercase text-muted-foreground">
            <th className="p-1.5">Gast</th>
            <th className="p-1.5">Nächte</th>
            <th className="p-1.5">Objekt</th>
            <th className="p-1.5">Kanal</th>
            <th className="p-1.5 text-right">Gesamtpreis</th>
            <th className="p-1.5 text-right">Eigentümer-Auszahlung</th>
          </tr>
        </thead>
        <tbody>
          {st.rows.map((r, i) => (
            <tr key={i} className="border-b border-border/50">
              <td className="p-1.5">{r.guest}</td>
              <td className="p-1.5">{r.nights}</td>
              <td className="p-1.5">{r.listing}</td>
              <td className="p-1.5">{r.channel}</td>
              <td className="p-1.5 text-right">{fmt(r.totalPrice, r.currency)}</td>
              <td className="p-1.5 text-right">
                {fmt(r.ownerConverted, st.ownerCurrency)}
                {r.currency !== st.ownerCurrency && (
                  <div className="text-[0.55rem] text-muted-foreground">
                    {fmt(r.ownerPayout, r.currency)} · Kurs {r.fxRate} ({r.fxDate})
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="ml-auto w-72">
        {mixed &&
          [...pmByCur.entries()].map(([cur, amt]) => (
            <div key={cur} className="flex justify-between py-0.5">
              <span>Verwaltungs-Auszahlung ({cur})</span>
              <span>{fmt(amt, cur)}</span>
            </div>
          ))}
        <div className="mt-1 flex justify-between border-t-2 border-foreground pt-2 text-[0.85rem] font-bold">
          <span>Eigentümer-Auszahlung ({st.ownerCurrency})</span>
          <span>{fmt(ownerTotal, st.ownerCurrency)}</span>
        </div>
      </div>
    </div>
  );
}
