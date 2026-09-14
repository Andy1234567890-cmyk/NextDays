-- 0631 — Kunden- und Angebotsnummern je Tenant eindeutig.
--
-- WARUM: Seit 0023 trägt `customers.customer_number` keinen Unique-Index. Das
-- übernommene Frontend zeigte eine Vorschau der nächsten Nummer und schickte
-- sie beim Anlegen mit; zwei gleichzeitige Anlagen bekämen dieselbe Nummer,
-- und der Server hätte beide gespeichert. Seit dem 11.09.2026 vergibt der
-- Server die Nummer selbst (atomar über next_document_number); dieser Index
-- ist der Backstop dahinter (Wurzel 2: real kommt alles doppelt).
--
-- Dasselbe für Angebote: `quotes.quote_number` wurde bis zum 11.09.2026 nie
-- gesetzt; ab jetzt zieht create_quote eine Nummer, und der Index sichert sie.
--
-- Partiell: NULL-Nummern (Altbestand ohne Nummer) und Soft-Gelöschte bleiben
-- draußen — eine gelöschte KD-0007 darf die Nummer nicht dauerhaft blockieren?
-- NEIN, bewusst doch: Kundennummern werden NICHT wiederverwendet (Verwechslung
-- in Belegen), deshalb zählt der Index auch gelöschte Zeilen mit.

create unique index if not exists customers_tenant_nummer_uidx
    on public.customers (tenant_id, customer_number)
    where customer_number is not null;

create unique index if not exists quotes_tenant_nummer_uidx
    on public.quotes (tenant_id, quote_number)
    where quote_number is not null;
