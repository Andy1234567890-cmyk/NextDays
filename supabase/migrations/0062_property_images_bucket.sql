-- 0062_property_images_bucket.sql — Storage-Bucket für Objekt-Bilder
--
-- Der Bucket `property-images` wurde bisher nie über eine Migration angelegt
-- (er fehlte auf dem Server → Upload schlug mit „Bucket not found" fehl). Er
-- trägt sowohl die Einzelbilder (Avatar/Custom-Map über POST /image) als auch
-- die Galerie-Fotos (property_photos, POST /photos), Pfad jeweils
-- {tenant_id}/{property_id}/…
--
-- Zugriff (bewusste Entscheidung): Das Backend schreibt mit dem Service-Role-
-- Client (umgeht RLS; die Tenant-Prüfung passiert vor dem Upload im Service).
-- Der Bucket ist `public`, weil veröffentlichte Objekt-Fotos auf der ÖFFENTLICHEN
-- booking_engine (anonyme Gäste, kein current_tenant_id) ladbar sein müssen — ein
-- privater, tenant-RLS-geschützter Bucket würde die Gäste-Ansicht brechen. Schutz
-- vor Erraten: nicht-ratbare Dateinamen (secrets.token_hex). Konsistent mit dem
-- bestehenden Avatar-/Custom-Map-Upload. Daher KEINE storage.objects-Policy nötig.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'property-images',
    'property-images',
    true,
    20971520,  -- 20 MB (deckt das Backend-Limit ab; Galerie 50 KB–20 MB)
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
