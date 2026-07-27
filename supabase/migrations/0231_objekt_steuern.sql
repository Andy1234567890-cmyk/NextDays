-- Steuern je Objekt, die der GASTGEBER selbst festlegt.
--
-- Abgrenzung, die man nicht verwischen darf — es sind drei verschiedene Dinge:
--   1. `taxpayer_info` (0226): WER der Steuerpflichtige ist. Meldepflicht.
--   2. `tax_country_rules` (0229/0230): WAS im Land gilt. Nur Information,
--      um dem Gastgeber die richtige Berechnung anzubieten.
--   3. DIESE Tabelle: WAS der Gastgeber dem Gast berechnet.
--
-- Wir behalten NICHTS ein. Die Steuer wird dem Gast zusaetzlich berechnet, an
-- den Gastgeber durchgereicht und von ihm selbst abgefuehrt. Sie ist ein
-- durchlaufender Posten und darf deshalb NIE Provisionsbasis sein — Booking
-- macht das genauso ("We don't charge commission on local taxes").
--
-- Struktur nach dem Airbnb-Modell (Hilfeartikel 2523), weil es belegt und
-- schlanker ist als Bookings Antragsweg: Steuerart + Abrechnungsart + Betrag
-- + Bemessungsgrundlage + Registrierungsnummer.

begin;

-- Abrechnungsart. Airbnb hat genau diese vier (2522/2523, geschlossene Liste).
-- Bookings acht Modi sind eine Obermenge; die beiden deutschen Sonderfaelle
-- (pro Tag statt pro Nacht) fehlen bewusst — sie zaehlen An- und Abreisetag
-- als je einen Tag und brauchen eine eigene Nachtlogik. Kommt, wenn ein
-- deutscher Betrieb es braucht, nicht auf Vorrat.
create type public.tax_charge_mode as enum (
  'percentage_per_booking',
  'per_guest',
  'per_night',
  'per_guest_per_night'
);

comment on type public.tax_charge_mode is
  'Abrechnungsart einer Objektsteuer (Airbnb-Modell, Hilfeartikel 2523).';

create table public.property_taxes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,

  -- Freitext statt Enum: Airbnb nennt oeffentlich nur vier Arten und schreibt
  -- ausdruecklich "and others", die Liste ist zudem laenderabhaengig. Ein
  -- Enum haette geraten werden muessen (Wurzel 4). Die Vorschlagsliste steht
  -- im Frontend, gespeichert wird, was der Gastgeber braucht.
  tax_type text not null,
  charge_mode public.tax_charge_mode not null,

  -- Bei percentage_per_booking: Basispunkte (0,1 % waere als Prozent-Integer
  -- nicht darstellbar). Sonst: Betrag in der Objektwaehrung, kleinste Einheit.
  rate_bps integer,
  amount_minor bigint,

  -- Nur bei percentage_per_booking waehlbar — Airbnb: "taxable base selection
  -- is only available for the percentage per reservation type of charge".
  -- Mehrfachauswahl ist ausdruecklich erlaubt.
  taxable_base text[] not null default '{}',

  -- Ohne Registrierungsnummer reicht Airbnb die Steuer nicht durch. Wir
  -- verlangen sie ebenso: eine Steuer ohne Registrierung ist eine Behauptung.
  registration_number text not null,

  -- Befreiungen (Airbnb 2523, beide optional)
  long_stay_exempt_nights integer,
  taxable_first_nights integer,
  max_amount_minor bigint,

  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Genau EINE Betragsangabe, passend zur Abrechnungsart. Ohne diesen CHECK
  -- koennte eine Zeile 5 % UND 3 EUR sagen — die Berechnung waere nicht
  -- entscheidbar.
  constraint property_taxes_betrag_passt_zur_art check (
    case charge_mode
      when 'percentage_per_booking'
        then rate_bps is not null and amount_minor is null
      else amount_minor is not null and rate_bps is null
    end
  ),
  constraint property_taxes_rate_bereich check (
    rate_bps is null or (rate_bps > 0 and rate_bps <= 10000)
  ),
  constraint property_taxes_betrag_positiv check (
    amount_minor is null or amount_minor > 0
  ),
  -- Bemessungsgrundlage nur beim Prozentsatz — sonst ist sie bedeutungslos
  -- und wuerde eine Genauigkeit vortaeuschen, die die Rechnung nicht hat.
  constraint property_taxes_basis_nur_bei_prozent check (
    charge_mode = 'percentage_per_booking' or taxable_base = '{}'
  ),
  constraint property_taxes_befreiung_positiv check (
    (long_stay_exempt_nights is null or long_stay_exempt_nights > 0)
    and (taxable_first_nights is null or taxable_first_nights > 0)
    and (max_amount_minor is null or max_amount_minor > 0)
  )
);

comment on table public.property_taxes is
  'Steuern, die der Gastgeber je Objekt selbst festlegt und selbst abfuehrt. '
  'Die Plattform behaelt nichts ein und berechnet keine Provision darauf.';
comment on column public.property_taxes.rate_bps is
  'Basispunkte (500 = 5 %). Nur bei charge_mode = percentage_per_booking.';
comment on column public.property_taxes.taxable_base is
  'Worauf der Prozentsatz rechnet, z. B. base_price, cleaning_fee. '
  'Mehrfachauswahl erlaubt. Nie die Servicegebuehr der Plattform.';

create index property_taxes_property_idx
  on public.property_taxes (property_id) where active;
create index property_taxes_tenant_idx on public.property_taxes (tenant_id);

-- === Wurzel 6: RLS + Grants =================================================
-- Ohne revoke ist der DB-Direktpfad offen — ein eingeloggter cleaner koennte
-- sonst per anon-Key Steuersaetze fremder Betriebe aendern.
alter table public.property_taxes enable row level security;

revoke all on public.property_taxes from anon, authenticated;

create policy property_taxes_tenant on public.property_taxes
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- Restriktiv fuer ALLE Operationen, nicht nur select: sonst waere der
-- Schreibpfad tenant-weit offen.
create policy property_taxes_nur_verwaltung on public.property_taxes
  as restrictive for all
  using (public.current_user_role() in ('admin', 'co_admin'))
  with check (public.current_user_role() in ('admin', 'co_admin'));

create trigger property_taxes_updated_at
  before update on public.property_taxes
  for each row execute function public.set_updated_at();

commit;
