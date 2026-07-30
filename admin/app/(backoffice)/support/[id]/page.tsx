// Alte Detail-Route: Verlauf und Antwortfeld leben jetzt in der Live-Konsole.
// Bestehende Links (Lesezeichen, Protokoll-Einträge) dürfen nicht ins Leere
// laufen — sie öffnen die Konsole mit genau dieser Konversation.
import { redirect } from "next/navigation";

export default async function TicketSeite({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/support?c=${encodeURIComponent(id)}`);
}
