-- 0092_invoice_reservation_bridge.sql — Brücke Buchhaltung ↔ Buchungen
--
-- Das Rechnungssystem (0023) war bisher komplett von Reservierungen entkoppelt
-- (Dienstleistungs-Herkunft). Für Zimmerrechnungen aus Buchungen kommen:
--   1) invoices.reservation_id  — welche Buchung wurde fakturiert
--   2) customers.guest_id       — Gast ↔ Debitor (ein Kunde je Gast je Tenant)
--   3) tenant_billing_profile.lodging_tax_rate — USt-Satz für Beherbergungs-
--      Positionen (z. B. 7.00 in DE). BEWUSST nullable und OHNE Default:
--      fehlt der Satz, schlägt die automatische Rechnung beim Check-out mit
--      klarer Meldung fehl (Projektregel „keine Fallbacks", 27 EU-Länder).
--   4) Realtime für invoices/invoice_line_items — die Rechnungsliste abonniert
--      beide Tabellen bereits per useRealtime, ohne Publication kamen aber nie
--      Events an (stummer Bug, analog 0048).

-- 1) Rechnung ↔ Buchung
alter table public.invoices
    add column if not exists reservation_id uuid
        references public.reservations (id) on delete set null;

create index if not exists invoices_reservation_idx
    on public.invoices (reservation_id)
    where reservation_id is not null;

-- Doppelrechnungs-Schutz: genau EINE aktive Rechnung je Buchung. Nach Storno
-- (status 'cancelled') oder Soft-Delete darf eine neue erstellt werden;
-- Gutschriften/Stornorechnungen (invoice_type <> 'invoice') zählen nicht.
create unique index if not exists invoices_reservation_active_uq
    on public.invoices (reservation_id)
    where reservation_id is not null
      and invoice_type = 'invoice'
      and status <> 'cancelled'
      and deleted_at is null;

-- 2) Gast ↔ Kunde (Debitor). on delete set null: der Debitor (GoBD-relevant)
-- überlebt eine Gast-Löschung.
alter table public.customers
    add column if not exists guest_id uuid
        references public.guests (id) on delete set null;

create unique index if not exists customers_tenant_guest_uq
    on public.customers (tenant_id, guest_id)
    where guest_id is not null;

-- 3) USt-Satz Übernachtung (siehe Kopfkommentar: nullable, kein Default)
alter table public.tenant_billing_profile
    add column if not exists lodging_tax_rate numeric(5, 2)
        check (lodging_tax_rate is null
               or (lodging_tax_rate >= 0 and lodging_tax_rate <= 100));

-- 4) Realtime (Muster 0048: replica identity full + idempotent zur Publication)
alter table public.invoices           replica identity full;
alter table public.invoice_line_items replica identity full;

do $$
declare
  t text;
  tables text[] := array['invoices', 'invoice_line_items'];
begin
  foreach t in array tables loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
