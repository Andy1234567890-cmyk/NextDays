-- 0550_dp_preismodus_und_auslastungsstufen.sql
--
-- Zwei Erweiterungen am Dynamic Pricing, beide aus dem Whiteboard-Modell vom
-- 04.09.2026:
--
-- 1) PREISMODUS JE SAISONZEITRAUM (property_seasons.price_mode)
--    Der Saisonkalender ist die Steuerzentrale — nicht eine zweite, konkurrierende
--    Zeitraum-Ebene. Je Saison wird entschieden, WIE der Autopilot in ihrem
--    Zeitraum wirkt:
--      'steuert'   — Engine rechnet, ihr Preis gilt und geht an die Portale.
--                    Der Saisonpreis wirkt dabei als UNTERGRENZE (siehe unten).
--      'empfiehlt' — Engine rechnet, veröffentlicht aber NICHT. Es gilt der
--                    Saison-/manuelle Preis; der Vorschlag wird nur angezeigt
--                    und kann per Knopf übernommen werden.
--      'aussetzen' — Engine rechnet für diesen Zeitraum gar nicht.
--      'ki'        — vorgesehen, noch nicht wählbar (die KI schlägt später
--                    REGELN vor, keine Preise — deterministische Engine bleibt).
--    Zeiträume OHNE Saison behalten den Objekt-Schalter dp_settings.enabled.
--
--    Warum 'steuert' der Default ist: bis heute galt in einem Saisonzeitraum bei
--    aktivem DP der berechnete Preis. Ein anderer Default würde bestehende
--    Objekte still umstellen.
--
-- 2) AUSLASTUNGSSTUFEN (dp_settings.occupancy_steps)
--    Ablesbare Stufenleiter statt abstrakter Empfindlichkeits-Schraube:
--      [{"ab_pct": 50, "adjust_pct": 5}, {"ab_pct": 80, "adjust_pct": 15}, …]
--    Es gilt die HÖCHSTE erreichte Stufe (kein Addieren, keine Interpolation) —
--    damit ist der Aufschlag direkt aus der Tabelle ablesbar, wie eine Preisliste.
--    Negative adjust_pct sind erlaubt (schwache Zeiträume: ab 30 % → -10 %).
--    Sind Stufen gepflegt, ERSETZEN sie occupancy_sensitivity samt ihrer Deckel
--    (occupancy_discount_cap_pct/occupancy_premium_cap_pct) für den Auslastungs-
--    Faktor; leer = alles bleibt wie bisher. Eine Wirkung, eine Erklärung.

-- ---------------------------------------------------------------- Preismodus
do $$
begin
    if not exists (select 1 from pg_type where typname = 'dp_price_mode') then
        create type public.dp_price_mode as enum
            ('steuert', 'empfiehlt', 'aussetzen', 'ki');
    end if;
end
$$;

alter table public.property_seasons
    add column if not exists price_mode public.dp_price_mode
        not null default 'steuert';

comment on column public.property_seasons.price_mode is
  'Wie Dynamic Pricing in diesem Saisonzeitraum wirkt: steuert (Engine-Preis '
  'gilt, Saisonpreis als Untergrenze) | empfiehlt (rechnet, veroeffentlicht '
  'nicht) | aussetzen (rechnet nicht) | ki (vorgesehen). Greift nur, wenn '
  'dp_settings.enabled fuer das Objekt an ist.';

-- ------------------------------------------------------- Auslastungsstufen
alter table public.dp_settings
    add column if not exists occupancy_steps jsonb not null default '[]'::jsonb;

comment on column public.dp_settings.occupancy_steps is
  'Auslastungs-Stufenleiter: [{"ab_pct": 80, "adjust_pct": 15}, ...]. Es gilt '
  'die HOECHSTE erreichte Stufe. Nicht leer => ersetzt occupancy_sensitivity '
  'und deren Deckel fuer den Auslastungs-Faktor.';

-- Form erzwingen (Wurzel 4: kein stilles Verschlucken kaputter Konfiguration).
-- Ein Tippfehler im JSON darf nicht als "keine Stufen" durchgehen, sonst rechnet
-- die Engine still weiter mit der alten Kurve und niemand merkt es.
--
-- Als FUNKTION, nicht als Inline-CHECK: ein CHECK darf keine Subquery enthalten
-- (Postgres: "cannot use subquery in check constraint"), und ohne Subquery lässt
-- sich ein JSON-Array nicht elementweise prüfen.
create or replace function public.dp_occupancy_steps_gueltig(steps jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
    select jsonb_typeof(steps) = 'array'
       and jsonb_array_length(steps) <= 20
       and not exists (
           select 1
           from jsonb_array_elements(steps) as s
           where jsonb_typeof(s) <> 'object'
              or jsonb_typeof(s -> 'ab_pct') <> 'number'
              or jsonb_typeof(s -> 'adjust_pct') <> 'number'
              or (s ->> 'ab_pct')::numeric < 0
              or (s ->> 'ab_pct')::numeric > 100
              or (s ->> 'adjust_pct')::numeric < -90
              or (s ->> 'adjust_pct')::numeric > 300
       );
$$;

revoke execute on function public.dp_occupancy_steps_gueltig(jsonb)
    from anon, authenticated;

alter table public.dp_settings
    drop constraint if exists dp_settings_occupancy_steps_form;
alter table public.dp_settings
    add constraint dp_settings_occupancy_steps_form
    check (public.dp_occupancy_steps_gueltig(occupancy_steps));

-- ------------------------------------------------------------ Empfehlungswert
-- Modus 'empfiehlt' rechnet, veroeffentlicht aber nicht. Der Vorschlag braucht
-- deshalb eine eigene Ablage: dynamic_prices.price ist der GELTENDE Preis (nur
-- bei 'steuert' gefuellt), empfehlung_price der reine Vorschlag. Ohne diese
-- Trennung wuerde der Resolver den Empfehlungswert als gueltigen Preis lesen
-- und ihn an die Portale schicken — genau das, was 'empfiehlt' verhindern soll.
alter table public.dynamic_prices
    add column if not exists empfehlung_price numeric(12, 2)
        check (empfehlung_price is null or empfehlung_price >= 0);

comment on column public.dynamic_prices.empfehlung_price is
  'Berechneter Vorschlag im Saison-Modus "empfiehlt" — wird NICHT veroeffentlicht '
  'und NICHT an die Portale gesendet; nur Anzeige + Uebernehmen-Knopf. Im Modus '
  '"steuert" steht der geltende Preis wie bisher in price.';
