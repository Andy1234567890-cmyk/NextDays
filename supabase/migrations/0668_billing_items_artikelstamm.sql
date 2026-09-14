-- 0668_billing_items_artikelstamm.sql — Artikelstamm der Buchhaltung (Bereich »artikel«)
--
-- WARUM: Rechnungen und Angebote tragen Positionen, die ein Betrieb immer
-- wieder gleich schreibt („Endreinigung", „Bettwäsche-Set", „Kurtaxe je
-- Nacht"). Das alte Taskilo-Werkzeug hatte dafür einen `inventory`-Service mit
-- sieben Pfaden ins Leere (docs/buchhaltung/TASKILO-ABGLEICH-NEXTDAYS.md §3d)
-- und ein Datenmodell voller Lagerfelder (Bestand, Chargen, MHD, Gebinde), das
-- für eine Ferienvermietung nichts bedeutet. Hier bekommt der ARTIKELSTAMM der
-- Buchhaltung erstmals eine Tabelle — bewusst ohne Lagerführung.
--
-- ABGRENZUNG: `inventar_*` (0620, Inventar & Schäden) ist der HAUSRAT der
-- Objekte (Sofa, Kaffeemaschine, Schaden am Tisch). `billing_items` ist etwas
-- anderes: die Preisliste, aus der Rechnungspositionen übernommen werden.
-- Deshalb heißt die Tabelle nicht `inventory`.
--
--   * `item_number` kommt aus `next_document_number(tenant, 'item', 'ART-')`
--     (derselbe Nummernkreis-Mechanismus wie Kunden/Angebote), unique je
--     Tenant — Doppelklick und Retry beim Anlegen laufen in 23505 → 409
--     (Wurzel 2, DB-Backstop zusätzlich zur Service-Prüfung).
--   * `tax_rate` ist NOT NULL OHNE Default: der Steuersatz ist eine steuerliche
--     Aussage über den Betrieb (DK 25, LU 17, DE 19 …) und wird beim Anlegen
--     ausdrücklich gesetzt — eine „19" als Vorgabe wäre für 26 EU-Länder falsch
--     (Wurzel 4).
--   * `currency` ist NOT NULL OHNE Default: sie kommt aus dem Artikel oder aus
--     `tenants.currency`; fehlt beides, schlägt das Anlegen mit 422 fehl.
--   * `usage_count`/`last_used_at` zählen, wie oft der Artikel in eine Position
--     übernommen wurde (Sortierung „meistgenutzt", Favoriten-Vorschlag). Das
--     Hochzählen läuft atomar über `billing_item_mark_used` (0669), nicht als
--     read-modify-write im Service.
--
-- Finanz-Stammdaten sind server-only (Wurzel 6): RLS + revoke für
-- anon/authenticated, KEINE Realtime-Publikation.

create table if not exists public.billing_items (
    id              uuid primary key default gen_random_uuid(),
    tenant_id       uuid not null references public.tenants(id) on delete cascade,
    item_number     text not null,
    name            text not null check (length(btrim(name)) between 1 and 200),
    description     text check (description is null or length(description) <= 2000),
    unit            text not null check (length(btrim(unit)) between 1 and 40),
    unit_price      numeric(12,2) not null check (unit_price >= 0),
    tax_rate        numeric(5,2)  not null check (tax_rate >= 0 and tax_rate <= 100),
    currency        text not null check (currency ~ '^[A-Z]{3}$'),
    category        text check (category is null or length(category) <= 80),
    is_active       boolean not null default true,
    is_favorite     boolean not null default false,
    usage_count     integer not null default 0 check (usage_count >= 0),
    last_used_at    timestamptz,
    created_by      uuid,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    constraint billing_items_nummer_eindeutig unique (tenant_id, item_number)
);

create index if not exists billing_items_tenant_name_idx
    on public.billing_items (tenant_id, lower(name));

drop trigger if exists trg_billing_items_updated on public.billing_items;
create trigger trg_billing_items_updated
    before update on public.billing_items
    for each row execute function public.set_updated_at();

alter table public.billing_items enable row level security;

drop policy if exists billing_items_tenant on public.billing_items;
create policy billing_items_tenant on public.billing_items
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- Wurzel 6: der Direktpfad (PostgREST mit anon-Key + JWT) bleibt zu. Nur der
-- Server (service_role) liest und schreibt den Artikelstamm.
revoke select, insert, update, delete on public.billing_items from anon, authenticated;
