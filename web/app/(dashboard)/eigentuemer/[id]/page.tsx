// Eigentümer-Detail = SOFORT die volle Owner-Statements-Ansicht (wie Hostaway):
// Kopf-Daten, Summary-Kacheln, Rental activity, Expenses & Extras, Grand total.
// Die Page lädt nur Stammdaten + Liste; das Statement lädt/erzeugt die Client-
// Komponente beim Mount (kein Server-Action-Aufruf im Server-Render).
import Link from "next/link";

import { OwnerStatementsForOwner } from "@/components/eigentuemer/owner-statements-for-owner";
import { getAvailableProperties, getOwner } from "@/lib/owners";
import { listStatements } from "@/lib/owner-statements";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Nur zuordenbare Objekte (frei oder bereits diesem Owner) — Objekte anderer
  // Eigentümer dürfen nicht zur Auswahl stehen (ein Objekt = ein Eigentümer).
  const [ownerRes, statementsRes, propsRes] = await Promise.all([
    getOwner(id),
    listStatements(id),
    getAvailableProperties(id),
  ]);

  if (!ownerRes.ok) {
    return (
      <div className="flex flex-col gap-4">
        <Link href="/eigentuemer" className="text-sm text-muted-foreground">
          ← Eigentümer
        </Link>
        <p className="text-sm text-destructive">
          Eigentümer konnte nicht geladen werden: {ownerRes.error}
        </p>
      </div>
    );
  }

  return (
    <OwnerStatementsForOwner
      owner={ownerRes.data}
      statements={statementsRes.ok ? statementsRes.data.items : []}
      // Adresse und Foto kommen mit durch: die Mehrfachauswahl zeigt sie je
      // Zeile, damit sich 18 ähnlich benannte Objekte unterscheiden lassen.
      // Vorher wurden sie hier auf {id, title} beschnitten.
      properties={propsRes.ok ? propsRes.data.items : []}
    />
  );
}
