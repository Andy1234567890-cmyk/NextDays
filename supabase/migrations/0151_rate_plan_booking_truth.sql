-- 0151: Rate-Plan als Buchungs-Wahrheit + Phantom-EUR beseitigen.
--
-- Teil 1: reservations.rate_plan_id — eine Hotel-Buchung gehört zu GENAU EINEM
-- Rate-Plan (BAR vs. B&B desselben Zimmers kosten verschieden). Ohne die Spalte
-- kann der Quote nie den gewählten Plan bepreisen und rechnet den ältesten Plan
-- des Objekts (falscher Preis bei jeder Hotel-Buchung). on delete set null:
-- ein gelöschter Plan darf historische Buchungen nicht mitreißen.
--
-- Teil 2: property_pricing_config.currency hatte DEFAULT 'EUR' (0051). Der
-- Default erzeugte Phantom-Währungen: jede Zeile, die ohne bewusst gewählte
-- Währung entstand (z. B. nur eine Gebühr gespeichert), stand als 'EUR' in der
-- DB — und verdrängte im Quote die echte Rate-Plan-Währung (CHF/USD-Objekt
-- bucht in EUR). Die Leser sind fail-closed gebaut (leer → kein erfundener
-- Wert); der Schutz griff nie, weil die DB nie leer lieferte. Default und
-- NOT NULL entfallen; Backfill nullt genau die Zeilen, deren Währung nie im
-- Formular gewählt wurde (type_attributes.pricing.currency leer — der einzige
-- Schreibpfad _sync_pricing_config setzt currency nur aus diesem Feld).

alter table public.reservations
    add column if not exists rate_plan_id uuid
        references public.rate_plans(id) on delete set null;

create index if not exists reservations_rate_plan_idx
    on public.reservations (rate_plan_id)
    where rate_plan_id is not null;

alter table public.property_pricing_config
    alter column currency drop default;

alter table public.property_pricing_config
    alter column currency drop not null;

update public.property_pricing_config c
set currency = null
from public.properties p
where p.id = c.property_id
  and c.currency = 'EUR'
  and coalesce(p.type_attributes->'pricing'->>'currency', '') = '';
