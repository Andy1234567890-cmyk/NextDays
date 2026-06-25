-- 0070_statement_owner_currency.sql — Owner-Zielwährung im Statement-Snapshot
--
-- Die Eigentümer-Auszahlung wird in die Owner-Währung (aus dem Herkunftsland)
-- umgerechnet. owner_payout ist damit in DIESER Währung. Damit ein finalisierter
-- Beleg seinen Snapshot korrekt darstellt (eingefrorene Summen), wird die
-- Owner-Währung mitgespeichert. currency bleibt die Tenant-/Anzeige-Quellwährung.

alter table public.owner_statements
    add column if not exists owner_currency text;
