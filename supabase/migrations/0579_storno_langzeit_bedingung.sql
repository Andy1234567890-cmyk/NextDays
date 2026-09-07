-- 0579_storno_langzeit_bedingung.sql — eigene Stornobedingung für LANGE Aufenthalte
--
-- ANLASS (06.09.2026): Das Vorbild trennt die Stornierung in zwei Fälle und
-- zeigt sie als zwei Karten nebeneinander:
--
--   Kurzzeitaufenthalte   „Für weniger als 28 Nächte"   → Moderat-streng
--   Langzeitaufenthalte   „Für mindestens 28 Nächte"    → Moderat-streng für
--                                                         Langzeitbuchungen
--
-- Der Grund ist kein Design, sondern die Sache selbst: wer einen Monat bucht,
-- storniert anders als wer zwei Nächte bucht, und die Portale führen dafür
-- getrennte Richtlinien. 0165 gab uns EINE Bedingung je Preisplan
-- (`rate_plans.booking_condition_id`) — damit ließ sich der zweite Fall nicht
-- abbilden, und eine Oberfläche hätte für beide Karten denselben Wert zeigen
-- müssen: eine Attrappe (Wurzel 4).
--
-- Diese Migration gibt dem Preisplan die ZWEITE Zuordnung. Die erste bleibt
-- unverändert und gilt weiterhin für alles, was kürzer ist als die Schwelle.
--
-- NULL heißt „keine eigene Langzeit-Bedingung" — dann gilt die Kurzzeit-
-- Bedingung auch für lange Aufenthalte, wie bisher. Kein Bestand ändert sich.
--
-- Die Schwelle (28 Nächte) steht NICHT hier: sie ist eine fachliche Konstante
-- des Auswerters (`booking_conditions/plan.py`), keine Spalte, die pro Objekt
-- verstellt wird. Wird sie später verstellbar, gehört sie an die Kondition —
-- nicht an den Preisplan.
--
-- KEIN `begin;`/`commit;`: `apply-migrations.sh` fährt jede Migration bereits
-- in einer eigenen Transaktion (Lehre aus 0576).

alter table public.rate_plans
    add column if not exists booking_condition_long_id uuid
        references public.booking_conditions (id) on delete set null;

create index if not exists rate_plans_booking_condition_long_idx
    on public.rate_plans (booking_condition_long_id)
    where booking_condition_long_id is not null;

comment on column public.rate_plans.booking_condition_long_id is
    'Stornobedingung für LANGE Aufenthalte (ab 28 Nächten, 0579). '
    'NULL = es gilt booking_condition_id auch für lange Aufenthalte.';
