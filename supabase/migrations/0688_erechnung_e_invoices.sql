-- 0688_erechnung_e_invoices.sql — E-Rechnungen (Bereich »erechnung« der Buchhaltung)
--
-- WARUM: Das alte Taskilo-Werkzeug erzeugte XRechnung/ZUGFeRD im Browser
-- (web/services/eInvoiceService.ts) und schickte das XML an ein Backend, das
-- in eine nie angelegte Tabelle schrieb; die Links `/api/einvoices/{id}/xml`
-- liefen ins Leere. Hier bekommt die E-Rechnung erstmals eine Tabelle:
--
--   * Das XML liegt NICHT in der Zeile, sondern als Datei im privaten Bucket
--     `e-rechnungen` (`storage_path`); die Zeile trägt den SHA-256 des
--     Inhalts. Ein 10-MB-XML in einer Spalte macht jede Liste träge, und der
--     Hash ist die Idempotenz (Wurzel 2): derselbe Inhalt zur selben
--     Rechnung ist EINE E-Rechnung — Doppelklick und Retry treffen den
--     Unique-Index und bekommen die vorhandene Zeile zurück.
--   * `format` ist die genaue Syntax (UBL, CII als XRechnung, CII als ZUGFeRD
--     EN 16931), nicht das grobe zugferd|xrechnung aus 0023 — die Prüfung
--     braucht die Syntax, um die Elemente zu finden.
--   * `validation_status` + `validation_findings` (jsonb-Liste von
--     {code, severity, bt, message}) sind das Ergebnis der serverseitigen
--     EN-16931-Kernprüfung; `unchecked` heißt „nie geprüft", nie „gültig".
--   * `version` zählt je Rechnung hoch (zweite Erzeugung nach Korrektur der
--     Rechnung). Die Kombination (tenant, invoice, version) ist eindeutig.
--   * `invoice_id … on delete restrict`: eine E-Rechnung existiert nur zu
--     einer ausgestellten Rechnung; die wird nie gelöscht.
--
-- Format-/Status-Werte deckungsgleich mit den Pydantic-Literalen in
-- apps/api/src/features/buchhaltung/bereiche/erechnung/schemas.py
-- (Regel „DB-CHECK und Pydantic-Literal deckungsgleich").
--
-- Finanzdaten sind server-only (Wurzel 6): RLS + revoke für anon/authenticated,
-- KEINE Realtime-Publikation. Der Bucket ist privat; ausgeliefert wird nur über
-- den Server (GET /einvoices/{id}/xml, Content-Disposition), nie per Bucket-URL.

create table if not exists public.e_invoices (
    id                   uuid primary key default gen_random_uuid(),
    tenant_id            uuid not null references public.tenants(id) on delete cascade,
    invoice_id           uuid not null references public.invoices(id) on delete restrict,
    format               text not null
                         check (format in ('xrechnung_ubl', 'xrechnung_cii', 'zugferd_en16931')),
    storage_path         text not null,
    xml_sha256           text not null check (char_length(xml_sha256) = 64),
    xml_bytes            integer not null check (xml_bytes > 0),
    validation_status    text not null default 'unchecked'
                         check (validation_status in ('valid', 'invalid', 'unchecked')),
    validation_findings  jsonb not null default '[]'::jsonb,
    validated_at         timestamptz,
    version              integer not null check (version >= 1),
    generated_at         timestamptz not null default now(),
    created_by           uuid,
    created_at           timestamptz not null default now(),
    updated_at           timestamptz not null default now(),
    constraint e_invoices_inhalt_eindeutig unique (tenant_id, invoice_id, xml_sha256),
    constraint e_invoices_version_eindeutig unique (tenant_id, invoice_id, version),
    constraint e_invoices_pfad_eindeutig unique (storage_path)
);

create index if not exists e_invoices_tenant_invoice_idx
    on public.e_invoices (tenant_id, invoice_id);
create index if not exists e_invoices_tenant_status_idx
    on public.e_invoices (tenant_id, validation_status);
create index if not exists e_invoices_tenant_generated_idx
    on public.e_invoices (tenant_id, generated_at desc);

drop trigger if exists trg_e_invoices_updated on public.e_invoices;
create trigger trg_e_invoices_updated
    before update on public.e_invoices
    for each row execute function public.set_updated_at();

alter table public.e_invoices enable row level security;

drop policy if exists e_invoices_tenant on public.e_invoices;
create policy e_invoices_tenant on public.e_invoices
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- Wurzel 6: der Direktpfad (PostgREST mit anon-Key + JWT) bleibt zu.
revoke select, insert, update, delete on public.e_invoices from anon, authenticated;

-- --------------------------------------------------------------------------
-- Bucket für die XML-Dateien
-- --------------------------------------------------------------------------
-- PRIVAT: eine E-Rechnung trägt Anschriften, USt-IdNr., IBAN und Beträge.
-- Zugriff ausschließlich über den Server (service_role), der Bucket hat
-- KEINE storage.objects-Policy für anon/authenticated — ein Client mit
-- anon-Key kann weder listen noch laden. 10 MB Deckel und nur XML-Typen —
-- zusätzlich serverseitig geprüft (Wohlgeformtheit, keine DOCTYPE/ENTITY).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('e-rechnungen', 'e-rechnungen', false, 10485760,
        array['application/xml', 'text/xml'])
on conflict (id) do update
    set public = false,
        file_size_limit = 10485760,
        allowed_mime_types = array['application/xml', 'text/xml'];
