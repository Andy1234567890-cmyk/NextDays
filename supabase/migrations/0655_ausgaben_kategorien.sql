-- 0655_ausgaben_kategorien.sql — Ausgabenkategorien (Bereich »ausgaben«)
--
-- WARUM: Das alte Werkzeug kannte Kategorien nur als feste Aufzählung im
-- Pydantic-Pattern (`office_supplies|travel|…|other`) und daneben ein
-- `NewCategoryModal`, dessen POST auf /api/v1/categories seit jeher in einen
-- 404 lief (Kommentar in web/components/finance/NewCategoryModal.tsx). Der
-- Betrieb konnte Kategorien eingeben, aber nie speichern.
--
-- Hier bekommt die Kategorie erstmals eine Tabelle, je Mandant:
--   * `name` eindeutig je Mandant (case-insensitiv) — ein Doppelklick auf
--     „Kategorie anlegen" legt keine zweite an (Wurzel 2, DB-Backstop).
--   * `booking_account` = das Buchungskonto (SKR03/04-Kontonummer als Text,
--     der Kontenplan ist ein Nachbar-Bereich und wird hier nicht referenziert;
--     die Kontonummer steht als Text, damit ein Konto-Import die Kategorie
--     nicht zerreißt).
--   * `kind` = Art der Kategorie, deckungsgleich mit dem Pydantic-Literal in
--     bereiche/ausgaben/schemas.py (Regel „DB-CHECK und Pydantic-Literal
--     deckungsgleich"). `einkauf`/`betrieb`/`personal`/`steuern`/`sonstiges`.
--   * `color`/`abbreviation` = die Darstellungsfelder des alten Modals.
--
-- Finanzdaten sind server-only (Wurzel 6): RLS + revoke für anon/authenticated,
-- KEINE Realtime-Publikation.

create table if not exists public.expense_categories (
    id               uuid primary key default gen_random_uuid(),
    tenant_id        uuid not null references public.tenants(id) on delete cascade,
    name             text not null check (length(btrim(name)) between 1 and 120),
    kind             text not null
                     check (kind in ('einkauf', 'betrieb', 'personal', 'steuern', 'sonstiges')),
    booking_account  text check (booking_account is null or length(booking_account) <= 20),
    color            text check (color is null or color ~ '^#[0-9a-fA-F]{6}$'),
    abbreviation     text check (abbreviation is null or length(abbreviation) <= 5),
    is_active        boolean not null default true,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now()
);

create unique index if not exists expense_categories_name_eindeutig
    on public.expense_categories (tenant_id, lower(btrim(name)));
create index if not exists expense_categories_tenant_idx
    on public.expense_categories (tenant_id, is_active);

drop trigger if exists trg_expense_categories_updated on public.expense_categories;
create trigger trg_expense_categories_updated
    before update on public.expense_categories
    for each row execute function public.set_updated_at();

alter table public.expense_categories enable row level security;

drop policy if exists expense_categories_tenant on public.expense_categories;
create policy expense_categories_tenant on public.expense_categories
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- Wurzel 6: Direktpfad zu. Nur der Server (service_role) liest und schreibt.
revoke select, insert, update, delete on public.expense_categories from anon, authenticated;
