-- 0690_erechnung_e_invoice_settings.sql — E-Rechnungs-Einstellungen je Betrieb
--
-- WARUM: Standardformat, Leitweg-ID des Betriebs (als Empfänger von
-- E-Rechnungen, BT-10) und das Datum, ab dem der Betrieb E-Rechnungen
-- verpflichtend erzeugt. EU-weit: die Pflicht gilt je Land verschieden
-- (DE Empfang seit 01.01.2025, Versand gestaffelt 2027/2028; DK, IT, FR, PL,
-- BE mit eigenen Terminen). Deshalb steht hier KEIN Default — der Betrieb
-- trägt SEIN Datum ein, das Land kommt zur Anzeige aus `tenants.country`
-- (Wurzel 4: kein deutsches Datum für einen dänischen Betrieb).
--
-- Abgrenzung zu 0023: `tenant_billing_profile.e_invoice_format` (none|zugferd|
-- xrechnung) und `.leitweg_id` sind die groben Felder des Firmenprofils. Die
-- Buchhaltung liest ab jetzt AUSSCHLIESSLICH diese Tabelle; die alten Spalten
-- bleiben für das /konto-Profil bestehen (Koordinator-Aufgabe im Bericht:
-- eine Quelle daraus machen).
--
-- `default_format` deckungsgleich mit dem Pydantic-Literal in
-- apps/api/src/features/buchhaltung/bereiche/erechnung/schemas.py.

create table if not exists public.e_invoice_settings (
    tenant_id        uuid primary key references public.tenants(id) on delete cascade,
    default_format   text not null
                     check (default_format in ('xrechnung_ubl', 'xrechnung_cii', 'zugferd_en16931')),
    leitweg_id       text,
    mandatory_from   date,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now()
);

drop trigger if exists trg_e_invoice_settings_updated on public.e_invoice_settings;
create trigger trg_e_invoice_settings_updated
    before update on public.e_invoice_settings
    for each row execute function public.set_updated_at();

alter table public.e_invoice_settings enable row level security;

drop policy if exists e_invoice_settings_tenant on public.e_invoice_settings;
create policy e_invoice_settings_tenant on public.e_invoice_settings
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke select, insert, update, delete on public.e_invoice_settings from anon, authenticated;
