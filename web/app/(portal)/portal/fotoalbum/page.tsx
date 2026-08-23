// Eigentümer-Portal · Fotoalbum (pm_photo_album, §4.2 read-only).
//
// Die Bilder ALLER zugeordneten Objekte, je Objekt gruppiert. Die Gruppierung
// macht der Server (/public-portal/photo-album, owner-gescopt) — die Fläche
// ordnet kein Bild selbst zu und fragt keine fremde property_id ab.
import { PortalFotoalbum } from "@/components/portal/portal-fotoalbum";
import { getOwnerPhotoAlbum } from "@/lib/portal";

export const dynamic = "force-dynamic";

export default async function PortalFotoalbumPage() {
  const album = await getOwnerPhotoAlbum();
  return (
    <PortalFotoalbum
      groups={album.ok ? album.data.groups : []}
      error={album.ok ? null : album.error}
    />
  );
}
