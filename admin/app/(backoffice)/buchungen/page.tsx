// Alle Buchungen der Plattform, mandantenübergreifend.
//
// Die Liste zeigt bewusst KEINE Kontaktdaten — nur der Klick ins Detail legt
// Gastdaten eines fremden Betriebs offen, und genau dieser Vorgang wird mit
// tenant_id protokolliert.
import Link from "next/link";

import { formatCurrency } from "@nextdays/currency";

import { RealtimeRefresh } from "@/components/realtime-refresh";
import { getBuchungen } from "@/lib/backoffice";

const PRO_SEITE = 50;

/** Buchungsstatus → deutsches Label. Unbekanntes bleibt roh sichtbar. */
const STATUS: Record<string, string> = {
  pending: "Offen",
  requested: "Angefragt",
  confirmed: "Bestätigt",
  completed: "Abgereist",
  cancelled: "Storniert",
  declined: "Abgelehnt",
  expired: "Verfallen",
};

const ZAHLUNG: Record<string, string> = {
  unpaid: "Offen",
  partial: "Teilweise",
  paid: "Bezahlt",
  refunded: "Erstattet",
};

/** Kanäle im Klartext — nie „Channex" im Kundentext. */
const KANAL: Record<string, string> = {
  direct: "Direkt",
  marketplace: "Plattform",
  booking: "Booking.com",
  airbnb: "Airbnb",
  expedia: "Expedia",
  ota: "Portale",
};

const STATUS_FARBE: Record<string, string> = {
  confirmed: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  completed: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  cancelled: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  declined: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  expired: "bg-muted text-muted-foreground",
  pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  requested: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

function tag(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

/** Betrag mit der Währung DER BUCHUNG — kein €-Hardcode (Wurzel 4). */
function betrag(wert: string, waehrung: string | null): string {
  return formatCurrency(Number(wert), waehrung, "de-DE", 2);
}

export default async function BuchungenSeite({
  searchParams,
}: {
  searchParams: Promise<{
    seite?: string;
    suche?: string;
    status?: string;
    kanal?: string;
  }>;
}) {
  const { seite, suche, status, kanal } = await searchParams;
  const seiteNr = Math.max(1, Number(seite) || 1);
  const liste = await getBuchungen({
    limit: PRO_SEITE,
    offset: (seiteNr - 1) * PRO_SEITE,
    suche,
    status,
    channel: kanal,
  });
  const seiten = Math.max(1, Math.ceil(liste.total / PRO_SEITE));

  return (
    <div className="px-8 py-8 lg:px-12 lg:py-12">
      <RealtimeRefresh table="reservations" />

      <h1 className="font-sans text-[2rem] font-bold tracking-tight">Buchungen</h1>
      <p className="mt-2 text-[0.9375rem] text-muted-foreground">
        {liste.total} Buchungen · Seite {seiteNr} von {seiten}
      </p>

      <form className="mt-6 flex flex-wrap gap-3" action="/buchungen">
        <input
          type="search"
          name="suche"
          defaultValue={suche ?? ""}
          placeholder="Nach Gast-E-Mail suchen"
          className="w-full max-w-xs rounded-full border border-border bg-transparent px-5 py-2.5 text-sm outline-none focus-visible:border-foreground"
        />
        <select
          name="status"
          defaultValue={status ?? ""}
          className="rounded-full border border-border bg-transparent px-5 py-2.5 text-sm outline-none focus-visible:border-foreground"
        >
          <option value="">Alle Status</option>
          {Object.entries(STATUS).map(([wert, label]) => (
            <option key={wert} value={wert}>
              {label}
            </option>
          ))}
        </select>
        <select
          name="kanal"
          defaultValue={kanal ?? ""}
          className="rounded-full border border-border bg-transparent px-5 py-2.5 text-sm outline-none focus-visible:border-foreground"
        >
          <option value="">Alle Kanäle</option>
          {Object.entries(KANAL).map(([wert, label]) => (
            <option key={wert} value={wert}>
              {label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-muted"
        >
          Filtern
        </button>
      </form>

      {liste.items.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">
          Keine Buchungen gefunden.
        </p>
      ) : (
        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[62rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="pb-2 pr-4 font-semibold">Betrieb / Objekt</th>
                <th className="pb-2 pr-4 font-semibold">Gast</th>
                <th className="pb-2 pr-4 font-semibold">Zeitraum</th>
                <th className="pb-2 pr-4 font-semibold">Kanal</th>
                <th className="pb-2 pr-4 font-semibold">Status</th>
                <th className="pb-2 pr-4 font-semibold">Zahlung</th>
                <th className="pb-2 text-right font-semibold">Betrag</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {liste.items.map((b) => (
                <tr key={b.id} className="align-top">
                  <td className="py-3 pr-4">
                    <Link
                      href={`/buchungen/${b.id}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {b.property_title ?? "Objekt ohne Titel"}
                    </Link>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {b.tenant_name ?? "—"}
                    </p>
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {b.guest_name ?? "—"}
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {tag(b.check_in)} – {tag(b.check_out)}
                    <p className="mt-0.5 text-xs">
                      {b.naechte} {b.naechte === 1 ? "Nacht" : "Nächte"}
                    </p>
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {KANAL[b.channel] ?? b.channel}
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${
                        STATUS_FARBE[b.status] ?? "bg-muted text-muted-foreground"
                      }`}
                    >
                      {STATUS[b.status] ?? b.status}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {ZAHLUNG[b.payment_status] ?? b.payment_status}
                  </td>
                  <td className="py-3 text-right font-medium tabular-nums">
                    {betrag(b.total_amount, b.currency)}
                    {Number(b.paid_amount) !== Number(b.total_amount) && (
                      <p className="mt-0.5 text-xs font-normal text-muted-foreground">
                        {betrag(b.paid_amount, b.currency)} bezahlt
                      </p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {seiten > 1 && (
        <div className="mt-8 flex items-center gap-4">
          {seiteNr > 1 && (
            <Link
              href={`/buchungen?seite=${seiteNr - 1}${suche ? `&suche=${suche}` : ""}${status ? `&status=${status}` : ""}${kanal ? `&kanal=${kanal}` : ""}`}
              className="rounded-full border border-border px-5 py-2 text-sm font-semibold transition-colors hover:bg-muted"
            >
              Zurück
            </Link>
          )}
          {seiteNr < seiten && (
            <Link
              href={`/buchungen?seite=${seiteNr + 1}${suche ? `&suche=${suche}` : ""}${status ? `&status=${status}` : ""}${kanal ? `&kanal=${kanal}` : ""}`}
              className="rounded-full border border-border px-5 py-2 text-sm font-semibold transition-colors hover:bg-muted"
            >
              Weiter
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
