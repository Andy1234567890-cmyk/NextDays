// Reisebüro-/Partner-Kartei (Liste). Server Component lädt die Partner.
import { notFound } from "next/navigation";

import { AgenciesList } from "@/components/reisebueros/agencies-list";
import { Card } from "@nextdays/ui/card";
import { listAgencies } from "@/lib/travel-agencies";

export const dynamic = "force-dynamic";

export default async function AgenciesPage() {
  const res = await listAgencies(undefined, true);
  if (!res.ok) {
    // Fehlende Berechtigung (manage_partners) ist kein Fehler, sondern „gibt es
    // für dich nicht" — die Sidebar blendet den Eintrag ohnehin aus (Wurzel 3).
    if (res.status === 403) notFound();
    return (
      <div className="mx-auto w-full max-w-3xl p-6">
        <Card className="p-5 text-sm text-destructive">{res.error}</Card>
      </div>
    );
  }
  return (
    <>
      {/* Kein Realtime mehr: `travel_agencies` ist für authenticated bewusst
        gesperrt (Wurzel 6, Migration 0337: revoke + raus aus
        supabase_realtime), ein Abo darauf wäre eine stumme Attrappe. Eine
        offene Tabelle mit demselben Ereignis gibt es nicht. Ehrlich benannt:
        neue, geänderte oder gelöschte Partner erscheinen erst beim nächsten
        Laden der Seite — die Partner-Kartei ist Stammdaten-Pflege durch den
        Nutzer in genau dieser Oberfläche, die danach ohnehin neu lädt. */}
      <AgenciesList initial={res.data.items} />
    </>
  );
}
