-- 0676_steuer_tax_settings.sql — Steuer-Parameter des Betriebs (Bereich »steuer«)
--
-- WARUM EINE EIGENE TABELLE UND KEINE DEFAULTS IM CODE:
-- Das alte Werkzeug (ProfitEstimationSettings.tsx) rechnete die Gewinnschätzung
-- mit „10.000,00" als vorbelegtem Standardbetrag und festen deutschen Sätzen im
-- Browser. myNextDays läuft in 27 Ländern: Ertragsteuer, Gewerbe-/Kommunal-
-- steuer und der Rhythmus der Umsatzsteuer-Meldung (monatlich, quartalsweise,
-- jährlich) sind je Land und Betrieb verschieden. Deshalb: KEIN Ersatzwert.
-- Fehlt die Zeile oder ein Satz, liefert `GET /tax/profit-estimate` die
-- Einnahmen/Ausgaben, aber KEINE Steuerschätzung (`estimated_tax = null`), und
-- die Oberfläche sagt, dass die Parameter fehlen (Wurzel 4).
--
--   * `income_tax_rate`  — Ertrag-/Einkommensteuersatz in % auf den Gewinn,
--                          mit dem der Betrieb rechnen will (Schätzung, kein
--                          Bescheid).
--   * `trade_tax_rate`   — zusätzlicher Gewerbe-/Kommunalsteuersatz in %;
--                          NULL = der Betrieb hat keinen (kein 0-Zwang: „gibt es
--                          hier nicht" ist ein anderer Zustand als „0 % vereinbart").
--   * `vat_period`       — Meldezeitraum der Umsatzsteuer (`month|quarter|year`);
--                          steuert die Periodenvorbelegung der Seite.
--   * `reserve_rate`     — welcher Anteil des geschätzten Steuerbetrags als
--                          Rücklage angezeigt wird (%, optional).
--
-- Alle Fachfelder sind NULL-fähig, damit die Zeile per Upsert entstehen kann;
-- ob genug für eine Schätzung da ist, entscheidet der Service.
--
-- Finanz-/Betriebseinstellungen sind server-only (Wurzel 6): RLS + revoke,
-- keine Realtime-Publikation.

create table if not exists public.tax_settings (
    tenant_id           uuid primary key references public.tenants(id) on delete cascade,
    income_tax_rate     numeric(5,2) check (income_tax_rate is null or income_tax_rate between 0 and 100),
    trade_tax_rate      numeric(5,2) check (trade_tax_rate  is null or trade_tax_rate  between 0 and 100),
    vat_period          text         check (vat_period is null or vat_period in ('month', 'quarter', 'year')),
    reserve_rate        numeric(5,2) check (reserve_rate is null or reserve_rate between 0 and 100),
    note                text,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);

drop trigger if exists trg_tax_settings_updated on public.tax_settings;
create trigger trg_tax_settings_updated
    before update on public.tax_settings
    for each row execute function public.set_updated_at();

alter table public.tax_settings enable row level security;

drop policy if exists tax_settings_tenant on public.tax_settings;
create policy tax_settings_tenant on public.tax_settings
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke select, insert, update, delete on public.tax_settings from anon, authenticated;
