-- 0490_whatsapp_vorlagen_ausgeblendet.sql — Vorlagen, die der Betrieb in
-- myNextDays nicht sehen will.
--
-- WARUM AUSBLENDEN UND NICHT LOESCHEN
-- ===================================
-- Der Papierkorb im Vorlagen-Reiter loeschte bisher bei META. Das ist fast nie
-- gemeint: eine dort geloeschte Vorlage ist endgueltig weg, mitsamt ihrer
-- Freigabe, und muss neu eingereicht und neu geprueft werden. Wer eine Vorlage
-- „wegraeumt", will sie in der Regel nur nicht mehr in seiner Liste haben —
-- etwa weil sein Betrieb sie nicht braucht.
--
-- Deshalb: der Papierkorb blendet hier aus, die Vorlage bleibt bei Meta
-- bestehen und laesst sich jederzeit wieder einblenden. Loeschen bei Meta ist
-- ein eigener, bewusster Schritt und nicht derselbe Knopf.
--
-- Der Schluessel ist (Betrieb, Vorlagenname, Sprache) — genauso fuehrt Meta
-- eine Vorlage, und einzelne Sprachfassungen sollen getrennt ausblendbar sein.
create table if not exists public.whatsapp_template_hidden (
    tenant_id     uuid not null references public.tenants(id) on delete cascade,
    template_name text not null,
    language      text not null,
    created_at    timestamptz not null default now(),
    primary key (tenant_id, template_name, language)
);

-- =========================================================================
-- RLS + Grant-Entzug (Wurzel 6)
-- =========================================================================
alter table public.whatsapp_template_hidden enable row level security;

drop policy if exists whatsapp_template_hidden_tenant
    on public.whatsapp_template_hidden;
create policy whatsapp_template_hidden_tenant on public.whatsapp_template_hidden
    for all using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke all on public.whatsapp_template_hidden from anon, authenticated;

drop policy if exists whatsapp_template_hidden_kein_direktzugriff
    on public.whatsapp_template_hidden;
create policy whatsapp_template_hidden_kein_direktzugriff
    on public.whatsapp_template_hidden
    as restrictive for all
    using (false)
    with check (false);

comment on table public.whatsapp_template_hidden is
    'In myNextDays ausgeblendete WhatsApp-Vorlagen. Bei Meta bleiben sie '
    'bestehen — Ausblenden ist nicht Loeschen.';
