-- 0422 — Mediathek des Website-Baukastens: eigener Bildbestand je Betrieb.
--
-- Bisher trug jeder Bild-Abschnitt eine URL, die der Kunde von Hand eintippen
-- musste. Wer keine Bilder im Netz liegen hat — also praktisch jeder Vermieter —
-- konnte damit kein eigenes Foto auf die Seite bringen. Die Mediathek ist der
-- fehlende Zwischenschritt: einmal hochladen, danach überall auswählen.
--
-- Warum eine TABELLE und nicht nur der Bucket: eine Storage-Auflistung kennt
-- weder Originalnamen noch Größe noch Reihenfolge, und sie ist pro Anfrage ein
-- eigener Netzaufruf. Der Bestand muss aber sortiert, gezählt und gefiltert
-- werden — das ist eine Datenbankaufgabe.

-- == Bucket ===================================================================
-- PUBLIC, wie property-images (0062) und announcement-images (0338): die Bilder
-- stehen auf einer öffentlichen Website und werden als `<img src>` in
-- gespeicherte Blöcke geschrieben. Signierte URLs müssten beim Rendern je Bild
-- erneuert werden und wären nach einer Stunde tote Bilder in der Live-Seite.
-- Schutz vor Erraten: nicht-ratbarer Dateiname (secrets.token_hex) im
-- tenant-gescopeten Pfad.
--
-- NUR JPEG, PNG, WebP:
--   • KEIN SVG — ein SVG im public Bucket ist Stored-XSS: es darf <script>
--     tragen und wird vom Browser als Dokument ausgeführt (Wurzel 8).
--   • KEIN GIF — bringt für Objektfotos nichts und ist zusätzliche
--     Angriffsfläche (Decoder-CVEs).
-- Die MIME-Allowlist hier ist der ZWEITE Riegel; der erste ist die
-- Magic-Byte-Prüfung im Upload-Endpunkt — der vom Client behauptete
-- content_type ist frei wählbar und damit kein Schutz.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'site-media',
    'site-media',
    true,
    20971520,  -- 20 MB, wie property-images
    array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- == site_media: der Bildbestand eines Betriebs ===============================
create table if not exists public.site_media (
    id          uuid primary key default gen_random_uuid(),
    tenant_id   uuid not null references public.tenants (id) on delete cascade,
    -- Pfad im Bucket: {tenant_id}/{token}.{ext}
    path        text not null,
    -- Öffentliche URL, wie sie in die Blöcke geschrieben wird. Gespeichert und
    -- nicht bei jedem Lesen neu gebaut: die Basis-Adresse kann sich ändern, und
    -- eine bereits veröffentlichte Seite soll ihr Bild behalten.
    url         text not null,
    -- Originaldateiname, damit der Kunde sein Bild wiedererkennt. Nur Anzeige.
    filename    text,
    mime        text not null,
    bytes       integer not null check (bytes > 0),
    created_at  timestamptz not null default now(),
    constraint site_media_tenant_path_key unique (tenant_id, path)
);

create index if not exists site_media_tenant_idx
    on public.site_media (tenant_id, created_at desc);

create trigger set_updated_at_site_media before update on public.site_media
    for each row execute function public.set_updated_at();

-- == RLS + Direktpfad zudrehen (Wurzel 6) =====================================
-- Der FastAPI-Layer wird umgangen, wenn ein Client mit gültigem JWT und dem
-- öffentlichen anon-Key direkt gegen PostgREST spricht. Deshalb reicht die
-- tenant-Policy allein nicht: Schreiben darf NUR der Server (service_role).
alter table public.site_media enable row level security;

drop policy if exists site_media_tenant on public.site_media;
create policy site_media_tenant on public.site_media
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- Lesen bleibt erlaubt (es sind die eigenen Bilder des Betriebs, die ohnehin
-- öffentlich im Bucket liegen) — Schreiben nicht. Ein eingeloggter cleaner kann
-- damit per `curl /rest/v1/site_media` weder Zeilen anlegen noch fremde sehen.
revoke insert, update, delete on public.site_media from anon, authenticated;

-- Realtime: HIER aufgenommen, in 0423 wieder ENTFERNT. Grund: die Rechtelage
-- nach dieser Migration ist `REFERENCES` für anon/authenticated, also KEIN
-- select — damit wäre das Abo eine stumme Attrappe. Der Block bleibt stehen,
-- weil Migrationen nicht rückdatiert werden; wirksam ist 0423.
do $$
begin
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'site_media'
    ) then
        alter publication supabase_realtime add table public.site_media;
    end if;
end $$;

comment on table public.site_media is
    'Bildbestand des Website-Baukastens je Betrieb (Bucket site-media). '
    'Schreiben nur über die API (service_role); Direktpfad per revoke gesperrt.';
