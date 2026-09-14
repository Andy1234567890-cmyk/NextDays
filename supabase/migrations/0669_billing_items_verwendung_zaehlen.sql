-- 0669_billing_items_verwendung_zaehlen.sql — Verwendungszähler atomar hochzählen
--
-- WARUM EINE FUNKTION: `POST /items/{id}/used` wird aus dem Positions-Editor
-- gerufen, sobald ein Artikel übernommen wird — und zwar von jedem Tab, jedem
-- Doppelklick, jedem Retry. Ein Service, der `usage_count` liest, +1 rechnet
-- und zurückschreibt, verliert unter zwei gleichzeitigen Aufrufen eine Zählung
-- (Wurzel 2). Hier zählt die Datenbank in EINEM `update … set usage_count =
-- usage_count + 1` — race-frei ohne Row-Lock im Service.
--
-- Der Tenant ist Pflichtparameter und Teil der WHERE-Klausel: die Funktion ist
-- SECURITY DEFINER (läuft an RLS vorbei), deshalb darf sie NIE nur per `id`
-- treffen (Wurzel 3). Fremder Tenant oder unbekannte ID → keine Zeile → der
-- Service antwortet 404.
--
-- `set search_path = ''` + schema-qualifizierte Namen + revoke für
-- anon/authenticated: nur der Server (service_role) darf zählen (Wurzel 6).

create or replace function public.billing_item_mark_used(
    p_tenant_id uuid,
    p_item_id   uuid
)
returns table (id uuid, usage_count integer, last_used_at timestamptz)
language sql
security definer
set search_path = ''
as $$
    update public.billing_items as b
       set usage_count  = b.usage_count + 1,
           last_used_at = now()
     where b.id = p_item_id
       and b.tenant_id = p_tenant_id
    returning b.id, b.usage_count, b.last_used_at;
$$;

revoke all on function public.billing_item_mark_used(uuid, uuid) from public;
revoke all on function public.billing_item_mark_used(uuid, uuid) from anon, authenticated;
grant execute on function public.billing_item_mark_used(uuid, uuid) to service_role;
