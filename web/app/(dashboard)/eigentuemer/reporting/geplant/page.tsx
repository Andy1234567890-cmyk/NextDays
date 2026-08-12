// Geplante Berichte — Übersicht.
import { PlanListe } from "@/components/eigentuemer/reporting/plan-liste";
import { listSchedules } from "@/lib/owner-reporting";

export default async function GeplantePage() {
  const res = await listSchedules();
  return (
    <PlanListe
      items={res.ok ? res.data.items : []}
      loadError={res.ok ? null : res.error}
    />
  );
}
