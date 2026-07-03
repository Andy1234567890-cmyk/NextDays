-- 0094_customers_guest_uq_deleted.sql — Gast-Debitor-Unique ohne Soft-Deletes
--
-- 0092 legte customers_tenant_guest_uq OHNE deleted_at-Prädikat an. Folge:
-- wird der Debitor eines Gastes soft-gelöscht (DELETE setzt nur deleted_at),
-- findet ensure_customer_for_guest ihn nicht mehr (filtert deleted_at is null),
-- der Neu-Insert kollidiert aber mit der gelöschten Zeile → jeder Check-out
-- dieses Gastes schlägt dauerhaft mit 500 fehl. Der Unique-Schutz darf nur
-- für AKTIVE Debitoren gelten (gleiche Logik wie invoices_reservation_active_uq).

drop index if exists customers_tenant_guest_uq;
create unique index if not exists customers_tenant_guest_uq
    on public.customers (tenant_id, guest_id)
    where guest_id is not null and deleted_at is null;
