-- 0067_company_logos_bucket.sql — Storage-Bucket für Firmen-/Aussteller-Logos
--
-- Das Logo wird im Firmenprofil (tenant_billing_profile.company_logo_url)
-- referenziert und erscheint auf Dokumenten (Eigentümer-Abrechnung,
-- Rechnungen) sowie im Gäste-Portal. Bisher gab es keinen Upload — die
-- Profil-Seite war ein totes Mockup. Pfad: {tenant_id}/logo.{ext}.
--
-- Zugriff (analog 0062 property-images): Das Backend schreibt mit dem
-- Service-Role-Client (umgeht RLS; Tenant-Prüfung passiert im Service VOR dem
-- Upload). Der Bucket ist `public`, weil das Logo auf der ÖFFENTLICHEN
-- booking_engine (anonyme Gäste) und in versendeten PDFs ladbar sein muss.
-- Daher KEINE storage.objects-Policy nötig.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'company-logos',
    'company-logos',
    true,
    5242880,  -- 5 MB
    array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
