-- 0097_invoice_payment_method.sql — Zahlart der Rechnung (Check-out-Abfrage)
--
-- Beim Check-out wird abgefragt, wie der Gast bezahlt: bar, Kreditkarte
-- (mit Kartenmarke) oder auf Rechnung (Überweisung, Zahlungsziel). Bar/Karte
-- gelten als am Empfang bezahlt (Rechnung sofort 'paid'), „auf Rechnung"
-- bleibt 'finalized' mit Fälligkeitsdatum. Nullable: Bestandsrechnungen und
-- der freie Formular-Flow haben keine erfasste Zahlart (nichts erfinden).

alter table public.invoices
    add column if not exists payment_method text
        check (payment_method is null
               or payment_method in ('cash', 'card', 'invoice')),
    add column if not exists card_brand text;
