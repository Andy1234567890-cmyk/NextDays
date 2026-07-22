// Objekt → Compliance: Registrierungsdetails für
// die eigene Website (Registrierungsnummer(n) zur Erfüllung lokaler
// Vorschriften). Server Component lädt das Objekt, der Client-Teil rendert die
// bearbeitbaren Blöcke.
import { ComplianceForm } from "@/components/objekte/compliance-form";
import { getProperty } from "@/lib/properties";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const res = await getProperty(id);
  if (!res.ok) {
    return (
      <div className="text-sm text-destructive">
        Objekt konnte nicht geladen werden: {res.error}
      </div>
    );
  }
  return <ComplianceForm initial={res.data} />;
}
