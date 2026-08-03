-- Kanal-Einschränkung für Steuern und Gebühren: n Tax-Sets je Objekt.
--
-- HINTERGRUND: Eine Steuer/Gebühr soll nicht an JEDES Portal gehen. Airbnb und
-- Booking ziehen die Ortstaxe in manchen Regionen selbst ein — wird sie zusätzlich
-- übertragen, zahlt der Gast sie doppelt.
--
-- Channex kennt dafür KEIN Feld an der Steuer selbst (live geprüft 03.08.2026:
-- `channels`, `excluded_channels`, `restrict_to_channels`, `channel_codes` und
-- `ota_ids` werden bei POST /taxes mit 201 angenommen und still verworfen — im
-- Readback taucht keines auf). Die einzige Achse, die Channex wirklich anbietet,
-- ist `tax_set_id` AM RATE-PLAN. Ein Objekt darf mehrere Tax-Sets haben.
--
-- Also: Standard-Set für die normalen Rate-Plans, plus je Portal-Kanal-Plan
-- (rate_plans.portal_scope, 0272) ein eigenes Set mit nur den dort erlaubten
-- Posten. Diese Tabelle merkt sich, welches Channex-Set zu welchem Portal gehört,
-- damit der Sync es wiederfindet (idempotent, Wurzel 2) und ein überflüssig
-- gewordenes Set wieder abräumen kann (Gegenzustand, Wurzel 1).
--
-- Warum eine eigene Tabelle statt channex_tax_map.channex_tax_set_id: dort hängt
-- die Set-ID an JEDER Steuer-Zeile (1 Set je Objekt). Mehrere Sets pro Objekt
-- lassen sich dort nicht abbilden, ohne die Bedeutung der Spalte zu brechen. Die
-- Altspalte bleibt unverändert bestehen (sie trägt weiterhin das Standard-Set).

create table if not exists public.channex_tax_set_map (
    id                  uuid primary key default gen_random_uuid(),
    tenant_id           uuid not null references public.tenants(id) on delete cascade,
    property_id         uuid not null references public.properties(id) on delete cascade,
    -- NULL = Standard-Set (alle Rate-Plans ohne portal_scope). Sonst der
    -- Portal-Code wie in rate_plans.portal_scope ("BookingCom", "AirBNB", …).
    portal_scope        text,
    channex_tax_set_id  text not null,
    deleted_at          timestamptz,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);

-- Ein Set je (Objekt, Portal). NULL-Portal ist dabei ein eigener Wert, deshalb
-- zwei Indizes: Postgres behandelt NULL in einem UNIQUE nicht als gleich, ein
-- einzelner Index ließe beliebig viele Standard-Sets zu (Wurzel 2).
create unique index if not exists channex_tax_set_map_portal_uidx
    on public.channex_tax_set_map (property_id, portal_scope)
    where portal_scope is not null;
create unique index if not exists channex_tax_set_map_standard_uidx
    on public.channex_tax_set_map (property_id)
    where portal_scope is null;
create index if not exists channex_tax_set_map_tenant_idx
    on public.channex_tax_set_map (tenant_id);

comment on table public.channex_tax_set_map is
    'Channex-Tax-Sets je Objekt und Portal. portal_scope NULL = Standard-Set; '
    'sonst das eingeschränkte Set des Kanal-Plans dieses Portals (0272). '
    'Kanal-Einschränkung geht NUR über den Rate-Plan — Channex hat kein '
    'Kanal-Feld an der Steuer selbst.';

-- RLS: Pflicht für jede neue public-Tabelle. Zusätzlich zur Tenant-Policy den
-- Direktpfad schließen (Wurzel 6) — das ist reine Server-Buchführung über
-- externe IDs, kein Client hat dort etwas zu suchen, weder lesend noch
-- schreibend. Ohne den REVOKE stünde die Tabelle einem eingeloggten cleaner
-- per anon-Key-curl offen.
alter table public.channex_tax_set_map enable row level security;

drop policy if exists channex_tax_set_map_tenant on public.channex_tax_set_map;
create policy channex_tax_set_map_tenant
    on public.channex_tax_set_map
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

drop policy if exists channex_tax_set_map_tenant_restrict on public.channex_tax_set_map;
create policy channex_tax_set_map_tenant_restrict
    on public.channex_tax_set_map
    as restrictive
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke all on public.channex_tax_set_map from anon, authenticated;
