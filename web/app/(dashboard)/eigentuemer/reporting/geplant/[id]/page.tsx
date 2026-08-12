// Geplanten Bericht bearbeiten — dasselbe Formular wie beim Anlegen.
import { notFound } from "next/navigation";

import { PlanFormular } from "@/components/eigentuemer/reporting/plan-formular";
import { getSchedule, listRecipients } from "@/lib/owner-reporting";
import { ladeReportingObjekte } from "@/lib/reporting-objekte";

export default async function PlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [plan, objekte, empfaenger] = await Promise.all([
    getSchedule(id),
    ladeReportingObjekte(),
    listRecipients(),
  ]);
  if (!plan.ok) notFound();
  return (
    <PlanFormular
      objekte={objekte.objekte}
      objekteError={objekte.error}
      // Die Währung des Plans bleibt wählbar, auch wenn kein Objekt sie mehr
      // trägt — sonst verlöre er sie beim Bearbeiten stillschweigend.
      waehrungen={[
        ...new Set([...objekte.waehrungen, plan.data.currency]),
      ].sort()}
      empfaenger={(empfaenger.ok ? empfaenger.data.items : []).map((e) => ({
        id: e.owner_id,
        name: e.name,
        hat_vertrag: e.hat_vertrag,
      }))}
      plan={plan.data}
    />
  );
}
