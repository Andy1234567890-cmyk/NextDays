-- 0667_kontakte_customer_notes.sql — Notizen mit Schlagwörtern je Kunde (Bereich »kontakte«)
--
-- WARUM: `customers.notes` (0023) ist EIN Freitextfeld ohne Autor und Zeit —
-- wer wann was notiert hat, ging verloren, und das alte Werkzeug hatte für
-- die Kundenhistorie nur `customer_activities` ohne `create table`. Hier ist
-- jede Notiz eine Zeile:
--
--   * `created_by` + `author_name`: Autor als Referenz UND als Namens-
--     Schnappschuss zum Zeitpunkt des Schreibens — wird ein Nutzer später
--     gelöscht oder umbenannt, bleibt lesbar, wer notiert hat.
--   * `created_at` ist der Zeitpunkt der Notiz — hier ist unsere Uhr die
--     richtige, weil die Notiz bei uns entsteht (Wurzel 5b gilt für FREMDE
--     Ereignisse; `updated_at` sagt, wann sie zuletzt geändert wurde).
--   * `tags text[]`: Schlagwörter am Kunden hängen an seinen Notizen; die
--     Übersicht (`GET /customers/{id}/overview`) fasst sie je Kunde zusammen.
--     Keine eigene Tag-Tabelle — die Menge je Betrieb ist klein, und ein
--     Schlagwort ohne Notiz sagt nichts.
--
-- Interne Vermerke über Kunden (Wurzel 6): RLS + revoke für anon/authenticated,
-- KEINE Realtime-Publikation.

create table if not exists public.customer_notes (
    id           uuid primary key default gen_random_uuid(),
    tenant_id    uuid not null references public.tenants(id) on delete cascade,
    customer_id  uuid not null references public.customers(id) on delete cascade,
    text         text not null check (length(text) between 1 and 5000),
    tags         text[] not null default '{}'::text[],
    created_by   uuid,
    author_name  text,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
);

create index if not exists customer_notes_tenant_customer_idx
    on public.customer_notes (tenant_id, customer_id, created_at desc);

drop trigger if exists trg_customer_notes_updated on public.customer_notes;
create trigger trg_customer_notes_updated
    before update on public.customer_notes
    for each row execute function public.set_updated_at();

alter table public.customer_notes enable row level security;

drop policy if exists customer_notes_tenant on public.customer_notes;
create policy customer_notes_tenant on public.customer_notes
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- Wurzel 6: der Direktpfad (PostgREST mit anon-Key + JWT) bleibt zu.
revoke select, insert, update, delete on public.customer_notes from anon, authenticated;
