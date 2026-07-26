// Eine Support-Anfrage mit Verlauf. Interne Team-Notizen filtert der Server
// heraus — sie erreichen diese Seite gar nicht erst.
import Link from "next/link";
import { notFound } from "next/navigation";

import { ApiError } from "@/lib/api-server";
import { getDebugSessions } from "@/lib/diagnose";
import { getTicket } from "@/lib/support";

import { AnfrageVerlauf } from "@/components/support/anfrage-verlauf";
import { DiagnoseFreigabe } from "@/components/support/diagnose-freigabe";

export default async function AnfrageSeite({
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

  // Laufende Diagnose-Freigabe (falls vorhanden) — der Schalter gehört dorthin,
  // wo das Problem gemeldet wird, nicht nur in die Kontoeinstellungen.
  const sessions = await getDebugSessions().catch(() => []);
  const aktiveFreigabe = sessions.find((s) => s.aktiv) ?? null;

  return (
    <div className="mx-auto max-w-3xl px-8 py-8 lg:py-12">
      <Link
        href="/support"
        className="text-sm font-semibold text-muted-foreground underline-offset-4 hover:underline"
      >
        ← Alle Anfragen
      </Link>
      <DiagnoseFreigabe aktiv={aktiveFreigabe} ticketId={ticket.id} />
      <AnfrageVerlauf ticket={ticket} />
    </div>
  );
}
