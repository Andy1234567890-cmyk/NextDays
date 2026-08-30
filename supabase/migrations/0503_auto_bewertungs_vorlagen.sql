-- 0503 — Auto-Bewertungen als VORLAGEN je Objekt, mit mehreren Texten
--
-- Bisher: EINE Konfiguration je Betrieb (review_automation, 0263) mit EINEM
-- Text. Bei 500 Reservierungen geht damit 500-mal derselbe Satz an dasselbe
-- Portal.
--
-- Genau davor warnt Hostaway in seiner eigenen Dokumentation, und es ist kein
-- Geschmacksurteil, sondern ein Betriebsbefund:
--
--     „Airbnb may penalize this practice, and it may affect the SEO."
--
-- Deshalb verlangen sie MINDESTENS DREI Texte je Auto-Bewertung und waehlen
-- beim Versand zufaellig einen aus. Das uebernehmen wir.
--
-- Zweite Aenderung: die Vorlage haengt am OBJEKT, nicht am Betrieb. Ein
-- Ferienhaus am Strand und ein Stadtapartment verdienen nicht denselben
-- Bewertungstext, und ein Betrieb mit 19 Objekten konnte das bisher nicht
-- ausdruecken.
--
-- Was NICHT uebernommen wird: Hostaway verdrahtet die Note fest auf 5
-- („It is not possible to modify this in the auto-review"). Unsere freie Wahl
-- plus die `min_rating`-Bedingung ist die reifere Loesung und bleibt.
--
-- === Der Gegenzustand (Wurzel 1) ===
-- `review_automation` bleibt bestehen und behaelt die Gast-Erinnerung. Ihre
-- Auto-Bewertungs-Felder werden zum RUECKFALL fuer Objekte OHNE eigene
-- Vorlage — sie ersatzlos zu streichen wuerde jede bestehende Automatik still
-- abschalten, und niemand haette es bemerkt, bis Wochen spaeter keine
-- Bewertung mehr rausging.

create table if not exists public.review_auto_template (
    id            uuid primary key default gen_random_uuid(),
    tenant_id     uuid not null references public.tenants (id) on delete cascade,
    -- Der Name, unter dem die Karte in der Liste steht. Frei waehlbar, weil
    -- ein Betrieb mit mehreren Vorlagen sie unterscheiden koennen muss.
    name          text not null check (btrim(name) <> ''),
    aktiv         boolean not null default true,
    -- Tage nach Abreise. Derselbe Deckel wie 0263: die Portale schliessen ihr
    -- Fenster nach 14 Tagen (Airbnb) bzw. 3 Monaten (Booking.com).
    nach_tagen    integer not null default 3
        check (nach_tagen between 0 and 30),
    -- Note und Bedingung wie in 0263 — hier je Vorlage statt je Betrieb.
    note          smallint not null default 5 check (note between 1 and 5),
    min_gastnote  smallint check (min_gastnote between 1 and 5),
    -- Die Texte. jsonb-Array aus Zeichenketten; der Versand waehlt zufaellig
    -- einen aus.
    --
    -- Warum jsonb und keine Kindtabelle: es sind drei bis fuenf Saetze ohne
    -- eigene Identitaet, die immer zusammen gelesen und zusammen geschrieben
    -- werden. Eine Kindtabelle brauechte Reihenfolge, eigene RLS und einen
    -- zweiten Schreibpfad fuer null Gewinn.
    texte         jsonb not null default '[]'::jsonb,
    -- Der private Hinweis geht nur an den Gast, nicht an die Oeffentlichkeit.
    -- EINER, nicht mehrere: er wird nicht oeffentlich indexiert, also greift
    -- Airbnbs Duplikat-Regel hier nicht.
    privater_text text,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

-- Mindestens EIN nicht-leerer Text, sobald die Vorlage aktiv ist. Eine aktive
-- Vorlage ohne Text wuerde beim Versand eine leere Bewertung erzeugen — oder,
-- schlimmer, still uebersprungen (Wurzel 5: laut scheitern, hier schon beim
-- Speichern).
--
-- Als IMMUTABLE-Funktion und nicht direkt im CHECK: ein CHECK darf keine
-- Unterabfrage enthalten, und `jsonb_array_elements` ist eine. Dieselbe
-- Loesung wie bei `ki_themen_gueltig` (0501).
create or replace function public.review_texte_gueltig(texte jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(texte) = 'array'
     and not exists (
       select 1 from jsonb_array_elements(texte) as e
       where jsonb_typeof(e) <> 'string' or btrim(e #>> '{}') = ''
     );
$$;

comment on function public.review_texte_gueltig(jsonb) is
  'Prueft, dass texte ein Array aus nicht-leeren Zeichenketten ist. Ein '
  'leerer Text erzeugte sonst beim Versand eine leere oeffentliche Bewertung.';

revoke execute on function public.review_texte_gueltig(jsonb)
  from anon, authenticated;

alter table public.review_auto_template
  drop constraint if exists review_auto_template_texte_check;
alter table public.review_auto_template
  add constraint review_auto_template_texte_check check (
    public.review_texte_gueltig(texte)
    and (not aktiv or jsonb_array_length(texte) >= 1)
  );

-- Welche Objekte eine Vorlage bedient. Eigene Tabelle statt einer Spalte:
-- Hostaway laesst eine Auto-Review mehrere Listings bedienen („Listings:"),
-- und ein Betrieb mit 19 gleichartigen Ferienhaeusern will nicht 19 Vorlagen
-- pflegen.
create table if not exists public.review_auto_template_property (
    template_id uuid not null references public.review_auto_template (id)
                on delete cascade,
    property_id uuid not null references public.properties (id) on delete cascade,
    primary key (template_id, property_id)
);

-- Ein Objekt darf hoechstens EINE AKTIVE Vorlage haben — sonst waere beim
-- Versand nicht entschieden, welche gilt, und der Betrieb bekaeme je nach
-- Sortierung eine andere Bewertung. Dieselbe Regel wie bei Hostaway („each
-- listing can only have one auto-review").
--
-- Als TRIGGER und nicht als partieller UNIQUE-Index: der Index braeuchte die
-- `aktiv`-Spalte der ANDEREN Tabelle, und ein Index-Praedikat darf keine
-- Unterabfrage enthalten (Postgres verlangt IMMUTABLE). Ein Trigger ist hier
-- der einzige DB-seitige Weg — und er MUSS in der DB sitzen: eine Pruefung im
-- Code liesse zwei gleichzeitige Anfragen beide durch (Wurzel 2).
--
-- `set search_path = ''` + schema-qualifiziert, wie fuer jede SECURITY-nahe
-- Funktion vorgeschrieben.
create or replace function public.review_auto_template_ein_aktives()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  ist_aktiv boolean;
  kollision uuid;
begin
  -- Bei INSERT/UPDATE auf der Zuordnung: haengt die neue Zeile an einer
  -- aktiven Vorlage?
  if tg_table_name = 'review_auto_template_property' then
    select t.aktiv into ist_aktiv
      from public.review_auto_template t where t.id = new.template_id;
    if not coalesce(ist_aktiv, false) then
      return new;
    end if;
    select tp.template_id into kollision
      from public.review_auto_template_property tp
      join public.review_auto_template t on t.id = tp.template_id
     where tp.property_id = new.property_id
       and tp.template_id <> new.template_id
       and t.aktiv
     limit 1;
  else
    -- Beim Aktivschalten einer Vorlage: hat eines ihrer Objekte schon eine?
    if not new.aktiv then
      return new;
    end if;
    select tp.property_id into kollision
      from public.review_auto_template_property tp
     where tp.template_id = new.id
       and exists (
         select 1
           from public.review_auto_template_property andere
           join public.review_auto_template t on t.id = andere.template_id
          where andere.property_id = tp.property_id
            and andere.template_id <> new.id
            and t.aktiv
       )
     limit 1;
  end if;

  if kollision is not null then
    -- Laut scheitern statt still die zweite Vorlage zu gewinnen zu lassen.
    raise exception
      'Für dieses Objekt ist bereits eine Auto-Bewertung aktiv.'
      using errcode = 'unique_violation';
  end if;
  return new;
end;
$$;

revoke execute on function public.review_auto_template_ein_aktives()
  from anon, authenticated;

drop trigger if exists trg_review_auto_template_property_eindeutig
  on public.review_auto_template_property;
create trigger trg_review_auto_template_property_eindeutig
    before insert or update on public.review_auto_template_property
    for each row execute function public.review_auto_template_ein_aktives();

drop trigger if exists trg_review_auto_template_eindeutig
  on public.review_auto_template;
create trigger trg_review_auto_template_eindeutig
    before update of aktiv on public.review_auto_template
    for each row execute function public.review_auto_template_ein_aktives();

create index if not exists review_auto_template_tenant_idx
    on public.review_auto_template (tenant_id, created_at desc);
create index if not exists review_auto_template_property_idx
    on public.review_auto_template_property (property_id);

drop trigger if exists trg_review_auto_template_updated
  on public.review_auto_template;
create trigger trg_review_auto_template_updated
    before update on public.review_auto_template
    for each row execute function public.set_updated_at();

-- =========================================================================
-- RLS + harter Grant-Entzug (Wurzel 6)
-- =========================================================================
-- Genau wie review_automation (0263): die Vorlage steuert einen unumkehrbaren
-- Aussenffekt — eine oeffentliche Bewertung beim Portal, die kein Portal
-- zuruecknimmt. Sie verlaesst die DB nur ueber den Server.
alter table public.review_auto_template enable row level security;
alter table public.review_auto_template_property enable row level security;

revoke all on public.review_auto_template from anon, authenticated;
revoke all on public.review_auto_template_property from anon, authenticated;

create policy review_auto_template_tenant on public.review_auto_template
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

create policy review_auto_template_property_tenant
    on public.review_auto_template_property
    as restrictive for all
    using (
      exists (
        select 1 from public.review_auto_template t
        where t.id = template_id
          and t.tenant_id = public.current_tenant_id()
      )
    )
    with check (
      exists (
        select 1 from public.review_auto_template t
        where t.id = template_id
          and t.tenant_id = public.current_tenant_id()
      )
    );

-- =========================================================================
-- Bestand uebernehmen
-- =========================================================================
-- Jeder Betrieb mit AKTIVER Auto-Bewertung und Text bekommt eine Vorlage mit
-- denselben Werten, die fuer ALLE seine Objekte gilt. Ohne diesen Schritt
-- stuende die neue Oberflaeche leer da und die Automatik liefe unsichtbar
-- ueber den alten Weg weiter — zwei Wahrheiten nebeneinander.
--
-- Nur wo wirklich ein Text steht: eine Vorlage ohne Text waere gegen den
-- CHECK oben und ist auch fachlich keine.
insert into public.review_auto_template
    (tenant_id, name, aktiv, nach_tagen, note, min_gastnote, texte, privater_text)
select a.tenant_id,
       'Übernommen aus der Automatik',
       true,
       a.auto_review_after_days,
       a.auto_review_rating,
       a.auto_review_min_rating,
       jsonb_build_array(a.auto_review_public),
       a.auto_review_private
  from public.review_automation a
 where a.auto_review_active
   and a.auto_review_public is not null
   and btrim(a.auto_review_public) <> ''
   and not exists (
     select 1 from public.review_auto_template t where t.tenant_id = a.tenant_id
   );

-- Die uebernommenen Vorlagen gelten fuer alle Objekte des Betriebs — genau
-- das, was die Betriebs-Konfiguration vorher tat.
insert into public.review_auto_template_property (template_id, property_id)
select t.id, p.id
  from public.review_auto_template t
  join public.properties p on p.tenant_id = t.tenant_id
 where t.name = 'Übernommen aus der Automatik'
on conflict do nothing;
