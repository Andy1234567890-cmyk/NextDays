// Objekt → Fotos (wie Lodgify „Photos"): Multi-Upload, Galerie mit Reorder,
// Cover/Titelbild und mehrsprachige Bildunterschriften. Die Daten liegen in
// property_photos; properties.photos wird als Spiegel weitergepflegt.
import { PhotosManager } from "@/components/objekte/photos-manager";
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
  return <PhotosManager propertyId={id} />;
}
