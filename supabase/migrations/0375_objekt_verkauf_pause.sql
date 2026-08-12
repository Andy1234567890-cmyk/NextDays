-- 0375_objekt_verkauf_pause.sql
-- Ein Objekt bei ALLEN Portalen aus dem Verkauf nehmen — und zurückholen.
--
-- DER ANLASS (12.08.2026): Im Drei-Punkte-Menü der Objekt-Karte soll ein
-- Betrieb sein Objekt inaktiv schalten UND den Buchungskalender bei allen OTAs
-- abschalten. Bis heute gibt es nur `properties.status = 'inactive'`, und das
-- wirkt AUSSCHLIESSLICH bei uns: `properties.status` wird im ganzen
-- Channel-Manager nirgends gelesen (siehe veroeffentlichen.py). Bei Airbnb
-- standen deshalb am 06.08.2026 alle 18 Objekte weiter auf „Unlisted" bzw.
-- verkauften weiter, obwohl unsere Oberfläche „Inaktiv" zeigte — ein
-- fail-open-Geisterzustand (Wurzel 5).
--
-- WARUM EINE SICHERUNGSTABELLE UND KEIN BOOLEAN (Wurzel 1 — Gegenzustand):
-- Der Rückweg muss den Zustand VOR dem Abschalten wiederherstellen, nicht
-- „alles anschalten". Zwei Portale, zwei verschiedene Hebel — live gemessen an
-- „021 Stjerneskud" (6a17222f-9a75-4e1f-8f8d-9fa07efa9275):
--
--   Airbnb      → `published` in den Mapping-Settings am Kanal
--                 (channels/{id} → attributes.rate_plans[].settings.published).
--                 NICHT den Kanal abschalten: ein Airbnb-Kanal des Kontos
--                 trägt 18 Objekte, 17 fremde gingen mit aus. NICHT
--                 `has_availability` am Listing: das ist Airbnbs Urlaubsmodus
--                 und verlangt beim Abschalten `deactivation_reason`.
--   Booking.com → der Kanal selbst (POST channels/{id}/deactivate). Die
--                 Mapping-Settings tragen dort NUR die Zuordnung
--                 (room_type_code, rate_plan_code, occupancy, pricing_type) —
--                 kein Sichtbarkeits-Feld. Bei Booking hat jedes Objekt einen
--                 eigenen Kanal mit eigener hotel_id (live: 18 Kanäle, jeder
--                 mit genau 1 Objekt), deshalb trifft es nur dieses Objekt.
--
-- Ein Kanal, der schon VOR dem Abschalten inaktiv war, darf beim Zurückholen
-- NICHT angeschaltet werden. Genau dafür steht hier der Ist-Stand je Portal,
-- und nur deshalb ist der Vorgang umkehrbar statt „danach ist alles an".
--
-- IDEMPOTENZ (Wurzel 2): Doppelklick/Retry darf den gesicherten Stand nicht
-- überschreiben — sonst sichert der zweite Aufruf den bereits abgeschalteten
-- Zustand als „vorher" und der Rückweg ist für immer verloren. Der unique
-- Index (property_id, portal_code) über offene Pausen erzwingt das.

create table if not exists public.property_sales_pause (
    id                  uuid primary key default gen_random_uuid(),
    tenant_id           uuid not null references public.tenants(id) on delete cascade,
    property_id         uuid not null references public.properties(id) on delete cascade,
    -- Portal-Code wie in channex_channel_connection (BookingCom|AirBNB|…).
    portal_code         text not null,
    -- Welcher Hebel benutzt wurde. Bestimmt, was der Rückweg tun muss.
    --   'mapping_published' → Airbnb: settings.published zurücksetzen
    --   'channel_active'    → Booking.com & Co.: Kanal reaktivieren
    hebel               text not null
        check (hebel in ('mapping_published', 'channel_active')),
    channex_channel_id  text not null,
    -- Nur bei 'mapping_published' belegt: die Zuordnung, die geschaltet wurde.
    channex_mapping_id  text,
    -- DER GESICHERTE IST-STAND. `true` = war vorher an und muss zurück an.
    -- `false` = war vorher schon aus und bleibt aus. NICHT nullable: ein
    -- unbekannter Vorzustand wäre ein Rückweg auf Vermutung (Wurzel 4).
    war_aktiv           boolean not null,
    -- Wann abgeschaltet und wann zurückgeholt. `beendet_at is null` = die
    -- Pause läuft noch.
    pausiert_at         timestamptz not null default now(),
    beendet_at          timestamptz,
    -- Wer es ausgelöst hat — für die Rückfrage „wer hat mein Objekt
    -- abgeschaltet". Am 12.08.2026 standen 17 Objekte auf inactive und der
    -- Verursacher war nicht ermittelbar, weil es keine Spur gab.
    pausiert_von        uuid references public.users(id) on delete set null,
    beendet_von         uuid references public.users(id) on delete set null,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);

create index if not exists property_sales_pause_tenant_idx
    on public.property_sales_pause(tenant_id);
create index if not exists property_sales_pause_property_idx
    on public.property_sales_pause(property_id);
-- Höchstens EINE offene Pause je (Objekt, Portal) — der Idempotenz-Backstop in
-- der DB, nicht nur im Service (Wurzel 2).
create unique index if not exists property_sales_pause_offen_uidx
    on public.property_sales_pause(property_id, portal_code)
    where beendet_at is null;

create trigger trg_property_sales_pause_updated
    before update on public.property_sales_pause
    for each row execute function public.set_updated_at();

alter table public.property_sales_pause enable row level security;

create policy property_sales_pause_tenant on public.property_sales_pause
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- Wurzel 6 — RLS erzwingt nur den MANDANTEN. Wer den Verkauf eines Objekts
-- steuert, entscheidet über Umsatz: ein eingeloggter cleaner oder owner darf
-- das per anon-Key-`curl` gegen /rest/v1/property_sales_pause weder schreiben
-- noch verändern. Geschrieben UND gelesen wird ausschließlich vom Server
-- (service_role) — wie bei `channex_channel_connection`, live gegengeprüft:
-- dort hat `authenticated` ebenfalls kein `select`.
revoke insert, update, delete on public.property_sales_pause from anon, authenticated;
revoke select on public.property_sales_pause from anon, authenticated;

-- KEIN Realtime-Abo auf dieser Tabelle, und das ist Absicht.
--
-- Ein Abo wirkt nur, wenn BEIDES stimmt: `select` für `authenticated` UND
-- Mitgliedschaft in `supabase_realtime`. Da das `select` hier bewusst entzogen
-- ist (siehe oben), wäre ein Abo eine stumme Attrappe: die Oberfläche sähe live
-- aus und aktualisierte nie. Der Grant zu öffnen, um das Abo zu retten, wäre
-- der Fehler — genau davor warnt die Realtime-Regel für gesperrte Tabellen.
--
-- Die Oberfläche hört stattdessen auf `properties` (dort ändert sich `status`
-- bzw. `listed_on_marketplace` bei jedem Schaltvorgang mit) — eine erlaubte
-- Quelle, die dieselbe Aussage trägt.
--
-- Der erste Entwurf dieser Migration hat die Tabelle der Publikation
-- hinzugefügt. Sie wird hier wieder entfernt, damit ein bereits eingespielter
-- Stand nicht mit einer Attrappe zurückbleibt (idempotent, Wurzel 1).
do $$
begin
    if exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'property_sales_pause'
    ) then
        alter publication supabase_realtime drop table public.property_sales_pause;
    end if;
end $$;

comment on table public.property_sales_pause is
    'Gesicherter Portal-Zustand vor dem Abschalten eines Objekts (0375). Der '
    'Rückweg stellt WIEDER HER, statt alles anzuschalten: war_aktiv=false '
    'bleibt aus. Airbnb schaltet über settings.published am Mapping, '
    'Booking.com über den Kanal — siehe Migrations-Kopf.';
