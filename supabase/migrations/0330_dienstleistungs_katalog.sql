-- 0330 — Katalog der Dienstleistungen (Etappe D: „Dienstleistung buchen").
--
-- WARUM EIN KATALOG UND KEIN FREIER title-STRING:
-- Heute ist „Endreinigung" nur ein Freitext im `tasks.title`. Damit lässt sich
-- nichts auswerten (wie oft wurde Fensterreinigung beauftragt?), nichts
-- übersetzen (24 Sprachen) und nichts vorbelegen (Standard-Dauer, Stamm-
-- Mitarbeiter je Objekt). Der Branchenstandard (Breezeway/Turno/Guesty) führt
-- deshalb einen Service-/Task-Typ mit Kategorie, Default-Dauer und Default-
-- Assignee, aus dem der konkrete Auftrag entsteht.
--
-- ABGRENZUNG: Das hier ist NICHT das Gäste-Addon aus 0074_property_addons.sql.
-- Dort kauft der GAST eine Zusatzleistung zur Buchung; hier beauftragt der
-- EIGENTÜMER eine Leistung am Objekt. Gleiche Wörter, zwei Fachdomänen.
--
-- i18n (Wurzel 4): Der ANZEIGENAME steht NICHT in der DB. Die DB trägt einen
-- stabilen `key` (z. B. `endreinigung`); die Beschriftung kommt aus den
-- Message-Katalogen (web/messages/*.json → `services.type.<key>`). Ein deutsches
-- Wort in der Tabelle wäre in 23 der 24 Sprachen falsch — dieselbe Begründung
-- wie beim leeren Zeilentitel im Aufgaben-Kalender.
-- Freitext-Aufträge des Eigentümers tragen dagegen SEINEN Text (er hat ihn in
-- seiner Sprache geschrieben) — der gehört an die Aufgabe, nicht in den Katalog.

-- Systemweite Vorgaben + eigene Typen des Betriebs in EINER Tabelle:
-- tenant_id NULL = Systemvorgabe (für alle sichtbar, vom Betrieb nicht
-- änderbar), tenant_id gesetzt = eigener Typ des Betriebs. So braucht es keine
-- zweite Tabelle und keine Kopie der Vorgaben je Mandant (die beim nächsten
-- Update auseinanderliefe).
create table if not exists public.service_types (
    id          uuid primary key default gen_random_uuid(),
    tenant_id   uuid references public.tenants (id) on delete cascade,
    -- Stabiler Schlüssel für die Übersetzung. Klein, ohne Leerzeichen.
    key         text not null,
    -- Grobe Einordnung — dieselben drei, die die Branche führt.
    kategorie   text not null default 'cleaning'
        check (kategorie in ('cleaning', 'maintenance', 'inspection')),
    aktiv       boolean not null default true,
    sortierung  integer not null default 0,
    -- Übliche Dauer in Minuten. Speist start_at/end_at des erzeugten Auftrags,
    -- damit er im Aufgaben-Kalender einen Balken bekommt statt eines Punkts.
    -- NULL = keine Erfahrung hinterlegt → der Auftrag bekommt kein Ende
    -- (kein erfundener Default, Wurzel 4).
    standard_dauer_minuten integer
        check (standard_dauer_minuten is null or standard_dauer_minuten between 1 and 1440),
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

-- Ein Schlüssel je Mandant. Zwei partielle Indizes, weil NULL in einem normalen
-- UNIQUE nie mit NULL kollidiert — sonst könnte die Systemvorgabe `endreinigung`
-- beliebig oft angelegt werden.
create unique index if not exists service_types_key_system_uq
    on public.service_types (key) where tenant_id is null;
create unique index if not exists service_types_key_tenant_uq
    on public.service_types (tenant_id, key) where tenant_id is not null;
create index if not exists service_types_tenant_idx
    on public.service_types (tenant_id, sortierung);

create trigger set_updated_at before update on public.service_types
    for each row execute function public.set_updated_at();

-- Systemvorgaben (tenant_id NULL). Genau die fünf aus dem Auftrag; der Betrieb
-- kann eigene ergänzen, und der Eigentümer kann per Freitext alles beauftragen,
-- was hier fehlt.
insert into public.service_types (tenant_id, key, kategorie, sortierung, standard_dauer_minuten)
values
    (null, 'endreinigung',        'cleaning',    10, 180),
    (null, 'hauptreinigung',      'cleaning',    20, 360),
    (null, 'fensterreinigung',    'cleaning',    30, 120),
    (null, 'rasenmaehen',         'maintenance', 40,  90),
    (null, 'terrassenreinigung',  'cleaning',    50, 120)
on conflict do nothing;

comment on table public.service_types is
    'Katalog beauftragbarer Dienstleistungen. tenant_id NULL = Systemvorgabe, '
    'sonst eigener Typ des Betriebs. Der Anzeigename steht NICHT hier — die DB '
    'trägt nur den stabilen `key`, beschriftet wird über die Message-Kataloge '
    '(services.type.<key>). NICHT zu verwechseln mit property_addons (0074): '
    'das ist die Zusatzleistung, die der GAST kauft.';

-- == Stamm-Dienstleister je Objekt und Typ =================================
-- „Wer macht die Endreinigung in Haus X?" Ohne diese Zuordnung bleibt ein vom
-- Eigentümer beauftragter Auftrag UNZUGEWIESEN (assignee_id NULL) — das ist der
-- gewollte Zustand, kein erfundener Default-Empfänger (Wurzel 4).
create table if not exists public.property_service_assignees (
    id              uuid primary key default gen_random_uuid(),
    tenant_id       uuid not null references public.tenants (id) on delete cascade,
    property_id     uuid not null references public.properties (id) on delete cascade,
    service_type_id uuid not null references public.service_types (id) on delete cascade,
    assignee_id     uuid not null references public.users (id) on delete cascade,
    created_at      timestamptz not null default now(),
    unique (property_id, service_type_id)
);

create index if not exists property_service_assignees_tenant_idx
    on public.property_service_assignees (tenant_id);
create index if not exists property_service_assignees_assignee_idx
    on public.property_service_assignees (assignee_id);

comment on table public.property_service_assignees is
    'Stamm-Mitarbeiter je Objekt und Dienstleistungstyp. Fehlt die Zeile, bleibt '
    'ein beauftragter Auftrag unzugewiesen — kein erfundener Empfänger.';

-- == Verknüpfung an die Aufgabe ============================================
-- nullable: alle Bestandsaufgaben (Freitext-Titel) bleiben gültig.
alter table public.tasks
    add column if not exists service_type_id uuid
        references public.service_types (id) on delete set null;

-- Wer den Auftrag ausgelöst hat. Beim Eigentümer-Portal der Owner-Login; bei
-- allen Bestandsaufgaben NULL. Trägt zusätzlich die Idempotenz (siehe unten).
alter table public.tasks
    add column if not exists requested_by uuid
        references public.users (id) on delete set null;

-- Fachlicher Schlüssel gegen Doppelaufträge (Wurzel 2). Ein Doppelklick des
-- Eigentümers erzeugt denselben Schlüssel; der UNIQUE-Index lässt den zweiten
-- Einfügeversuch mit 23505 auflaufen, und der Service gibt die BESTEHENDE
-- Aufgabe zurück statt einer zweiten Endreinigung. Der Index ist der Backstop
-- in der DB — die einzige Stelle, die auch bei zwei gleichzeitigen Requests
-- (zwei Worker, kein gemeinsamer Speicher) noch greift.
alter table public.tasks
    add column if not exists request_dedup_key text;

create unique index if not exists tasks_request_dedup_uq
    on public.tasks (tenant_id, request_dedup_key)
    where request_dedup_key is not null;

create index if not exists tasks_service_type_idx
    on public.tasks (tenant_id, service_type_id)
    where service_type_id is not null;

comment on column public.tasks.service_type_id is
    'Katalog-Typ der Leistung (0330). NULL = freie Aufgabe wie im Bestand.';
comment on column public.tasks.request_dedup_key is
    'Idempotenz-Schlüssel beauftragter Leistungen (Wurzel 2). UNIQUE je Mandant '
    '— der zweite Klick trifft den Index, nicht die Datenbank ein zweites Mal.';

-- == Wurzel 6: RLS + GRANT-Entzug ==========================================
alter table public.service_types enable row level security;
alter table public.property_service_assignees enable row level security;

-- service_types: LESEN darf `authenticated` (der Katalog ist die Auswahlliste
-- im Portal und speist ein Realtime-Abo — ohne Grant wäre das Abo eine stumme
-- Attrappe). Welche ZEILEN, entscheidet die Policy: die eigenen plus die
-- Systemvorgaben. SCHREIBEN ausschließlich der Server (service_role): sonst
-- könnte sich jeder eingeloggte Nutzer per anon-Key-curl eigene Typen anlegen
-- oder — schlimmer — die Systemvorgaben aller Mandanten umschreiben.
revoke all on public.service_types from anon, authenticated;
grant select on public.service_types to authenticated;

drop policy if exists service_types_select on public.service_types;
create policy service_types_select on public.service_types
    for select to authenticated
    using (tenant_id is null or tenant_id = public.current_tenant_id());

-- Restriktiv für ALLE Kommandos (nicht nur select, Wurzel 6): schließt den
-- Schreibpfad mit. Systemvorgaben (tenant_id is null) sind damit für JEDEN
-- Client unschreibbar — `with check` scheitert an der NULL.
drop policy if exists service_types_tenant_restrict on public.service_types;
create policy service_types_tenant_restrict on public.service_types
    as restrictive for all
    using (tenant_id is null or tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- property_service_assignees: Personalzuordnung. Wer welchen Mitarbeiter wo
-- einsetzt, geht weder anon noch einem beliebigen eingeloggten Nutzer etwas an
-- (Recon für Priv-Esc, Wurzel 9) — kein Grant, kein Realtime, nur service_role.
revoke all on public.property_service_assignees from anon, authenticated;

drop policy if exists property_service_assignees_tenant_restrict
    on public.property_service_assignees;
create policy property_service_assignees_tenant_restrict
    on public.property_service_assignees
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- Realtime: der Dienstleistungs-Katalog speist die Auswahlliste im Portal.
-- Grant (oben) UND Publikation müssen BEIDE stimmen.
do $$
begin
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'service_types'
    ) then
        alter publication supabase_realtime add table public.service_types;
    end if;
end $$;
