-- 0496 — Wissensdatenbank: Titel, Kategorie, Herkunft und Volltextsuche
--
-- WARUM: `inbox_knowledge_fact` (0260) hat genau EIN inhaltliches Feld — den
-- Fakt selbst. Damit lässt sich eine Liste bauen, aber nicht bedienen: ohne
-- Titel muss der Betrieb jeden Fakt lesen, um ihn wiederzuerkennen; ohne
-- Kategorie ist ein Filter unmöglich; ohne Volltextindex wird die Suche bei
-- ein paar hundert Fakten je Objekt ein Sequential Scan.
--
-- Dazu kommt die HERKUNFT als eigene Zeile. `source` sagt heute nur, WELCHER
-- ART ein Fakt ist ('manual' | 'document' | 'message'). Bei einem Fakt aus
-- einem PDF ist das zu wenig: welche Datei war es, wer hat sie hochgeladen,
-- wann? Ohne diese Angaben kann niemand entscheiden, ob ein Fakt noch gilt —
-- „Türcode 4711" aus der Hausordnung von 2024 sieht genauso aus wie einer von
-- gestern.
--
-- KATEGORIE ALS FESTE MENGE, nicht als Freitext: frei tippbare Kategorien
-- laufen binnen Wochen auseinander ("WLAN", "Wlan", "Internet"), und der
-- Filter darüber wird wertlos. Sieben Werte, abgeleitet aus den Fragen, die
-- Gäste tatsächlich stellen.
--
-- SICHERHEIT (Wurzel 6): `ki_wissen_quelle` bekommt dieselbe Behandlung wie
-- `inbox_knowledge_fact` — RLS, restriktive Policy `for all` UND Entzug aller
-- Rechte für anon/authenticated. Dort stehen Pfade zu hochgeladenen
-- Hausordnungen; die enthalten Türcodes und Alarmcodes.

-- --------------------------------------------------------------------------
-- Herkunft eines Fakts
-- --------------------------------------------------------------------------
create table if not exists public.ki_wissen_quelle (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants (id) on delete cascade,
    -- NULL = betriebsweit hochgeladen (gilt für alle Objekte)
    property_id uuid references public.properties (id) on delete cascade,

    -- Dieselben Werte wie inbox_knowledge_fact.source, plus 'objektdaten' für
    -- Fakten, die aus der Gästemappe abgeleitet wurden.
    art text not null
        check (art in ('manuell', 'dokument', 'nachricht', 'objektdaten')),

    -- Nur bei art='dokument' gesetzt: Anzeigename und Ablagepfad im Bucket.
    datei_name text,
    datei_pfad text,
    datei_groesse_bytes integer check (datei_groesse_bytes is null
                                       or datei_groesse_bytes >= 0),

    -- Nur bei art='nachricht': aus welchem Thread stammt der Fakt. Kein
    -- Fremdschlüssel, weil ein Thread je nach Quelle in channex_booking oder
    -- whatsapp_conversation liegt (dieselbe Begründung wie in 0493).
    thread_id text,

    hochgeladen_von uuid references public.users (id) on delete set null,
    created_at timestamptz not null default now(),

    constraint ki_wissen_quelle_datei_name_laenge
        check (datei_name is null or length(datei_name) <= 300),
    constraint ki_wissen_quelle_datei_pfad_laenge
        check (datei_pfad is null or length(datei_pfad) <= 600),
    -- Ein Dokument ohne Pfad wäre eine Quelle, zu der man nicht zurückkommt.
    constraint ki_wissen_quelle_dokument_hat_pfad
        check (art <> 'dokument' or datei_pfad is not null)
);

create index if not exists ki_wissen_quelle_tenant_idx
    on public.ki_wissen_quelle (tenant_id, property_id, created_at desc);

comment on table public.ki_wissen_quelle is
    'Woher ein Fakt der Wissensdatenbank stammt. Enthält Pfade zu Dokumenten '
    'mit Türcodes → kein Direktzugriff für anon/authenticated.';

-- --------------------------------------------------------------------------
-- inbox_knowledge_fact erweitern
-- --------------------------------------------------------------------------
alter table public.inbox_knowledge_fact
    add column if not exists titel text;

alter table public.inbox_knowledge_fact
    add column if not exists kategorie text not null default 'sonstiges';

alter table public.inbox_knowledge_fact
    add column if not exists quelle_id uuid;

-- on delete SET NULL, nicht CASCADE: wird ein Dokument gelöscht, bleiben die
-- daraus BESTÄTIGTEN Fakten bestehen. Der Betrieb hat sie geprüft und
-- übernommen; sie gehören ihm, nicht der Datei.
alter table public.inbox_knowledge_fact
    drop constraint if exists inbox_knowledge_fact_quelle_fk;
alter table public.inbox_knowledge_fact
    add constraint inbox_knowledge_fact_quelle_fk
    foreign key (quelle_id) references public.ki_wissen_quelle (id)
    on delete set null;

alter table public.inbox_knowledge_fact
    drop constraint if exists inbox_knowledge_fact_kategorie_chk;
alter table public.inbox_knowledge_fact
    add constraint inbox_knowledge_fact_kategorie_chk
    check (kategorie in ('objekt', 'anreise', 'buchung', 'umgebung',
                         'stoerung', 'ausstattung', 'sonstiges'));

alter table public.inbox_knowledge_fact
    drop constraint if exists inbox_knowledge_fact_titel_laenge;
alter table public.inbox_knowledge_fact
    add constraint inbox_knowledge_fact_titel_laenge
    check (titel is null or length(btrim(titel)) between 1 and 200);

comment on column public.inbox_knowledge_fact.titel is
    'Kurzbezeichnung für die Liste. NULL bei Altbestand aus 0260 — die '
    'Oberfläche zeigt dort den Anfang des Fakttextes.';
comment on column public.inbox_knowledge_fact.kategorie is
    'Feste Menge aus sieben Werten. Freitext würde binnen Wochen auseinander '
    'laufen und den Filter wertlos machen.';

-- --------------------------------------------------------------------------
-- Volltextsuche
-- --------------------------------------------------------------------------
-- GIN über Titel UND Fakttext zusammen: gesucht wird nach Stichwort, und ob
-- das Wort im Titel oder im Text steht, ist dem Suchenden gleich.
-- 'simple' statt einer Sprachkonfiguration, weil die Fakten mehrsprachig
-- sind — ein deutscher Stemmer würde dänische Wörter verstümmeln.
create index if not exists inbox_knowledge_fact_suche_idx
    on public.inbox_knowledge_fact
    using gin (to_tsvector('simple', coalesce(titel, '') || ' ' || fact));

-- Trigram-Index für die Teilwortsuche der Oberfläche (ILIKE '%xyz%').
-- Volltext findet ganze Wörter, die Suchleiste tippt aber mittendrin.
create extension if not exists pg_trgm;

create index if not exists inbox_knowledge_fact_trgm_idx
    on public.inbox_knowledge_fact
    using gin ((coalesce(titel, '') || ' ' || fact) gin_trgm_ops);

-- Die Objektliste zählt Fakten je Objekt und sortiert nach letzter Änderung.
create index if not exists inbox_knowledge_fact_geaendert_idx
    on public.inbox_knowledge_fact (tenant_id, property_id, updated_at desc);

-- --------------------------------------------------------------------------
-- RLS + Rechte (Wurzel 6)
-- --------------------------------------------------------------------------
alter table public.ki_wissen_quelle enable row level security;

drop policy if exists ki_wissen_quelle_tenant on public.ki_wissen_quelle;
create policy ki_wissen_quelle_tenant on public.ki_wissen_quelle
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

drop policy if exists ki_wissen_quelle_kein_direktzugriff on public.ki_wissen_quelle;
create policy ki_wissen_quelle_kein_direktzugriff on public.ki_wissen_quelle
    as restrictive for all
    using (false)
    with check (false);

revoke all on public.ki_wissen_quelle from anon, authenticated;

-- --------------------------------------------------------------------------
-- Bucket für hochgeladene Dokumente
-- --------------------------------------------------------------------------
-- PRIVAT: die Hausordnung enthält Türcode und Alarmcode. Der Zugriff läuft
-- ausschliesslich über signierte URLs vom Server, nie über einen öffentlichen
-- Bucket-Pfad. 20 MB Deckel und nur PDF — beides zusätzlich serverseitig
-- geprüft (Magic-Bytes), weil ein Client-content_type nichts beweist.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ki-wissen-dokumente', 'ki-wissen-dokumente', false, 20971520,
        array['application/pdf'])
on conflict (id) do update
    set public = false,
        file_size_limit = 20971520,
        allowed_mime_types = array['application/pdf'];
