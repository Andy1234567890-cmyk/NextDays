-- 0288 — Airbnb-Foto ↔ Airbnb-Raum: welches Bild gehört zu welchem Zimmer.
--
-- WARUM EINE EIGENE TABELLE UND KEINE SPALTEN IN property_photos:
-- Das ist eine AIRBNB-EIGENHEIT. Airbnb verlangt für jeden Raum ein Foto —
-- fehlt eines, blendet es die ganze „Photo tour" für Gäste aus („Guests only
-- see your photo tour if every room has a photo"). Booking.com kennt das
-- Konzept nicht, und der Booking-Connect kommt noch. Zwei Spalten in
-- `property_photos` würden dieses Wissen in jede Foto-Abfrage jedes Portals
-- tragen; hier bleibt es dort, wo es hingehört — beim Kanal.
--
-- Dasselbe Muster wie `channex_property_map`: portalspezifische Zuordnung in
-- einer eigenen Tabelle, das Fachobjekt bleibt neutral.
--
-- WAS HIER GESPEICHERT WIRD, IST AIRBNBS SICHT, NICHT UNSERE:
-- `airbnb_photo_id` und `airbnb_room_id` sind Airbnbs Kennungen. Ohne die
-- Foto-Kennung lässt sich ein Bild nicht umhängen — der Schreibweg ist
-- `PUT listing_photos/{airbnb_photo_id}` mit `room_id` (live verifiziert
-- 05.08.2026: Foto 2644186464 von Raum 792924436 auf 817240083 und zurück,
-- beide Male zurückgelesen). ACHTUNG: der Aufruf verträgt `room_id` NUR ALLEIN
-- — zusammen mit `listing_id` antwortet Airbnb „Please provide either a listing
-- ID or a room ID, but not both."

create table if not exists public.airbnb_foto_raum (
    id               uuid primary key default gen_random_uuid(),
    tenant_id        uuid not null references public.tenants(id) on delete cascade,
    -- Unser Foto. Verschwindet es, verschwindet die Zuordnung mit.
    property_photo_id uuid not null unique
                          references public.property_photos(id) on delete cascade,
    -- Airbnbs Kennungen. Text, nicht uuid: Airbnb nutzt zusammengesetzte
    -- Kennungen wie „1675950565421151420_2644183304".
    airbnb_photo_id  text not null,
    -- NULL = Airbnb führt das Foto ohne Raum (`category: LISTING`, z. B. das
    -- Außenbild). Das ist ein gültiger Zustand, kein fehlender Wert.
    airbnb_room_id   text,
    updated_at       timestamptz not null default now(),
    created_at       timestamptz not null default now()
);

-- Ein Foto = eine Airbnb-Kennung, je Mandant. Backstop gegen doppelte Importe
-- (Wurzel 2): ein zweiter Abruf aktualisiert, statt eine zweite Zeile zu legen.
create unique index if not exists airbnb_foto_raum_photo_uq
    on public.airbnb_foto_raum (tenant_id, airbnb_photo_id);

-- „Welche Fotos hängen an Raum X" und „welcher Raum hat gar keins" — genau der
-- Zugriff der Warnung.
create index if not exists airbnb_foto_raum_raum_idx
    on public.airbnb_foto_raum (tenant_id, airbnb_room_id);

alter table public.airbnb_foto_raum enable row level security;

-- Wurzel 6: `enable rls` + Tenant-Policy reicht nicht. Geschrieben wird
-- ausschließlich vom Server (Import und Umhängen laufen über den
-- channel_manager); gelesen wird über FastAPI, nicht per Direktzugriff.
-- Kein Realtime-Abo auf dieser Tabelle: die Fotos-Seite hört auf
-- `property_photos` (erlaubte Quelle) und lädt die Zuordnung dazu.
revoke all on public.airbnb_foto_raum from anon, authenticated;

create policy airbnb_foto_raum_tenant_restrict on public.airbnb_foto_raum
    as restrictive for all using (tenant_id = public.current_tenant_id());

comment on table public.airbnb_foto_raum is
    'Airbnb-Eigenheit: welches Foto zu welchem Airbnb-Raum gehört. Airbnb '
    'blendet die Photo tour aus, wenn ein Raum kein Foto hat. Bewusst NICHT in '
    'property_photos — Booking.com kennt das Konzept nicht.';
comment on column public.airbnb_foto_raum.airbnb_room_id is
    'NULL = Foto ohne Raum (Airbnb `category: LISTING`), ein gültiger Zustand.';
