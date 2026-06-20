-- Nummernkreise für die Buchhaltung (GoBD: lückenlose, fortlaufende Nummern).
-- Pro Tenant + Dokumenttyp (+ optional Jahr) ein Zähler. Das atomare Hochzählen
-- übernimmt die Funktion next_document_number() (Row-Lock), damit unter Last
-- keine Duplikate/Lücken entstehen.

create table if not exists public.number_sequences (
    id            uuid primary key default gen_random_uuid(),
    tenant_id     uuid not null references public.tenants(id) on delete cascade,
    doc_type      text not null,                       -- 'invoice'|'quote'|'credit_note'|'storno'
    prefix        text not null default 'RE-',
    next_value    integer not null default 1,          -- nächste auszugebende Nummer
    padding       integer not null default 4,          -- Stellen (z.B. 0001)
    year          integer,                             -- optional jahresbezogen
    suffix        text not null default '',
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now(),
    unique (tenant_id, doc_type, year)
);

alter table public.number_sequences enable row level security;

create policy number_sequences_tenant on public.number_sequences
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

create trigger trg_number_sequences_updated
    before update on public.number_sequences
    for each row execute function public.set_updated_at();

-- Atomar die nächste Nummer ziehen (legt den Kreis bei Bedarf an).
-- Gibt next_value VOR dem Hochzählen zurück und erhöht den Zähler.
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
    -- Kreis sperren (oder anlegen).
    select * into v_row
    from public.number_sequences
    where tenant_id = p_tenant_id and doc_type = p_doc_type and year is null
    for update;

    if not found then
        insert into public.number_sequences (tenant_id, doc_type, prefix)
        values (p_tenant_id, p_doc_type, p_prefix)
        returning * into v_row;
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

revoke all on function public.next_document_number(uuid, text, text) from public;
grant execute on function public.next_document_number(uuid, text, text) to service_role;
