// Bewertungen des Gastgebers (Server Component). Lädt Bewertungen + Kennzahlen
// server-zu-server; die Liste rendert Kopf/Kacheln selbst. Auth-Guard sitzt im
// Group-Layout. Damit ist der bislang tote Menüpunkt „Bewertungen" belegt.
import { BewertungenListe } from "@/components/bewertungen-liste";
import { getBewertungen, getBewertungsKennzahlen } from "@/lib/bewertungen";

export default async function BewertungenPage() {
  // Kennzahlen sind Beiwerk: fehlen sie, zeigt die Seite trotzdem die Liste.
  const [liste, kennzahlen] = await Promise.all([
    getBewertungen({ limit: 50 }),
    getBewertungsKennzahlen().catch(() => null),
  ]);

  return (
    <main className="mx-auto max-w-4xl px-8 py-10">
      <BewertungenListe initial={liste.items} kennzahlen={kennzahlen} />
    </main>
  );
}
