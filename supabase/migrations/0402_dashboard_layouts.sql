-- Frei anordnbare Startseite: gespeichertes Kachel-Layout je Benutzer plus ein
-- vom Betrieb gesetzter Standard je Rolle.
--
-- ACHTUNG, Vorgeschichte: `public.dashboard_layouts` gibt es seit Migration
-- 0014 („Dashboard-Personalisierung, Lastenheft §2.1") — angelegt, aber nie
-- benutzt. Diese Migration legt sie deshalb NICHT neu an, sondern nimmt sie in
-- Betrieb und haertet sie. Wer hier eine zweite Layout-Tabelle anlegt, hat
-- danach zwei Wahrheitsorte. Neu ist nur `dashboard_role_defaults`.
--
-- Zwei Tabellen, weil es zwei verschiedene Dinge sind:
--   dashboard_layouts       — was DIESER Nutzer fuer sich eingestellt hat.
--   dashboard_role_defaults — was der Betrieb neuen Nutzern einer Rolle vorgibt
--                             und worauf „Zuruecksetzen" zurueckfaellt.
--
-- Der Kachel-KATALOG steht bewusst NICHT in der DB, sondern im Code
-- (web/lib/dashboard-katalog.ts). Er ist die Wahrheit darueber, welche Kacheln
-- es gibt; das gespeicherte Layout ist nur ein Overlay von Positionen. Eine
-- Kachel, die es im Code nicht mehr gibt, wird beim Laden verworfen; eine neue
-- Kachel wird angehaengt statt ausgeblendet (Wurzel 4: kein erfundener Wert,
-- sondern der Katalog-Default).
--
-- `layout` ist jsonb aus Client-Hand. Die Form erzwingt der FastAPI-Slice
-- (Pydantic: Literal der Katalog-IDs, x/y als int 0..200, groesse s|m|l, max.
-- 40 Eintraege) — hier steht nur ein Struktur-Backstop, damit selbst ein
-- direkter service_role-Schreibfehler kein Array statt eines Objekts ablegt.
--
-- Sensibel? Das eigene Layout ist harmlos, die ROLLEN-STANDARDS sind es nicht:
-- sie sind eine tenant-weite Vorgabe fuer FREMDE Konten, die nur MANAGE_TENANT
-- setzen darf. Beide Tabellen daher nach Wurzel 6 gehaertet (RLS + harter
-- GRANT-Entzug + restriktive Policy fuer ALLE Operationen, nicht nur select).

-- --- Bestandstabelle aus 0014 in Betrieb nehmen ------------------------------
-- Struktur bleibt wie sie ist (id-PK, unique(user_id), FK auf public.users,
-- set_updated_at-Trigger). Der Slice upsertet auf user_id — dafuer reicht das
-- Unique. Ergaenzt wird nur der Struktur-Backstop auf `layout`.
do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'dashboard_layouts_layout_ist_objekt'
    ) then
        alter table public.dashboard_layouts
            add constraint dashboard_layouts_layout_ist_objekt
            check (jsonb_typeof(layout) = 'object');
    end if;
end
$$;

comment on table public.dashboard_layouts is
    'Kachel-Anordnung der Startseite je Benutzer (seit 0014 vorhanden, seit '
    '0402 in Betrieb). Fehlende Zeile = Rollen-Standard, sonst Katalog-Standard '
    'aus dem Code. Nur der Server (service_role) ueber den dashboard_layout-'
    'Slice schreibt hier.';

-- --- Standard je Rolle, gesetzt von der Betriebsleitung ----------------------
create table if not exists public.dashboard_role_defaults (
    tenant_id  uuid not null references public.tenants (id) on delete cascade,
    role       public.user_role not null,
    layout     jsonb not null,
    updated_at timestamptz not null default now(),

    primary key (tenant_id, role),

    constraint dashboard_role_defaults_layout_ist_objekt
        check (jsonb_typeof(layout) = 'object')
);

comment on table public.dashboard_role_defaults is
    'Startseiten-Standard je Rolle innerhalb eines Betriebs. Wird von neuen '
    'Nutzern geerbt und ist das Ziel von „Auf Standard zuruecksetzen". Setzen '
    'verlangt MANAGE_TENANT (im FastAPI-Slice geprueft).';

-- --- Haertung (Wurzel 6) ----------------------------------------------------
alter table public.dashboard_layouts enable row level security;
alter table public.dashboard_role_defaults enable row level security;

-- Kein pauschales Grant an anon/authenticated: der einzige Schreib- UND Lesepfad
-- ist der FastAPI-Slice mit service_role. Falls Default-Privilegien etwas
-- gesetzt haben: entziehen.
revoke all on public.dashboard_layouts from anon, authenticated;
revoke all on public.dashboard_role_defaults from anon, authenticated;

-- Restriktive Guards fuer ALLE Operationen (nicht nur select — sonst waere der
-- SCHREIB-Pfad tenant- bzw. nutzerweit offen, sobald je ein Grant hinzukaeme).
drop policy if exists dashboard_layouts_self_restrict on public.dashboard_layouts;
create policy dashboard_layouts_self_restrict on public.dashboard_layouts
    as restrictive for all
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

drop policy if exists dashboard_role_defaults_tenant_restrict
    on public.dashboard_role_defaults;
create policy dashboard_role_defaults_tenant_restrict
    on public.dashboard_role_defaults
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- --- Realtime: bewusst AUS ---------------------------------------------------
-- `dashboard_layouts` war seit 0014 Mitglied der Publikation `supabase_realtime`
-- — ohne je ein select-Grant fuer `authenticated` zu haben. Ein Abo darauf
-- koennte also nie feuern: genau die stumme Attrappe, die die Projektregel
-- benennt. Der Grant ist hier NICHT nachzuholen (Wurzel 6, siehe oben), also
-- wird die Mitgliedschaft entfernt, damit niemand ein Abo darauf baut.
-- Das eigene Layout aendert man ohnehin im eigenen Tab; ein zweiter Tab zieht
-- beim naechsten Aufruf nach.
do $$
begin
    if exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'dashboard_layouts'
    ) then
        alter publication supabase_realtime drop table public.dashboard_layouts;
    end if;
end
$$;
