-- 0555_dp_far_future.sql — Aufschlag für weit entfernte Termine
--
-- WARUM
-- =====
-- Der Last-Minute-Rabatt existiert seit 0055 und ist gut verstanden: je näher
-- die Anreise, desto billiger die noch freie Nacht. Das Gegenstück fehlte.
--
-- Wer ein Jahr im Voraus bucht, plant fest — eine Hochzeit, ein Familientreffen,
-- die Sommerferien mit Schulkindern. Er vergleicht weniger und storniert
-- seltener; dieselbe Nacht ist ihm mehr wert als dem Kurzentschlossenen. Ohne
-- diese Regel verkauft das Objekt seine besten Termine zum Normalpreis, bevor
-- die Nachfrage überhaupt sichtbar wird.
--
-- FORM WIE BEI last_minute, RICHTUNG UMGEKEHRT
--   [{"days_before": 180, "uplift_pct": 10},
--    {"days_before": 240, "uplift_pct": 15},
--    {"days_before": 330, "uplift_pct": 25}]
-- Es gilt die WEITESTE erreichte Schwelle (bei 350 Tagen also +25 %), nicht
-- die engste wie beim Rabatt — sonst überschriebe "ab 180 Tagen +10 %" den
-- höheren Aufschlag, und die Leiter liefe verkehrt herum.
--
-- LEER IST DER STANDARD, nicht eine Vorgabe: ein Aufschlag, den niemand
-- eingestellt hat, darf nicht stillschweigend gelten (Wurzel 4 — keine
-- erfundenen Werte).

alter table public.dp_settings
    add column if not exists far_future jsonb not null default '[]'::jsonb;

comment on column public.dp_settings.far_future is
  'Aufschlag fuer lange Vorausbuchung: [{"days_before": 180, "uplift_pct": 10}, '
  '...]. Es gilt die WEITESTE erreichte Schwelle. Leer = kein Aufschlag.';

-- Form erzwingen (Wurzel 4/5: ein Tippfehler darf nicht als "keine Regel"
-- durchgehen, sonst rechnet die Engine still ohne sie weiter).
--
-- Als FUNKTION, nicht als Inline-CHECK: ein CHECK darf keine Subquery
-- enthalten, und ohne Subquery laesst sich ein JSON-Array nicht elementweise
-- pruefen (dieselbe Loesung wie dp_occupancy_steps_gueltig in 0550).
create or replace function public.dp_far_future_gueltig(regeln jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
    select jsonb_typeof(regeln) = 'array'
       and jsonb_array_length(regeln) <= 10
       and not exists (
           select 1
           from jsonb_array_elements(regeln) as r
           where jsonb_typeof(r) <> 'object'
              or jsonb_typeof(r -> 'days_before') <> 'number'
              or jsonb_typeof(r -> 'uplift_pct') <> 'number'
              or (r ->> 'days_before')::numeric < 1
              or (r ->> 'days_before')::numeric > 730
              or (r ->> 'uplift_pct')::numeric < 0
              or (r ->> 'uplift_pct')::numeric > 300
       );
$$;

revoke execute on function public.dp_far_future_gueltig(jsonb)
    from anon, authenticated;

alter table public.dp_settings
    drop constraint if exists dp_settings_far_future_form;
alter table public.dp_settings
    add constraint dp_settings_far_future_form
    check (public.dp_far_future_gueltig(far_future));
