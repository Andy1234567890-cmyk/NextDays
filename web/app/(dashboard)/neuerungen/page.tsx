// Neuerungen: Historie der offiziellen Ankündigungen des Plattform-Teams.
// Server Component — die erste Seite kommt gerendert, „Ältere laden" holt den
// Rest im Client nach.
//
// Rollen-Gate mit notFound() statt redirect: ein staff/cleaner soll nicht
// erfahren, DASS es diese Route gibt (ein Redirect auf / verrät genau das).
// Die eigentliche Schranke sitzt im Backend (require_role + frische Rolle aus
// public.users) — das hier ist die UI-Seite derselben Entscheidung (Wurzel 9).
import { notFound } from "next/navigation";

import { NeuerungenListe } from "@/components/announcements/neuerungen-liste";
import { Card } from "@nextdays/ui/card";
import { listAnnouncements } from "@/lib/announcements";
import { getMe } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function NeuerungenPage() {
  const me = await getMe();
  if (me?.role !== "admin" && me?.role !== "co_admin") notFound();

  const liste = await listAnnouncements(20, 0);
  if (!liste.ok) {
    // Fehlende Berechtigung ist kein Fehler, sondern „gibt es für dich nicht".
    if (liste.status === 403 || liste.status === 401) notFound();
    // Ein technischer Fehler ist NICHT „keine Neuerungen" (Wurzel 4).
    return <Card className="p-5 text-sm text-destructive">{liste.error}</Card>;
  }

  return (
    <NeuerungenListe
      initial={liste.data.items}
      ungelesen={liste.data.ungelesen}
    />
  );
}
