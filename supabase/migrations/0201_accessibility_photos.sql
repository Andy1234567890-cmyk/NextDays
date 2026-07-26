-- Beweisfotos für Barrierefreiheits-Merkmale (Airbnb „Accessibility features").
--
-- Airbnb-Ablauf (aus dem echten Editor): Der Gastgeber wählt je Merkmal „Ich habe
-- diese Funktion" und lädt dazu Fotos hoch. Danach: „Nach dem Absenden prüfen wir
-- Ihre Fotos. Genehmigte Barrierefreiheitsmerkmale werden Ihrem Eintrag
-- hinzugefügt." Ein Merkmal ist also erst nach FREIGABE öffentlich — der
-- Prüfstatus gehört deshalb an das Foto, nicht nur ein has=true-Flag.
--
-- Das reine „habe ich / habe ich nicht" bleibt wie bisher in
-- properties.type_attributes.accessibility[key].has; hier liegen ausschließlich
-- die zugehörigen Fotos samt Prüfstatus. Mehrere Fotos je Merkmal sind erlaubt
-- (Airbnb verlangt z. B. beim stufenlosen Zugang eine Aufnahme alle 3 Meter).
--
-- feature_key ist der stabile Katalog-Slug (barrierefreiheit-katalog.ts) — er
-- wird bewusst NICHT per FK gegen eine Tabelle geprüft, weil der Katalog im
-- Code lebt (wie amenities/facilities). Kein erfundener Wert: die UI schickt
-- nur Keys aus dem Katalog.
--
-- Sensibel (Objektdaten + Fotos) → Wurzel 6: RLS + harter GRANT-Entzug. Nur der
-- Server (service_role) über den properties-Slice schreibt/liest; ein Client
-- käme per anon-Key-curl NICHT an fremde Objektfotos.

create table if not exists public.property_accessibility_photos (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants (id) on delete cascade,
    property_id uuid not null
        references public.properties (id) on delete cascade,

    -- Katalog-Slug des Merkmals (z. B. „step_free_guest_entrance").
    feature_key text not null,

    -- Ablage im Storage-Bucket property-images + die öffentliche URL.
    storage_path text not null,
    url text not null,

    -- Prüfstatus (Airbnb prüft die Fotos vor Veröffentlichung des Merkmals).
    -- pending = eingereicht, approved = freigegeben, rejected = abgelehnt.
    status text not null default 'pending'
        check (status in ('pending', 'approved', 'rejected')),
    -- Begründung bei Ablehnung (dem Gastgeber angezeigt).
    review_note text,
    reviewed_at timestamptz,

    created_at timestamptz not null default now()
);

create index if not exists property_accessibility_photos_property_idx
    on public.property_accessibility_photos (property_id, feature_key);
create index if not exists property_accessibility_photos_tenant_idx
    on public.property_accessibility_photos (tenant_id);

comment on table public.property_accessibility_photos is
    'Beweisfotos je Barrierefreiheits-Merkmal (Airbnb „Accessibility features"). '
    'Ein Merkmal wird erst nach Freigabe (status=approved) öffentlich. Das '
    'has-Flag selbst liegt in properties.type_attributes.accessibility. '
    'Nur service_role schreibt/liest.';

-- --- Härtung (Wurzel 6): RLS + harter GRANT-Entzug --------------------------
alter table public.property_accessibility_photos enable row level security;

revoke all on public.property_accessibility_photos from anon, authenticated;

-- Restriktive Guard für ALLE Operationen: streng per-Tenant. Selbst wenn je ein
-- Grant hinzukäme, sähe/änderte ein Client nur Zeilen des eigenen Tenants.
create policy property_accessibility_photos_tenant_restrict
    on public.property_accessibility_photos
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
