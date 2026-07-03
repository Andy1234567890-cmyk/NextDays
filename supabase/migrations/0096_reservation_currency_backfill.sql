-- 0096_reservation_currency_backfill.sql — Währung an Bestandsbuchungen nachziehen
--
-- Buchungen ohne Währungs-Snapshot (currency nullable seit 0078; ältere
-- Wizard-Buchungen ohne Preiskonfiguration) zeigen überall nackte Zahlen
-- („268" statt „268,00 €") — Kalender-Kennzahlen, Buchungs-Slider, Gästemappe.
-- Deterministische Quelle ist dieselbe wie im Preis-Resolver und im
-- Booking→Invoice-Builder: property_pricing_config.currency, sonst
-- rate_plans.currency. Kein erfundener Default: hat das Objekt nirgends eine
-- Währung, bleibt die Buchung leer (und die Rechnung verlangt weiterhin die
-- Pflege im Preis-Setup).

update public.reservations r
set currency = src.currency
from (
    select p.id as property_id,
           coalesce(
               nullif(btrim(cfg.currency), ''),
               nullif(btrim(rp.currency), '')
           ) as currency
    from public.properties p
    left join public.property_pricing_config cfg on cfg.property_id = p.id
    left join lateral (
        select currency
        from public.rate_plans
        where property_id = p.id
        order by created_at
        limit 1
    ) rp on true
) src
where src.property_id = r.property_id
  and src.currency is not null
  and (r.currency is null or btrim(r.currency) = '');
