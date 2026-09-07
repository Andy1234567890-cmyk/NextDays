-- 0597 — CRM (Lastenheft §2.6): Status-Workflow, Quellen, Zuständigkeit,
--        Notizen-Verlauf, strukturierte Adressen, Deals mit Mandant + Code.
--
-- Die Tabellen aus 0013 waren ein Gerüst: `status text default 'new'` ohne
-- Werteliste, `lead_source text` frei, `notes text` als EIN überschreibbares
-- Feld, `deals` ohne tenant_id (Scope nur über den Partner) und ohne
-- Eindeutigkeit des Rabattcodes. Diese Migration macht daraus das Modell, das
-- der crm-Slice erzwingt.
--
-- Datenlage: `leads`/`partners`/`deals` wurden bis heute von keinem Codepfad
-- beschrieben (REQUIREMENTS-GAP §2.6: `table("leads")` 0 Treffer). Die neuen
-- CHECKs treffen deshalb keinen Bestand; stünde doch eine abweichende Zeile
-- darin, schlägt das Einspielen LAUT fehl — besser als eine stille
-- Umschreibung fremder Daten (Bereinigung nur nach Absicht, nicht Etikett).

-- ---------------------------------------------------------------------------
-- leads
-- ---------------------------------------------------------------------------

-- Status-Workflow: new → contacted → visit_scheduled → offer_sent →
-- contract_sent → won | lost. Übergänge erzwingt der Service (Zustandsgraph
-- in crm/common.py); die DB hält die Werteliste als Backstop.
alter table public.leads
    add constraint leads_status_check check (
        status in (
            'new', 'contacted', 'visit_scheduled', 'offer_sent',
            'contract_sent', 'won', 'lost'
        )
    );

-- Marketing-Attribution als feste Werteliste (Dropdown). NULL = nicht erfasst.
alter table public.leads
    add constraint leads_lead_source_check check (
        lead_source is null or lead_source in (
            'website', 'referral', 'portal', 'event', 'cold_call', 'social', 'other'
        )
    );

alter table public.leads
    -- Warum verloren (nur bei status = 'lost' gesetzt; der Service verlangt es).
    add column lost_reason           text,
    -- Zuständiger Nutzer des Betriebs; verschwindet der Nutzer, bleibt der Lead.
    add column assigned_user_id      uuid references public.users (id) on delete set null,
    -- Nächster Schritt (Wiedervorlage) — Zeitpunkt UNSERER Planung.
    add column next_action_at        timestamptz,
    -- Konvertierung (Wurzel 2, idempotent): steht hier eine ID, gibt der
    -- zweite Aufruf dieselbe zurück, statt einen zweiten Eigentümer anzulegen.
    add column converted_owner_id    uuid references public.owners (id) on delete set null,
    add column converted_property_id uuid references public.properties (id) on delete set null,
    -- Strukturierte Anschrift des Interessenten (Lastenheft §6: Straße,
    -- Hausnummer, PLZ, Ort, Land getrennt). `address` (Freitext, 0013) bleibt
    -- für Altbestand/Import stehen.
    add column street                text,
    add column house_number          text,
    add column postal_code           text,
    add column city                  text,
    add column country               text,
    -- Strukturierte Anschrift des potenziellen Objekts; wird bei der
    -- Konvertierung in die Objekt-Adresse übernommen. `object_address` bleibt.
    add column object_street         text,
    add column object_house_number   text,
    add column object_postal_code    text,
    add column object_city           text,
    add column object_country        text;

alter table public.leads
    add constraint leads_country_iso2 check (country is null or country ~ '^[A-Z]{2}$'),
    add constraint leads_object_country_iso2 check (
        object_country is null or object_country ~ '^[A-Z]{2}$'
    ),
    -- Ein verlorener Lead trägt einen Grund; jeder andere Status keinen Grund
    -- ohne Zustand. Der Service verlangt den Grund beim Setzen (422).
    add constraint leads_lost_reason_only_when_lost check (
        lost_reason is null or status = 'lost'
    ),
    -- Gewonnen heißt: ein Eigentümer ist entstanden. Kein `won` ohne ihn.
    add constraint leads_won_has_owner check (
        status <> 'won' or converted_owner_id is not null
    );

create index leads_tenant_status_idx on public.leads (tenant_id, status);
create index leads_tenant_assigned_idx on public.leads (tenant_id, assigned_user_id);
create index leads_tenant_next_action_idx on public.leads (tenant_id, next_action_at);

-- updated_at pflegen (Helfer aus 0007).
drop trigger if exists leads_set_updated_at on public.leads;
create trigger leads_set_updated_at
    before update on public.leads
    for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- lead_notes — Gesprächsverlauf, append-only
-- ---------------------------------------------------------------------------
-- Warum eine Tabelle statt `leads.notes`: ein Freitextfeld überschreibt bei
-- jedem Speichern den Verlauf — wer wann was mit dem Interessenten besprochen
-- hat, ist danach weg. Notizen werden angehängt, nie geändert oder gelöscht
-- (kein UPDATE/DELETE-Pfad im Service, kein Schreib-GRANT). `leads.notes`
-- bleibt als Altfeld stehen.
create table public.lead_notes (
    id         uuid primary key default gen_random_uuid(),
    tenant_id  uuid not null references public.tenants (id) on delete cascade,
    lead_id    uuid not null references public.leads (id) on delete cascade,
    -- Verfasser; verlässt er den Betrieb, bleibt die Notiz (Verlauf ist Tatsache).
    author_id  uuid references public.users (id) on delete set null,
    body       text not null check (length(body) between 1 and 5000),
    created_at timestamptz not null default now()
);

create index lead_notes_lead_created_idx on public.lead_notes (lead_id, created_at desc);
create index lead_notes_tenant_idx on public.lead_notes (tenant_id);

alter table public.lead_notes enable row level security;

-- Permissive tenant-Policie (Lesen). Ohne sie ist RLS default-deny.
create policy lead_notes_tenant on public.lead_notes
    for select using (tenant_id = public.current_tenant_id());

-- Restriktiver Rollen-Guard wie 0596: nur admin/co_admin lesen, niemand
-- schreibt direkt (Wurzel 6).
create policy lead_notes_read_admin_only on public.lead_notes
    as restrictive for all
    using (public.current_user_role() in ('admin', 'co_admin'))
    with check (false);

revoke insert, update, delete on public.lead_notes from anon, authenticated;
revoke select on public.lead_notes from anon;
grant select on public.lead_notes to authenticated;

-- Realtime: die Detailansicht des Leads hört auf neue Notizen.
do $$
begin
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public'
          and tablename = 'lead_notes'
    ) then
        alter publication supabase_realtime add table public.lead_notes;
    end if;
end $$;

comment on table public.lead_notes is
    'CRM (0597): Gesprächsnotizen je Lead, append-only. Nur admin/co_admin lesen; '
    'Schreiben ausschließlich über die API (service_role).';

-- ---------------------------------------------------------------------------
-- partners — strukturierte Anschrift + getrennte Kontaktwege
-- ---------------------------------------------------------------------------
alter table public.partners
    add column street        text,
    add column house_number  text,
    add column postal_code   text,
    add column city          text,
    add column country       text,
    add column contact_email text,
    add column contact_phone text;

alter table public.partners
    add constraint partners_country_iso2 check (country is null or country ~ '^[A-Z]{2}$');

drop trigger if exists partners_set_updated_at on public.partners;
create trigger partners_set_updated_at
    before update on public.partners
    for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- deals — Mandant direkt, Code eindeutig je Mandant, Gültigkeit, Gastportal-Flag
-- ---------------------------------------------------------------------------
-- tenant_id direkt an der Zeile: der Service scopt jeden per-ID-Zugriff über
-- `load_scoped(db, "deals", id, tenant_id)` (Wurzel 3). Bisher hing der Scope
-- nur am Partner — eine Zeile per ID zu laden und DANN den Partner zu prüfen
-- ist genau das getrennte Load/Scope, das Wurzel 3 verbietet.
alter table public.deals
    add column tenant_id uuid references public.tenants (id) on delete cascade;

update public.deals d
   set tenant_id = pa.tenant_id
  from public.partners pa
 where pa.id = d.partner_id
   and d.tenant_id is null;

alter table public.deals
    alter column tenant_id set not null;

alter table public.deals
    -- Gültigkeit (beide optional; Ende inklusiv, weil ein Gutschein „bis 31.12."
    -- am 31.12. noch gilt — anders als Nächte-Ranges).
    add column gueltig_von            date,
    add column gueltig_bis            date,
    -- Vorbereitung Gastportal: JETZT nur das Feld, kein Rendering (Etappe 7).
    add column im_gastportal_sichtbar boolean not null default false;

alter table public.deals
    add constraint deals_gueltigkeit_check check (
        gueltig_von is null or gueltig_bis is null or gueltig_bis >= gueltig_von
    ),
    -- Prozent über 100 ist kein Rabatt, sondern ein Tippfehler.
    add constraint deals_percent_max_100 check (
        discount_kind <> 'percent' or discount_value <= 100
    ),
    -- Fixbetrag ohne Währung ist kein Betrag (Wurzel 4: nie raten).
    add constraint deals_fixed_needs_currency check (
        discount_kind <> 'fixed' or currency is not null
    ),
    add constraint deals_currency_iso4217 check (currency is null or currency ~ '^[A-Z]{3}$');

-- Rabattcode eindeutig je Mandant (Backstop unter der Service-Prüfung, Wurzel 2).
create unique index deals_tenant_discount_code_key
    on public.deals (tenant_id, discount_code)
    where discount_code is not null;

create index deals_tenant_idx on public.deals (tenant_id);

-- Mandant der Zeile muss zum Mandanten des Partners passen — ein Deal darf
-- nicht an einen fremden Partner gehängt werden. Trigger statt CHECK, weil
-- ein CHECK keine andere Tabelle lesen darf.
create or replace function public.deals_tenant_matches_partner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    partner_tenant uuid;
begin
    select tenant_id into partner_tenant from public.partners where id = new.partner_id;
    if partner_tenant is null then
        raise exception 'Partner % existiert nicht.', new.partner_id
            using errcode = '23503';
    end if;
    if new.tenant_id <> partner_tenant then
        raise exception 'Deal-Mandant % passt nicht zum Partner-Mandanten %.',
            new.tenant_id, partner_tenant
            using errcode = '23514';
    end if;
    return new;
end
$$;

revoke execute on function public.deals_tenant_matches_partner() from anon, authenticated;

drop trigger if exists deals_tenant_matches_partner on public.deals;
create trigger deals_tenant_matches_partner
    before insert or update of tenant_id, partner_id on public.deals
    for each row execute function public.deals_tenant_matches_partner();

-- Zusätzlicher restriktiver tenant-Guard direkt über tenant_id (die
-- Partner-Verknüpfung aus 0337 bleibt bestehen; beide gelten UND-verknüpft).
drop policy if exists deals_tenant_id_restrict on public.deals;
create policy deals_tenant_id_restrict on public.deals
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

drop trigger if exists deals_set_updated_at on public.deals;
create trigger deals_set_updated_at
    before update on public.deals
    for each row execute function public.set_updated_at();
