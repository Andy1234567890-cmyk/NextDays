-- 0105_number_sequences_race.sql — Nummernkreis race-sicher beim Erst-Zug
--
-- next_document_number() sperrt den Zähler per SELECT … FOR UPDATE. Existiert
-- noch KEINE Zähler-Zeile (allererster Beleg eines Tenants je doc_type), sperrt
-- FOR UPDATE nichts: zwei parallele Requests gehen beide in den INSERT. Der
-- bisherige Unique-Constraint (tenant_id, doc_type, year) griff dabei NICHT,
-- weil year beim INSERT immer NULL ist und NULLs im Default als verschieden
-- gelten → zwei Zähler-Zeilen, beide liefern RE-0001 (GoBD-Verstoß, doppelte
-- Rechnungsnummer; die Zähler divergieren ab da dauerhaft).
--
-- Fix in drei Schichten (Live-DB verifiziert: keine Duplikat-Zeilen mit
-- year IS NULL, keine doppelten invoice_numbers — gefahrlos einführbar):
--  1) Unique-Constraint NULLS NOT DISTINCT (PG 15): year NULL zählt als gleich
--     → der zweite Erst-INSERT kollidiert jetzt DB-seitig.
--  2) next_document_number(): Erst-Zug über INSERT … ON CONFLICT DO NOTHING +
--     erneutes SELECT FOR UPDATE — der Verlierer des Races wartet auf den
--     Gewinner und zieht danach die NÄCHSTE Nummer statt derselben.
--  3) Backstop auf dem Beleg selbst: unique (tenant_id, invoice_number) für
--     nicht gelöschte Rechnungen — selbst ein künftiger Codefehler kann keine
--     zwei aktiven Belege mit derselben Nummer mehr persistieren.

alter table public.number_sequences
    drop constraint number_sequences_tenant_id_doc_type_year_key;
alter table public.number_sequences
    add constraint number_sequences_tenant_id_doc_type_year_key
    unique nulls not distinct (tenant_id, doc_type, year);

create or replace function public.next_document_number(
    p_tenant_id uuid,
    p_doc_type  text,
    p_prefix    text default 'RE-'
)
returns table (sequential_number integer, formatted_number text)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_row public.number_sequences%rowtype;
begin
    -- Kreis sperren (oder race-sicher anlegen).
    select * into v_row
    from public.number_sequences
    where tenant_id = p_tenant_id and doc_type = p_doc_type and year is null
    for update;

    if not found then
        -- Erst-Zug: ON CONFLICT statt blindem INSERT. Verliert dieser Request
        -- das Race, blockiert der INSERT bis zum Commit des Gewinners (DO
        -- NOTHING) und das folgende SELECT FOR UPDATE liest dessen Zeile mit
        -- bereits hochgezähltem next_value.
        insert into public.number_sequences (tenant_id, doc_type, prefix)
        values (p_tenant_id, p_doc_type, p_prefix)
        on conflict on constraint number_sequences_tenant_id_doc_type_year_key
        do nothing;

        select * into v_row
        from public.number_sequences
        where tenant_id = p_tenant_id and doc_type = p_doc_type and year is null
        for update;
    end if;

    sequential_number := v_row.next_value;
    formatted_number := v_row.prefix
        || lpad(v_row.next_value::text, v_row.padding, '0')
        || v_row.suffix;

    update public.number_sequences
    set next_value = next_value + 1
    where id = v_row.id;

    return next;
end;
$$;

-- GoBD-Backstop: keine zwei aktiven Belege desselben Tenants mit derselben
-- Nummer (Entwürfe ohne Nummer und soft-gelöschte Belege ausgenommen).
create unique index if not exists invoices_tenant_number_uidx
    on public.invoices (tenant_id, invoice_number)
    where invoice_number is not null and deleted_at is null;
