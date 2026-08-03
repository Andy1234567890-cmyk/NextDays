-- 0276_aktionen_bedingungen.sql — Aktionen (Promotions) mit ECHTEN Bedingungen
--
-- WARUM: Auf der Preise-Seite des PMS lagen „Aktionen" als Blob in
-- `type_attributes.pricing.promotions` — `{name, percent, conditions}`, wobei
-- `conditions` ein FREITEXT war. Der Preis-Resolver zog `percent` von JEDER
-- Buchung ab und hat den Freitext nie ausgewertet: eine Aktion „20 % nur Juni
-- 2026" rabattierte das ganze Jahr. Das ist kein fehlendes Feature, das ist
-- Geldverlust mit einer Oberfläche, die etwas anderes behauptet.
--
-- Gleichzeitig gab es die typisierte Engine dieser Tabelle (0185) mit
-- Zeitfenster, Frühbucher, Last-Minute, Mindestaufenthalt, bestem Einzelrabatt
-- und RLS — nur ohne Oberfläche im PMS. Statt eine zweite Rabatt-Wahrheit zu
-- bauen, bekommt DIESE Tabelle die Achsen, die der Branchenstandard führt
-- (Lodgify „Aktionsangebot", live abgelesen 03.08.2026):
--
--   Betrag        Prozent ODER Pauschalbetrag
--   Angebotscodes mehrere Codes, je höchstens 15 Zeichen
--   Aufenthalts-  MEHRERE Zeiträume (Lodgify führt sie als Liste mit
--   daten         Entfernen-Knopf je Eintrag)
--   Buchungsdaten EIN Zeitraum („nur wenn in diesem Fenster gebucht wird")
--   Art           Last Minute / Frühbucher / Mindestaufenthalt — KOMBINIERBAR
--                 (drei unabhängige Checkboxen, nicht ein Auswahlfeld)
--   Darstellung   gastseitiger Name je Sprache, interne Beschreibung, Foto
--   Kanäle        Einschränkung wie bei Gebühren/Steuern
--
-- EINE WAHRHEIT, KEINE ZWEITE DARSTELLUNG: `days_before` konnte je nach
-- `discount_type` „mindestens" ODER „höchstens" heißen, und `starts_on/ends_on`
-- war ein Aufenthaltsfenster, das nur der Typ `custom` haben durfte. Beides wird
-- in die allgemeinen Achsen überführt und die Altspalten fallen weg — sonst gäbe
-- es zwei Wege, denselben Frühbucher auszudrücken, und der Resolver müsste
-- beide kennen (genau der Widerspruch, der die Freitext-Bedingung erst
-- entstehen ließ).
--
--   early_booker.days_before  → lead_min_days  (gebucht >= X Tage vor Anreise)
--   last_minute.days_before   → lead_max_days  (gebucht <= X Tage vor Anreise)
--   custom.starts_on/ends_on  → stay_ranges    ([{from,to}])
--
-- `discount_type` BLEIBT — als Art der Aktion für Oberfläche und Rechnung
-- („Frühbucher", „Last Minute"), nicht mehr als Schalter für die Auswertung.
-- Neuer Wert `promotion` für eine Aktion ohne Typ-Bedingung: im Standard sind
-- alle drei Checkboxen abwählbar, und eine Aktion, die einfach im Juni gilt,
-- muss sich ausdrücken lassen, ohne einen Typ zu erfinden (Wurzel 4).
--
-- Wurzel 6: die Tabelle ist weiter service_role-only (0185 hat GRANTs entzogen);
-- neue Spalten erben das. Kein neues GRANT, kein Realtime-Abo — Rabattregeln
-- sind Vertriebsdaten.

-- 1) Neuer Typ-Wert. `alter type ... add value` läuft nicht in einem
--    Transaktionsblock zusammen mit seiner Verwendung, deshalb ZUERST und
--    idempotent (das Migrations-Skript kann erneut laufen).
do $$
begin
  if not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'discount_type' and e.enumlabel = 'promotion'
  ) then
    alter type public.discount_type add value 'promotion';
  end if;
end $$;

-- 2) Neue Achsen. Alle NULLBAR bzw. mit leerem Default: Bestandszeilen bleiben
--    gültig, und `gastgeber` (nutzt nur length_of_stay) merkt nichts.
alter table public.property_discounts
    -- Prozent (Bestand) oder Pauschalbetrag. Bei `fixed` ist `discount_amount`
    -- der Betrag in der WÄHRUNG DES OBJEKTS (properties.currency, 0161) — keine
    -- eigene Währungsspalte, die von der Objektwährung abweichen könnte.
    add column if not exists discount_kind text not null default 'percent',
    add column if not exists discount_amount numeric(12,2),
    -- Aufenthaltsdaten: [{"from":"2026-06-01","to":"2026-06-30"}, …].
    -- Leer = jeder Aufenthalt. Mehrere Zeiträume, weil der Standard sie als
    -- Liste führt (Sommerferien + Herbstferien in EINER Aktion).
    add column if not exists stay_ranges jsonb not null default '[]'::jsonb,
    -- Daten der Buchung: nur anwenden, wenn IN diesem Fenster gebucht wird.
    add column if not exists booked_from date,
    add column if not exists booked_to date,
    -- Frühbucher / Last Minute als zwei unabhängige Grenzen desselben Maßes
    -- (Tage zwischen Buchung und Anreise) — so sind sie kombinierbar, wie im
    -- Standard, und „mindestens" bzw. „höchstens" steht im Spaltennamen statt
    -- im Typ.
    add column if not exists lead_min_days integer,
    add column if not exists lead_max_days integer,
    -- Angebotscodes: der Gast muss einen davon eingeben. Leer = kein Code nötig.
    add column if not exists promo_codes text[] not null default '{}'::text[],
    -- Kanal-Einschränkung wie bei Gebühren/Steuern (portalScope): leer = alle.
    add column if not exists portal_scope text[] not null default '{}'::text[],
    -- Interne Beschreibung (Rich-Text, serverseitig sanitisiert) und Foto für
    -- die eigene Buchungsstrecke.
    add column if not exists description_html text,
    add column if not exists photo_url text;

alter table public.property_discounts
    drop constraint if exists property_discounts_kind_chk;
alter table public.property_discounts
    add constraint property_discounts_kind_chk
    check (discount_kind in ('percent', 'fixed'));

-- Genau EINE Betragsachse ist gesetzt — sonst wäre unklar, was gilt, und der
-- Code müsste raten (Wurzel 4). `discount_bps` bleibt NOT NULL (Bestand), bei
-- `fixed` trägt es den Mindestwert 1 und wird nicht gelesen; damit muss keine
-- Bestandszeile angefasst werden.
alter table public.property_discounts
    drop constraint if exists property_discounts_amount_chk;
alter table public.property_discounts
    add constraint property_discounts_amount_chk
    check (
        (discount_kind = 'percent' and discount_amount is null)
     or (discount_kind = 'fixed' and discount_amount is not null
         and discount_amount > 0)
    );

alter table public.property_discounts
    drop constraint if exists property_discounts_lead_chk;
alter table public.property_discounts
    add constraint property_discounts_lead_chk
    check (
        (lead_min_days is null or lead_min_days >= 0)
    and (lead_max_days is null or lead_max_days >= 0)
    -- Ein leeres Fenster („mindestens 30, höchstens 7 Tage vorher") greift nie
    -- und ist immer ein Tippfehler, kein Wunsch.
    and (lead_min_days is null or lead_max_days is null
         or lead_min_days <= lead_max_days)
    );

alter table public.property_discounts
    drop constraint if exists property_discounts_booked_chk;
alter table public.property_discounts
    add constraint property_discounts_booked_chk
    check (booked_from is null or booked_to is null or booked_from <= booked_to);

-- 3) Altwerte in die allgemeinen Achsen überführen — VOR dem Fallenlassen der
--    Spalten, sonst wäre die Bedeutung verloren (Wurzel 1: der Gegenzustand
--    wird mitgepflegt, nicht dem Zufall überlassen).
update public.property_discounts
   set lead_min_days = days_before
 where discount_type = 'early_booker'
   and days_before is not null
   and lead_min_days is null;

update public.property_discounts
   set lead_max_days = days_before
 where discount_type = 'last_minute'
   and days_before is not null
   and lead_max_days is null;

update public.property_discounts
   set stay_ranges = jsonb_build_array(
         jsonb_build_object('from', starts_on::text, 'to', ends_on::text))
 where starts_on is not null
   and ends_on is not null
   and stay_ranges = '[]'::jsonb;

-- 4) Der Typ-CHECK von 0185 erzwang „genau ein Feld je Typ". Das war richtig,
--    solange der Typ die Auswertung steuerte — jetzt blockiert er genau die
--    Kombination, die der Standard erlaubt (20 % im Juni UND ab 5 Nächten UND
--    nur mit Code). Er wird durch einen ersetzt, der nur noch das prüft, was
--    ohne den Typ unsinnig wäre.
alter table public.property_discounts
    drop constraint if exists property_discounts_fields_by_type;

alter table public.property_discounts
    drop column if exists days_before,
    drop column if exists starts_on,
    drop column if exists ends_on;

alter table public.property_discounts
    drop constraint if exists property_discounts_type_chk;
alter table public.property_discounts
    add constraint property_discounts_type_chk
    check (
        -- Ein Längenrabatt ohne Nächtegrenze wäre ein Rabatt auf alles.
        (discount_type <> 'length_of_stay' or min_nights is not null)
        -- Ein Frühbucher ohne Vorlauf-Untergrenze ebenso …
    and (discount_type <> 'early_booker' or lead_min_days is not null)
        -- … und Last Minute ohne Obergrenze.
    and (discount_type <> 'last_minute' or lead_max_days is not null)
    );

-- 5) Der partielle UNIQUE-Index von 0185 („höchstens EINE aktive Regel je
--    Nicht-custom-Typ") passt nicht mehr: `promotion` ist der Normalfall und
--    darf mehrfach existieren (Sommeraktion und Winteraktion), genau wie
--    `custom`. Für die drei Kurven-Typen bleibt er als Idempotenz-Backstop
--    (Doppelklick/Retry) bestehen (Wurzel 2).
drop index if exists property_discounts_one_active_singleton;
create unique index if not exists property_discounts_one_active_curve
    on public.property_discounts (property_id, discount_type)
    where active
      and discount_type in ('length_of_stay', 'early_booker', 'last_minute');

comment on column public.property_discounts.stay_ranges is
  'Aufenthaltsdaten: [{"from":"YYYY-MM-DD","to":"YYYY-MM-DD"}]. Leer = jeder Aufenthalt.';
comment on column public.property_discounts.lead_min_days is
  'Frühbucher: gebucht mindestens X Tage vor Anreise.';
comment on column public.property_discounts.lead_max_days is
  'Last Minute: gebucht höchstens X Tage vor Anreise.';
comment on column public.property_discounts.promo_codes is
  'Angebotscodes; der Gast muss einen davon eingeben. Leer = kein Code nötig.';
