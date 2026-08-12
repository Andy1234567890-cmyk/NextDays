// Neuen Bericht anlegen.
import { BerichtFormular } from "@/components/eigentuemer/reporting/bericht-formular";
import { ladeReportingObjekte } from "@/lib/reporting-objekte";

export default async function NeuerBerichtPage() {
  const { objekte, error, waehrungen } = await ladeReportingObjekte();
  return (
    <BerichtFormular
      objekte={objekte}
      objekteError={error}
      waehrungen={waehrungen}
    />
  );
}
