-- Was von einer Gebühr WIRKLICH beim Portal steht — zurückgelesen, nicht geglaubt
--
-- Bisher sagte die Preise-Seite nur, ob eine Gebühr an ein Portal gehen KANN
-- (Regelwerk `ota_abgaben`). Ob sie dort angekommen ist, stand nirgends. Live
-- am 11.08.2026 war der Unterschied greifbar: das Airbnb-Inserat 54087677 trug
-- eine Reinigungsgebühr von 1.590 DKK (vom Betrieb bei Airbnb gepflegt),
-- während bei uns 795 DKK standen — die Oberfläche zeigte beide Seiten als in
-- Ordnung. Ein „200" beim Push ist kein Beleg: Channex überträgt an Airbnb
-- ASYNCHRON (gemessen 15–45 Minuten nach unserem Sync).
--
-- Deshalb dieselbe Bauweise wie beim ARI-Schatten (0251): der Stand wird
-- gespeichert, nicht bei jedem Seitenaufbau live geholt. Ein Rücklese-Job
-- schreibt hier hinein, die Oberfläche liest nur.
--
-- WAS HIER NICHT HINEINGEHÖRT: „geht an dieses Portal gar nicht" (Booking.com
-- nimmt keine Festbeträge) und „vom Betrieb eingeschränkt". Beides rechnet
-- `abgaben_status` aus dem Regelwerk — gespeichert wäre es eine zweite
-- Wahrheit, die genau dann veraltet, wenn sich eine Regel ändert (Wurzel 4).
-- Hier steht ausschliesslich, was NUR ein Rückleseaufruf wissen kann.

create table if not exists public.ota_gebuehren_stand (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    property_id uuid not null references public.properties(id) on delete cascade,
    -- Portal-Code wie in `channex_channel_connection.ota_portal_code`
    -- (AirBNB, BookingCom …). Heute schreibt nur Airbnb hierher — als
    -- einziges Portal gibt es einen Leseweg für Gebühren zurück.
    portal text not null,
    -- Lokale Kennung des Postens: `pricing.fees[].id` oder `cat:<kategorie>`
    -- für eine je Kategorie summierte Gebühr — dieselben Schlüssel wie in
    -- `channex_tax_map.local_tax_id`, damit beide Seiten dasselbe meinen.
    posten_key text not null,
    -- online     = dort steht genau unser Betrag
    -- abweichend = dort steht ein ANDERER Betrag (betrag_ist)
    -- fehlt      = dort steht die Gebühr nicht
    status text not null check (status in ('online', 'abweichend', 'fehlt')),
    betrag_soll numeric(12, 2),
    betrag_ist numeric(12, 2),
    currency text,
    geprueft_am timestamptz not null default now(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists ota_gebuehren_stand_uidx
    on public.ota_gebuehren_stand (property_id, portal, posten_key);
create index if not exists ota_gebuehren_stand_tenant_idx
    on public.ota_gebuehren_stand (tenant_id);

drop trigger if exists trg_ota_gebuehren_stand_updated on public.ota_gebuehren_stand;
create trigger trg_ota_gebuehren_stand_updated
    before update on public.ota_gebuehren_stand
    for each row execute function public.set_updated_at();

alter table public.ota_gebuehren_stand enable row level security;

drop policy if exists ota_gebuehren_stand_tenant on public.ota_gebuehren_stand;
create policy ota_gebuehren_stand_tenant on public.ota_gebuehren_stand
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- Wurzel 6: der Mandant allein reicht nicht. Eigentümer und Personal sehen nur
-- ihre eigenen Objekte — derselbe Scope wie bei `channex_property_map`, sonst
-- läse ein Reinigungskraft-JWT per anon-Key die Gebührenstände aller Objekte.
drop policy if exists ota_gebuehren_stand_owner_scope on public.ota_gebuehren_stand;
create policy ota_gebuehren_stand_owner_scope on public.ota_gebuehren_stand
    as restrictive for select
    using (public.owner_can_see_property(property_id));

drop policy if exists ota_gebuehren_stand_staff_scope on public.ota_gebuehren_stand;
create policy ota_gebuehren_stand_staff_scope on public.ota_gebuehren_stand
    as restrictive for select
    using (public.staff_can_see_property(property_id));

drop policy if exists ota_gebuehren_stand_write_restrict on public.ota_gebuehren_stand;
create policy ota_gebuehren_stand_write_restrict on public.ota_gebuehren_stand
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- Wurzel 6: geschrieben wird ausschliesslich vom Rücklese-Job (service_role).
-- Ein Client, der den Stand selbst setzen könnte, könnte „online" behaupten —
-- genau die Aussage, die diese Tabelle glaubwürdig machen soll.
revoke insert, update, delete on public.ota_gebuehren_stand from anon, authenticated;
grant select on public.ota_gebuehren_stand to authenticated;

-- Realtime: die Preise-Seite zeigt den Stand als Chip am Posten. Ohne
-- Publikation wäre das Abo eine stumme Attrappe (Qualitätsgate).
do $$
begin
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'ota_gebuehren_stand'
    ) then
        alter publication supabase_realtime add table public.ota_gebuehren_stand;
    end if;
end $$;

comment on table public.ota_gebuehren_stand is
    'Zurückgelesener Ist-Stand einer Gebühr beim Portal (heute nur Airbnb: '
    'GET channels/{cid}/mappings/{mid}/pricing_settings). Geschrieben vom Job '
    'pruefe_ota_gebuehren, gelesen von abgaben_status.';
