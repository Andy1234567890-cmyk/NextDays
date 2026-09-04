-- 0554_dp_tagesmodus_und_freigabe.sql — Tagesmodus je Zeitraum + Freigabe vor dem Senden
--
-- WARUM
-- =====
-- Zwei Dinge fehlten, die jeder grosse Anbieter hat und die derselben Frage
-- entspringen: "Wer entscheidet, welcher Preis rausgeht — und wann?"
--
-- 1) TAGESMODUS (dp_day_modes)
--    Bisher galt Dynamic Pricing fuer ein Objekt ganz oder gar nicht. Wer fuer
--    eine einzelne Woche 10 % drauflegen wollte, musste entweder einen festen
--    Preis eintragen (dann rechnet die Automatik dort nie wieder) oder die
--    globale Regel verbiegen (dann gilt sie ueberall). Beides ist falsch.
--    Drei Modi je Tag, wie im Kalender waehlbar:
--      'dynamisch'   — der berechnete Preis gilt unveraendert (Standard, keine Zeile)
--      'anpassung'   — der berechnete Preis mal (1 + adjust_pct/100)
--      'manuell'     — fester Preis; die Automatik laesst diesen Tag in Ruhe
--    'manuell' bildet sich weiterhin ueber price_overrides ab (eine Wahrheit,
--    kein zweiter Preisspeicher); hier steht nur der MODUS und die Anpassung.
--
-- 2) FREIGABE (dp_settings.freigabe_noetig / dynamic_prices.gesendet_am)
--    Berechnete Preise gingen bisher sofort an die Portale. Wer 18 Objekte
--    fuehrt, will vor dem Senden draufschauen — die Zahl geht an Airbnb und
--    Booking, ein Fehler ist dort sofort oeffentlich und verkauft.
--    Ist freigabe_noetig gesetzt, rechnet die Engine weiter, aber der Push
--    wartet auf den Knopf. gesendet_am je Tag sagt, was schon draussen ist:
--    ohne diese Spalte liesse sich "geprueft" nicht von "gesendet" trennen und
--    der Knopf wuerde bei jedem Klick alles erneut schicken (Wurzel 2).

-- ------------------------------------------------------------- Tagesmodus
do $$
begin
    if not exists (select 1 from pg_type where typname = 'dp_tagesmodus') then
        create type public.dp_tagesmodus as enum
            ('dynamisch', 'anpassung', 'manuell');
    end if;
end
$$;

create table if not exists public.dp_day_modes (
    property_id uuid not null references public.properties (id) on delete cascade,
    date        date not null,
    modus       public.dp_tagesmodus not null,
    -- Nur bei 'anpassung' gefuellt: Auf-/Abschlag auf den berechneten Preis.
    -- Grenzen wie bei den Auslastungsstufen, damit ein Tippfehler nicht den
    -- Verkaufspreis eines Tages verzehnfacht.
    adjust_pct  numeric(6, 2)
                check (adjust_pct is null or (adjust_pct >= -90 and adjust_pct <= 300)),
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now(),
    primary key (property_id, date),
    -- Der Modus und sein Wert muessen zusammenpassen: 'anpassung' ohne Prozent
    -- waere eine Regel ohne Wirkung, die stillschweigend nichts tut.
    constraint dp_day_modes_anpassung_braucht_wert check (
        (modus = 'anpassung' and adjust_pct is not null)
        or (modus <> 'anpassung' and adjust_pct is null)
    )
);

comment on table public.dp_day_modes is
  'Tagesmodus je Objekt: dynamisch (Standard, meist keine Zeile), anpassung '
  '(berechneter Preis +/- Prozent) oder manuell (fester Preis aus '
  'price_overrides). Keine Zeile = dynamisch.';

comment on column public.dp_day_modes.adjust_pct is
  'Nur bei modus=anpassung: Auf-/Abschlag in Prozent auf den berechneten Preis.';

create index if not exists dp_day_modes_property_date_idx
    on public.dp_day_modes (property_id, date);

alter table public.dp_day_modes enable row level security;

drop policy if exists dp_day_modes_via_property on public.dp_day_modes;
create policy dp_day_modes_via_property on public.dp_day_modes
    for all
    using (exists (
        select 1 from public.properties p
        where p.id = dp_day_modes.property_id
          and p.tenant_id = public.current_tenant_id()))
    with check (exists (
        select 1 from public.properties p
        where p.id = dp_day_modes.property_id
          and p.tenant_id = public.current_tenant_id()));

-- Wurzel 6: RLS erzwingt nur den Mandanten. Der Tagesmodus steuert den
-- VERKAUFSPREIS an den Portalen — geschrieben wird ausschliesslich ueber die
-- FastAPI-Route, die Rechte und Grenzen prueft. Ein eingeloggter Reinigungs-
-- kraft-Account mit anon-Key darf hier nichts setzen.
revoke insert, update, delete on public.dp_day_modes from anon, authenticated;
grant select on public.dp_day_modes to anon, authenticated;

-- ---------------------------------------------------------------- Freigabe
alter table public.dp_settings
    add column if not exists freigabe_noetig boolean not null default false;

comment on column public.dp_settings.freigabe_noetig is
  'true = berechnete Preise gehen NICHT automatisch an die Portale, sondern '
  'warten auf den Freigabe-Knopf. Die Engine rechnet unveraendert weiter.';

alter table public.dynamic_prices
    add column if not exists gesendet_am timestamptz;

comment on column public.dynamic_prices.gesendet_am is
  'Wann dieser berechnete Preis an die Portale ging. NULL = noch nicht '
  'gesendet (bei freigabe_noetig: wartet auf Freigabe). Trennt "gerechnet" '
  'von "veroeffentlicht" — ohne das wuerde jede Freigabe alles neu schicken.';

-- Die Freigabe-Ansicht fragt "welche Tage warten?" — ohne Index waere das ein
-- Full-Scan ueber alle berechneten Tage aller Objekte.
create index if not exists dynamic_prices_unversandt_idx
    on public.dynamic_prices (property_id, date)
    where gesendet_am is null;
