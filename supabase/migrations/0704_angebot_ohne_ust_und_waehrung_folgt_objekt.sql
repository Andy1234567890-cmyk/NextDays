-- 0704_angebot_ohne_ust_und_waehrung_folgt_objekt.sql
-- (1) Kalender-Angebot an Organisationen ohne Umsatzsteuer (USt-ID, Steuerregel).
-- (2) Ratenplan-Währung folgt der Objektwährung — per Trigger, nicht per Hoffnung.
--
-- Befund 14.09.2026, Betrieb Nordstrand: Konto und alle 11 Objekte stehen auf
-- DKK, alle 11 Ratenpläne auf EUR (Seed vom 08.09.2026, Währung später am
-- Konto umgestellt). Der Preis-Resolver nahm die Ratenplan-Währung zuerst,
-- und jedes Angebot zeigte „570,00 €" für ein dänisches Ferienhaus. 0161 hat
-- versprochen, rate_plans.currency werde „aus properties.currency abgeleitet/
-- erzwungen" — erzwungen hat es nie etwas: der Rates-Service prüft nur den
-- API-Pfad (422 bei Abweichung), der DB-Direktpfad und eine spätere Änderung
-- der Objektwährung liefen daran vorbei (Wurzel 1: der Gegenzustand der
-- Ratenpläne wurde beim Setzen der Objektwährung nie mitgepflegt).

-- (1) Angebot ohne USt --------------------------------------------------------
alter table public.booking_offers
  add column if not exists guest_vat_id text,
  add column if not exists tax_rule text;

alter table public.booking_offers
  drop constraint if exists booking_offers_tax_rule_check;
alter table public.booking_offers
  add constraint booking_offers_tax_rule_check
  check (tax_rule is null or tax_rule in (
    'EU_REVERSE_18B', 'DE_EXEMPT_4_USTG', 'NON_EU_OUT_OF_SCOPE'
  ));

comment on column public.booking_offers.tax_rule is
  'NULL = mit USt. Sonst steuerfreie Regel des Beleg-Editors (web/types/taxRules.ts); '
  'Snapshot und Spiegel-Angebot sind dann netto mit 0 % USt.';
comment on column public.booking_offers.guest_vat_id is
  'USt-IdNr. der Organisation (Pflicht bei Reverse Charge, Anzeige auf dem Beleg).';

-- (2) Ratenplan-Währung = Objektwährung ---------------------------------------
create or replace function public.rate_plans_waehrung_vom_objekt()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  obj_currency text;
begin
  select p.currency into obj_currency
    from public.properties p
   where p.id = new.property_id;
  if obj_currency is not null and obj_currency <> '' then
    new.currency := obj_currency;
  end if;
  return new;
end;
$$;
revoke execute on function public.rate_plans_waehrung_vom_objekt() from anon, authenticated;

drop trigger if exists rate_plans_waehrung_vom_objekt on public.rate_plans;
create trigger rate_plans_waehrung_vom_objekt
  before insert or update of currency, property_id on public.rate_plans
  for each row execute function public.rate_plans_waehrung_vom_objekt();

create or replace function public.properties_waehrung_weitergeben()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.currency is null or new.currency = '' then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.currency is not distinct from old.currency then
    return new;
  end if;
  update public.rate_plans
     set currency = new.currency
   where property_id = new.id
     and currency is distinct from new.currency;
  update public.property_pricing_config
     set currency = new.currency
   where property_id = new.id
     and currency is distinct from new.currency;
  return new;
end;
$$;
revoke execute on function public.properties_waehrung_weitergeben() from anon, authenticated;

drop trigger if exists properties_waehrung_weitergeben on public.properties;
create trigger properties_waehrung_weitergeben
  after update of currency on public.properties
  for each row execute function public.properties_waehrung_weitergeben();

-- Bestand nachziehen: Beträge bleiben, nur die Währungsangabe folgt dem Objekt
-- (der Betrieb pflegt seine Preise in der Kontowährung; das Etikett war falsch).
update public.rate_plans r
   set currency = p.currency
  from public.properties p
 where p.id = r.property_id
   and p.currency is not null and p.currency <> ''
   and r.currency is distinct from p.currency;

update public.property_pricing_config c
   set currency = p.currency
  from public.properties p
 where p.id = c.property_id
   and p.currency is not null and p.currency <> ''
   and c.currency is distinct from p.currency;
