-- 0112_number_sequences_constraint_defensive.sql — Constraint-Drop defensiv machen
--
-- BUG (Loop-Fund): 0105 droppt den Constraint
--   number_sequences_tenant_id_doc_type_year_key
-- OHNE `if exists` und verlässt sich damit auf den PostgreSQL-Auto-Namen. Wurde
-- der Constraint je manuell/abweichend benannt oder in einer Umgebung anders
-- angelegt, scheitert 0105 hart (relation … does not exist). 0105 ist bereits
-- live eingespielt und darf NICHT nachträglich editiert werden.
--
-- FIX: sicherstellen, dass GENAU der korrekte Constraint existiert —
--   unique nulls not distinct (tenant_id, doc_type, year)
-- über einen idempotenten DO-Block, der jeden gleichnamigen Constraint zuerst
-- defensiv (if exists) entfernt und ihn dann (falls fehlend) mit dem korrekten
-- NULLS-NOT-DISTINCT-Verhalten neu anlegt. Mehrfach ausführbar, ohne Wirkung,
-- wenn bereits korrekt.
--
-- Live verifiziert: der Constraint existiert bereits korrekt (0105 lief) — diese
-- Migration ist dort ein No-Op und härtet nur gegen abweichende Umgebungen.

do $$
declare
    v_conname text;
    v_def     text;
    v_correct boolean := false;
begin
    -- Existierenden Unique-Constraint auf (tenant_id, doc_type, year) suchen —
    -- unabhängig vom konkreten Namen (Auto-Name vs. manuell). Das
    -- NULLS-NOT-DISTINCT-Verhalten (Pflicht, sonst gelten zwei year-NULL-Zeilen
    -- als verschieden = der 0105-Bug) wird über pg_get_constraintdef geprüft:
    -- die pg_constraint-Spalte connullsnotdistinct ist in diesem Katalog nicht
    -- verfügbar, der Definitionstext dagegen zuverlässig.
    select c.conname, pg_get_constraintdef(c.oid)
      into v_conname, v_def
      from pg_constraint c
     where c.conrelid = 'public.number_sequences'::regclass
       and c.contype = 'u'
       and (
         select array_agg(a.attname::text order by a.attname::text)
           from pg_attribute a
          where a.attrelid = c.conrelid and a.attnum = any(c.conkey)
       ) = array['doc_type', 'tenant_id', 'year']::text[]
     limit 1;

    v_correct := v_def is not null
                 and position('nulls not distinct' in lower(v_def)) > 0;

    if v_conname is not null and v_correct then
        -- Bereits korrekt (NULLS NOT DISTINCT) → nichts tun.
        return;
    end if;

    -- Falscher/fehlender Constraint: defensiv entfernen (falls vorhanden) und
    -- korrekt neu anlegen.
    if v_conname is not null then
        execute format(
            'alter table public.number_sequences drop constraint if exists %I',
            v_conname
        );
    end if;

    alter table public.number_sequences
        add constraint number_sequences_tenant_id_doc_type_year_key
        unique nulls not distinct (tenant_id, doc_type, year);
end
$$;
