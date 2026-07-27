// Eine Buchung mit beiden Seiten: links der Betrieb und sein Objekt, rechts
// der Gast und was er gezahlt hat.
//
// Das ist die Sicht für den Streitfall. Sie zeigt Kontaktdaten eines fremden
// Mandanten — deshalb protokolliert der Server jeden Aufruf mit tenant_id.
import Link from "next/link";
import { notFound } from "next/navigation";

import { formatCurrency } from "@nextdays/currency";

import { RealtimeRefresh } from "@/components/realtime-refresh";
import { getBuchung } from "@/lib/backoffice";

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

const KANAL: Record<string, string> = {
  direct: "Direkt",
  marketplace: "Plattform",
  booking: "Booking.com",
  airbnb: "Airbnb",
  expedia: "Expedia",
  ota: "Portale",
};

const ZAHLUNGSART: Record<string, string> = {
  deposit: "Anzahlung",
  balance: "Restzahlung",
  full: "Vollzahlung",
  refund: "Erstattung",
  addon: "Zusatzleistung",
};

function tag(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function zeitpunkt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Betrag mit der Währung DES DATENSATZES — nie ein erfundener Ersatz. */
function betrag(wert: string | null, waehrung: string | null): string {
  if (wert == null) return "—";
  return formatCurrency(Number(wert), waehrung, "de-DE", 2);
}

function cent(wert: number | null, waehrung: string | null): string {
  if (wert == null) return "—";
  return formatCurrency(wert / 100, waehrung, "de-DE", 2);
}

/** Eine Zeile im Datenblock. Leere Werte als „—", nie als 0 oder Fantasie. */
function Zeile({ label, wert }: { label: string; wert: string | null }) {
  return (
    <div className="flex justify-between gap-4 py-2">
      <dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm font-medium">{wert || "—"}</dd>
    </div>
  );
}

function Block({
  titel,
  hinweis,
  children,
}: {
  titel: string;
  hinweis?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border p-6">
      <h2 className="font-sans text-lg font-bold tracking-tight">{titel}</h2>
      {hinweis && (
        <p className="mt-1 text-xs text-muted-foreground">{hinweis}</p>
      )}
      <dl className="mt-4 divide-y divide-border">{children}</dl>
    </section>
  );
}

export default async function BuchungSeite({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let b;
  try {
    b = await getBuchung(id);
  } catch {
    notFound();
  }

  const anschrift = [
    b.objekt.street,
    [b.objekt.postal_code, b.objekt.city].filter(Boolean).join(" "),
    b.objekt.country,
  ]
    .filter(Boolean)
    .join(", ");

  const belegung = [
    `${b.adults} Erw.`,
    b.children > 0 && `${b.children} Kinder`,
    b.infants > 0 && `${b.infants} Kleinkinder`,
    b.pets > 0 && `${b.pets} Haustiere`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="px-8 py-8 lg:px-12 lg:py-12">
      <RealtimeRefresh table="reservations" filter={`id=eq.${b.id}`} />
      <RealtimeRefresh table="payments" filter={`reservation_id=eq.${b.id}`} />

      <Link
        href="/buchungen"
        className="text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        ← Buchungen
      </Link>

      <div className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <h1 className="font-sans text-[2rem] font-bold tracking-tight">
          {b.property_title ?? "Objekt ohne Titel"}
        </h1>
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
          {STATUS[b.status] ?? b.status}
        </span>
      </div>
      <p className="mt-2 text-[0.9375rem] text-muted-foreground">
        {tag(b.check_in)} – {tag(b.check_out)} · {b.naechte}{" "}
        {b.naechte === 1 ? "Nacht" : "Nächte"} ·{" "}
        {KANAL[b.channel] ?? b.channel}
      </p>

      {b.cancelled_at && (
        <div className="mt-6 rounded-2xl border border-rose-500/30 bg-rose-500/5 p-5">
          <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">
            Storniert am {zeitpunkt(b.cancelled_at)}
          </p>
          {b.cancel_reason && (
            <p className="mt-1 text-sm text-muted-foreground">
              {b.cancel_reason}
            </p>
          )}
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* --- Seite Betrieb --- */}
        <Block
          titel="Betrieb & Objekt"
          hinweis="Ein Objekt ist genau eine buchbare Einheit."
        >
          <Zeile label="Betrieb" wert={b.tenant_name} />
          <Zeile label="Objekt" wert={b.objekt.title} />
          <Zeile label="Anschrift" wert={anschrift} />
          <Zeile label="Objektstatus" wert={b.objekt.status} />
          <Zeile
            label="Max. Gäste"
            wert={b.objekt.max_guests ? String(b.objekt.max_guests) : null}
          />
          <div className="pt-2">
            <Link
              href={`/betriebe/${b.tenant_id}`}
              className="text-sm font-semibold underline-offset-4 hover:underline"
            >
              Betrieb öffnen →
            </Link>
          </div>
        </Block>

        {/* --- Seite Gast --- */}
        <Block
          titel="Gast"
          hinweis="Aus der Buchung, der Gastakte des Betriebs und dem Plattform-Konto."
        >
          <Zeile label="Name" wert={b.gast.name} />
          <Zeile label="E-Mail" wert={b.gast.email} />
          <Zeile label="Telefon" wert={b.gast.phone} />
          <Zeile label="Land" wert={b.gast.country} />
          <Zeile label="Sprache" wert={b.gast.language} />
          <Zeile label="Firma" wert={b.gast.company} />
          <Zeile label="Belegung" wert={belegung} />
          <Zeile
            label="Aufenthalte beim Betrieb"
            wert={
              b.gast.stays_count != null ? String(b.gast.stays_count) : null
            }
          />
          <Zeile
            label="Plattform-Konto"
            wert={
              b.gast.portal_guest_id
                ? `seit ${tag(b.gast.portal_registered_at)}`
                : "kein Konto"
            }
          />
        </Block>

        {/* --- Vorgang --- */}
        <Block titel="Vorgang">
          <Zeile label="Gebucht am" wert={zeitpunkt(b.created_at)} />
          <Zeile label="Kanal" wert={KANAL[b.channel] ?? b.channel} />
          <Zeile label="Angereist" wert={zeitpunkt(b.checked_in_at)} />
          <Zeile label="Abgereist" wert={zeitpunkt(b.checked_out_at)} />
          <Zeile label="Portal" wert={b.ota_name} />
          <Zeile label="Referenz beim Portal" wert={b.external_ref} />
          <Zeile label="Notiz" wert={b.note} />
        </Block>

        {/* --- Geld --- */}
        <Block titel="Beträge">
          <Zeile label="Gesamt" wert={betrag(b.total_amount, b.currency)} />
          <Zeile label="Bezahlt" wert={betrag(b.paid_amount, b.currency)} />
          <Zeile
            label="Offen"
            wert={betrag(
              String(Number(b.total_amount) - Number(b.paid_amount)),
              b.currency,
            )}
          />
          <Zeile
            label="Portalgebühr"
            wert={betrag(b.channel_fee, b.currency)}
          />
          <Zeile
            label="Zahlungsstatus"
            wert={ZAHLUNG[b.payment_status] ?? b.payment_status}
          />
        </Block>
      </div>

      {/* --- Zahlungsverlauf --- */}
      <section className="mt-6 rounded-2xl border border-border p-6">
        <h2 className="font-sans text-lg font-bold tracking-tight">
          Zahlungen
        </h2>
        {b.zahlungen.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Keine Zahlungsbewegungen erfasst.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 pr-4 font-semibold">Datum</th>
                  <th className="pb-2 pr-4 font-semibold">Art</th>
                  <th className="pb-2 pr-4 font-semibold">Anbieter</th>
                  <th className="pb-2 pr-4 font-semibold">Status</th>
                  <th className="pb-2 text-right font-semibold">Betrag</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {b.zahlungen.map((z) => (
                  <tr key={z.id}>
                    <td className="py-3 pr-4 text-muted-foreground">
                      {zeitpunkt(z.created_at)}
                    </td>
                    <td className="py-3 pr-4">
                      {z.type ? (ZAHLUNGSART[z.type] ?? z.type) : "—"}
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      {z.gateway ?? "—"}
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      {z.status ?? "—"}
                    </td>
                    <td className="py-3 text-right font-medium tabular-nums">
                      {betrag(z.amount, z.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* --- Unsere Provision --- */}
      <section className="mt-6 rounded-2xl border border-border p-6">
        <h2 className="font-sans text-lg font-bold tracking-tight">
          Provision der Plattform
        </h2>
        {b.provisionen.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Keine Provision auf diese Buchung.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 pr-4 font-semibold">Datum</th>
                  <th className="pb-2 pr-4 font-semibold">Satz</th>
                  <th className="pb-2 pr-4 font-semibold">Anbieter</th>
                  <th className="pb-2 pr-4 font-semibold">Status</th>
                  <th className="pb-2 pr-4 text-right font-semibold">Volumen</th>
                  <th className="pb-2 text-right font-semibold">Provision</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {b.provisionen.map((p) => (
                  <tr key={p.id}>
                    <td className="py-3 pr-4 text-muted-foreground">
                      {zeitpunkt(p.created_at)}
                    </td>
                    <td className="py-3 pr-4 tabular-nums">
                      {p.fee_bps != null ? `${p.fee_bps / 100} %` : "—"}
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      {p.gateway ?? "—"}
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      {p.status ?? "—"}
                    </td>
                    <td className="py-3 pr-4 text-right tabular-nums">
                      {cent(p.gross_amount_cents, p.currency)}
                    </td>
                    <td className="py-3 text-right font-medium tabular-nums">
                      {cent(p.fee_amount_cents, p.currency)}
                      {p.reversed_amount_cents != null &&
                        p.reversed_amount_cents > 0 && (
                          <p className="mt-0.5 text-xs font-normal text-muted-foreground">
                            {cent(p.reversed_amount_cents, p.currency)} erstattet
                          </p>
                        )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* --- Was der Gast gebucht hat --- */}
      {b.quote_items.length > 0 && (
        <section className="mt-6 rounded-2xl border border-border p-6">
          <h2 className="font-sans text-lg font-bold tracking-tight">
            Buchungspositionen
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Wie sie zum Zeitpunkt der Buchung festgehalten wurden.
          </p>
          <pre className="mt-4 overflow-x-auto rounded-xl bg-muted p-4 text-xs">
            {JSON.stringify(b.quote_items, null, 2)}
          </pre>
        </section>
      )}
    </div>
  );
}
