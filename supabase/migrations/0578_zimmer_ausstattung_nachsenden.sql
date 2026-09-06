-- 0578_zimmer_ausstattung_nachsenden.sql — Zimmer-Ausstattung aller verbundenen
-- Objekte einmalig neu an die Portale geben.
--
-- Anlass (06.09.2026): die Zimmer-Facility-Map des Content-Syncs trug 191 UUIDs,
-- von denen KEINE im Live-Katalog von Channex existierte. Channex nahm jeden
-- Push mit 200 an und legte nichts ab — jeder Room-Type stand bei allen Portalen
-- ohne Zimmer-Ausstattung, obwohl der Betrieb sie gepflegt hatte. Die Map ist
-- korrigiert; ein Objekt, das seither niemand speichert, würde aber bis zur
-- nächsten Änderung leer bleiben. Deshalb reiht diese Migration für jedes
-- verbundene, aktive Objekt genau EINEN Content-Sync ein — dieselbe Arbeit, die
-- das Speichern der Ausstattung auslöst, nur ohne dass jemand klicken muss.
--
-- Gestaffelt (25 s je Objekt): 45 Objekte × ~6 Channex-Aufrufe teilen sich das
-- kontoweite Anfrage-Budget mit dem laufenden Betrieb. Coalescing über den
-- kanonischen dedup_key (tenant:property:sync_property_content) — steht schon
-- ein Sync an, entsteht kein zweiter.
with ziele as (
    select
        m.tenant_id,
        m.property_id,
        row_number() over (order by m.tenant_id, m.property_id) as nr
    from public.channex_property_map m
    join public.properties p on p.id = m.property_id
    where m.deleted_at is null
      and m.sync_enabled
      and p.status = 'active'
)
insert into public.jobs (tenant_id, job_type, payload, dedup_key, run_after)
select
    z.tenant_id,
    'sync_property_content',
    jsonb_build_object(
        'tenant_id', z.tenant_id::text,
        'property_id', z.property_id::text,
        'title', null,
        'currency', null
    ),
    z.tenant_id::text || ':' || z.property_id::text || ':sync_property_content',
    now() + (z.nr * interval '25 seconds')
from ziele z
on conflict (dedup_key) where dedup_key is not null and status = 'queued'
do nothing;
