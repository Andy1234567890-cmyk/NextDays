// Objektkartei (8-stufig, Lastenheft §6). Server Component: lädt Objekt + Kartei
// (GET /property-dossier/{id}/full) und rendert den Client-Stepper. Stufe 1
// (Eigentümer) kommt read-only aus dem verknüpften owners-Datensatz.
//
// Realtime: die Kartei-Tabellen sind in supabase_realtime publiziert (0128). Die
// Kartei ist eine EDITIER-UI mit lokalem Draft-State — ein Auto-Reload würde
// Eingaben verwerfen. Nach dem Speichern pflegt der Stepper seinen State aus der
// Server-Antwort. Die property-Zeile abonniert das Layout (PropertyRealtime).
import { notFound } from "next/navigation";

import { DossierStepper } from "@/components/objekte/kartei/dossier-stepper";
import { getDossier } from "@/lib/property-dossier";
import { getProperty } from "@/lib/properties";

// Die Kartei verlangt MANAGE_PROPERTIES (frueher VIEW_CALENDAR, das auch die
// owner-Rolle traegt — sie darf die Tuercodes und Zugangsdaten darin nicht
// sehen). Wer sie nicht hat, fuer den gibt es diese Seite nicht: notFound
// statt eines Fehlerkastens, dieselbe Regel wie bei /eigentuemer. Der echte
// Schutz sitzt im Backend, der Menuepunkt ist zusaetzlich ausgeblendet
// (property-subnav.tsx) — hier wird der Direktaufruf per URL abgefangen.

export default async function KarteiPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [prop, dossier] = await Promise.all([getProperty(id), getDossier(id)]);

  if (!prop.ok) {
    if (prop.error.includes("nicht gefunden")) notFound();
    return <div className="p-2 text-sm text-destructive">{prop.error}</div>;
  }
  if (!dossier.ok) {
    if (dossier.status === 403) notFound();
    return <div className="p-2 text-sm text-destructive">{dossier.error}</div>;
  }

  return <DossierStepper property={prop.data} initial={dossier.data} />;
}
