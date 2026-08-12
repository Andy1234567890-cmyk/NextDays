// Neuen geplanten Bericht anlegen.
import { PlanFormular } from "@/components/eigentuemer/reporting/plan-formular";
import { listRecipients } from "@/lib/owner-reporting";
import { ladeReportingObjekte } from "@/lib/reporting-objekte";

export default async function NeuerPlanPage() {
  const [objekte, empfaenger] = await Promise.all([
    ladeReportingObjekte(),
    listRecipients(),
  ]);
  return (
    <PlanFormular
      objekte={objekte.objekte}
      objekteError={objekte.error}
      waehrungen={objekte.waehrungen}
      empfaenger={(empfaenger.ok ? empfaenger.data.items : []).map((e) => ({
        id: e.owner_id,
        name: e.name,
        hat_vertrag: e.hat_vertrag,
      }))}
    />
  );
}
