-- 0066_tenant_business_type.sql — Geschäftstyp des Mandanten
--
-- Unsere Kunden sind ZWEI Typen, mit unterschiedlicher Logik:
--   * 'agency'       — Agentur/Hausverwaltung: verwaltet FREMDE Objekte, rechnet
--                      gegenüber den Eigentümern ab (Owner-Statements mit Provision,
--                      Steuer/Reverse-Charge relevant).
--   * 'self_managed' — eigener Vermieter: verwaltet die EIGENEN Objekte; es gibt
--                      keinen fremden Eigentümer und keine Provisionsabrechnung an
--                      sich selbst → statt Owner-Statement nur eine vereinfachte
--                      Einnahmen-/Umsatzübersicht.
-- Default 'agency' (bisheriges implizites Verhalten; bestehende Tenants bleiben so).

alter table public.tenants
    add column if not exists business_type text not null default 'agency'
        check (business_type in ('agency', 'self_managed'));
