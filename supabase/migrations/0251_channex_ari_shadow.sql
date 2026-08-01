-- 0246_channex_ari_shadow.sql — lokaler Spiegel des zuletzt GEPUSHTEN ARI-Stands
--
-- Grund: Channex hat uns schriftlich untersagt, die ARI zurückzulesen
-- („We expect you to push only changes to Channex and not constantly read back
-- the ARI. You are the source of truth"). Der bisherige Desired-State-Abgleich
-- holte je Objekt 365 Tage Restriktionen per GET und verglich sie gegen das Soll
-- — genau dieses Muster entfällt.
--
-- Ersatz: WIR führen den Ist-Stand selbst. Nach jedem ERFOLGREICHEN Push wird der
-- gepushte Wert hier festgeschrieben; der nächste Lauf diffed das Soll (Resolver)
-- gegen diesen Schatten und pusht nur die Differenz. Schlägt ein Push fehl, bleibt
-- der Schatten unverändert → der nächste Lauf pusht denselben Tag erneut
-- (selbstheilend ohne einen einzigen Lesezugriff bei Channex).
--
-- Sensible Preisdaten (Wurzel 6): NUR service_role. RLS + Entzug der pauschalen
-- anon/authenticated-GRANTs, sonst wäre der PostgREST-Direktpfad offen.

create table if not exists public.channex_ari_shadow (
    tenant_id    uuid not null references public.tenants(id) on delete cascade,
    -- Lokaler Rate-Plan (nicht die Channex-ID): der Diff läuft gegen das lokale
    -- Soll, das ebenfalls je lokalem Plan berechnet wird.
    rate_plan_id uuid not null
                   references public.rate_plans(id) on delete cascade,
    property_id  uuid not null references public.properties(id) on delete cascade,
    date         date not null,
    -- Zuletzt erfolgreich gepushter Preis in Cent bzw. Mindestaufenthalt.
    -- NULL = für diesen Tag wurde der jeweilige Wert nie gepusht.
    rate_cents   integer  check (rate_cents is null or rate_cents >= 0),
    min_stay     smallint check (min_stay is null or min_stay >= 0),
    updated_at   timestamptz not null default now(),
    primary key (tenant_id, rate_plan_id, date)
);

create index if not exists channex_ari_shadow_property_date_idx
    on public.channex_ari_shadow (property_id, date);

alter table public.channex_ari_shadow enable row level security;
drop policy if exists channex_ari_shadow_tenant on public.channex_ari_shadow;
create policy channex_ari_shadow_tenant on public.channex_ari_shadow
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- Wurzel 6: Preisdaten schreibt/liest ausschließlich der Server.
revoke all on public.channex_ari_shadow from anon, authenticated;

comment on table public.channex_ari_shadow is
  'Zuletzt an Channex GEPUSHTER ARI-Stand je lokalem Rate-Plan und Tag. Ersetzt '
  'das verbotene Zurücklesen der ARI (get_restrictions): Diff = Soll (Resolver) '
  'vs. dieser Schatten. Nur service_role.';
