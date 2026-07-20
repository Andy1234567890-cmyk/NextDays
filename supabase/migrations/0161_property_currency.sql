-- 0161_property_currency.sql — zentrale Währung pro Objekt (FeWo + Hotel)
--
-- Bisher lag die Währung AUSSCHLIESSLICH je Rate-Plan (rate_plans.currency,
-- NOT NULL, kein Default seit 0003). Es gab keine zentrale Stelle, an der ein
-- Betrieb die Währung eines Objekts setzt. Das führte zu Mischzuständen: ein
-- Objekt konnte pro Rate-Plan theoretisch verschiedene Währungen tragen, obwohl
-- Channex 1 Objekt = 1 Währung verlangt (content_sync liest heute rate_plans[0]).
--
-- Modell danach (eine Wahrheit):
--   properties.currency = die Währung DES OBJEKTS. Gilt für ALLE Rate-Plans
--   dieses Objekts — bei FeWo (i.d.R. 1 Rate-Plan) wie bei Hotel-Zimmern
--   (mehrere Rate-Plans BAR/B&B/derived, die zwingend dieselbe Währung teilen).
--   rate_plans.currency bleibt bestehen (Bestandskompatibilität + Fallback),
--   wird aber künftig aus properties.currency abgeleitet/erzwungen.
--
-- NULLABLE, KEIN Default (Wurzel 4 — keine erfundene EUR). Ein Objekt ohne
-- bewusst gesetzte Währung bleibt leer; die Preisanzeige rendert dann symbollos
-- statt „€" zu erfinden. Der Backfill setzt die real existierende Währung aus
-- dem ältesten Rate-Plan des Objekts — kein Raten, nur das Übernehmen des
-- heutigen De-facto-Zustands.
--
-- properties hat bereits RLS (0008) + Owner/Staff-Policies (0059/0136). Eine
-- neue Spalte erbt die bestehenden Table-Policies/Grants; die Währung ist nicht
-- sensibler als title/status (schon lesbar) → kein zusätzliches revoke nötig.

alter table public.properties
    add column if not exists currency text;

comment on column public.properties.currency is
    'ISO-4217-Währung DES OBJEKTS. Gilt für alle Rate-Plans dieses Objekts '
    '(Channex verlangt 1 Objekt = 1 Währung). Nullable, kein Default — fehlt '
    'sie, ist das ein Datenfehler und die Anzeige rendert symbollos, nie eine '
    'erfundene EUR (Wurzel 4). Quelle der Wahrheit; rate_plans.currency wird '
    'daraus abgeleitet.';

-- Backfill: Währung aus dem ältesten Rate-Plan je Objekt übernehmen (der bisher
-- de-facto-maßgebliche, den auch content_sync/property_mapping lesen). Objekte
-- ohne Rate-Plan bleiben leer (kein erfundener Wert). Idempotent: nur setzen,
-- wenn currency noch leer ist.
with oldest_rp as (
    select distinct on (property_id)
           property_id, currency
      from public.rate_plans
     where currency is not null and currency <> ''
     order by property_id, created_at asc, id asc
)
update public.properties p
   set currency = o.currency
  from oldest_rp o
 where o.property_id = p.id
   and (p.currency is null or p.currency = '');
