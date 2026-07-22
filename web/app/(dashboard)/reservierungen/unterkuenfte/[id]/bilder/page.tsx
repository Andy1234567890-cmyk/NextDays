// Objekt → Bilder: der bestehende Foto-Manager (property_photos),
// 1:1 wiederverwendet — Multi-Upload, Galerie, Cover, Bildunterschriften.
import { PhotosManager } from "@/components/objekte/photos-manager";

export default async function BilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PhotosManager propertyId={id} />;
}
