// Ticket-Detail: Eckdaten, Verlauf (inkl. interner Notizen) und Antwortfeld.
import Link from "next/link";
import { notFound } from "next/navigation";

import { ApiError } from "@/lib/api-server";
import { getTicket } from "@/lib/backoffice";

import { TicketVerlauf } from "@/components/ticket-verlauf";

export default async function TicketSeite({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let ticket;
  try {
    ticket = await getTicket(id);
  } catch (exc) {
    if (exc instanceof ApiError && exc.status === 404) notFound();
    throw exc;
  }

  const zeilen: { label: string; wert: React.ReactNode }[] = [
    {
      label: "Melder",
      // Die Auth-Welten bleiben getrennt benannt (Betrieb vs. Plattform-Gast).
      wert: ticket.tenant_id ? (
        <Link
          href={`/betriebe/${ticket.tenant_id}`}
          className="underline-offset-4 hover:underline"
        >
          {ticket.tenant_name ?? ticket.tenant_id}
        </Link>
      ) : ticket.reporter_guest_id ? (
        "Plattform-Gast"
      ) : (
        "—"
      ),
    },
    { label: "Thema", wert: ticket.category ?? "—" },
    {
      label: "Priorität",
      // Serverseitig aus dem Thema abgeleitet — der Melder setzt sie nicht.
      wert:
        { urgent: "Dringend", high: "Hoch", normal: "Normal", low: "Niedrig" }[
          ticket.priority
        ] ?? ticket.priority,
    },
    {
      label: "Erstellt",
      wert: new Date(ticket.created_at).toLocaleString("de-DE"),
    },
    { label: "Buchung", wert: ticket.reservation_id ?? "—" },
    { label: "Objekt", wert: ticket.property_id ?? "—" },
  ];

  return (
    <div className="px-8 py-8 lg:px-12 lg:py-12">
      <Link
        href="/support"
        className="text-sm font-semibold text-muted-foreground underline-offset-4 hover:underline"
      >
        ← Support
      </Link>
      <h1 className="mt-4 max-w-3xl font-sans text-[2rem] font-bold tracking-tight">
        {ticket.subject}
      </h1>

      <div className="mt-6 max-w-2xl divide-y divide-border rounded-2xl border border-border">
        {zeilen.map((z) => (
          <div
            key={z.label}
            className="flex items-baseline justify-between gap-4 px-5 py-3"
          >
            <span className="text-sm text-muted-foreground">{z.label}</span>
            <span className="text-sm font-medium">{z.wert}</span>
          </div>
        ))}
      </div>

      <div className="max-w-3xl">
        <TicketVerlauf
          ticketId={ticket.id}
          status={ticket.status}
          nachrichten={ticket.messages}
        />
      </div>
    </div>
  );
}
