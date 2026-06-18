// Objekt → Standort (wie Lodgify „Location"): vier Karten — Adresse
// (Google-Karte + Places), Entfernungen, eigene Karte (Bild), Wegbeschreibung.
// Server Component lädt das Objekt, der Client-Teil rendert Karten + Editoren.
import { LocationForm } from "@/components/objekte/location-form";
import { getProperty } from "@/lib/properties";

export default async function StandortPage({
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

  return <LocationForm initial={res.data} />;
}
