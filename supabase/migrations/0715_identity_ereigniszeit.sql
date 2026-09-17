-- Reihenfolge der Identitäts-Ereignisse festhalten (Wurzel 2 + 5b).
--
-- BEFUND (17.09.2026, live). Die Kontoseite zeigte „Wird geprüft …", obwohl bei
-- Stripe BEIDE Prüfsitzungen des Gastgebers auf `verified` stehen. In der
-- Datenbank stand `processing`, mit der Kennung der ÄLTEREN Sitzung und einem
-- `updated_at` eine Stunde nach der erfolgreichen Prüfung.
--
-- Ursache ist die Zustellreihenfolge. Während die Webhook-Geheimnisse fehlten,
-- quittierte die Route jedes Ereignis mit 400; Stripe sammelte sie und stellte
-- den Rückstand nach der Reparatur erneut zu — in BELIEBIGER Reihenfolge. So
-- traf `…session.processing` der Sitzung von 12:33 ein, NACHDEM
-- `…session.verified` der Sitzung von 12:47 bereits verarbeitet war, und
-- überschrieb sie. Der Handler schrieb bedingungslos.
--
-- Das ist kein Sonderfall der Störung: Stripe garantiert die Reihenfolge
-- generell nicht, und jede Wiederholung kann alt sein (Wurzel 2 — real kommt
-- alles doppelt). Ohne einen Zeitstempel AM DATENSATZ ist ein veraltetes
-- Ereignis von einem neuen nicht zu unterscheiden.
--
-- Maßgeblich ist der Zeitpunkt des STRIPE-EREIGNISSES, nicht unsere Uhr
-- (Wurzel 5b): `created_at`/`updated_at` beschreiben unsere Verarbeitung, und
-- genau die war hier ja verspätet.
alter table public.users
    add column if not exists identity_event_at timestamptz;

comment on column public.users.identity_event_at is
    'Zeitpunkt des Stripe-Ereignisses, das den aktuellen identity_status gesetzt '
    'hat (event.created, NICHT unsere Uhr). Ein später eintreffendes, aber '
    'älteres Ereignis wird daran erkannt und verworfen — Stripe garantiert '
    'keine Zustellreihenfolge und wiederholt beliebig.';

-- Bestand: Für die bereits gesetzten Status ist der beste bekannte Zeitpunkt
-- `identity_verified_at` (nur bei verified vorhanden). Wo er fehlt, bleibt die
-- Spalte NULL — dann greift der Guard nicht und das nächste Ereignis wird
-- angenommen. Das ist richtig so: ein erfundener Zeitpunkt würde echte
-- Ereignisse aussperren (Wurzel 4).
update public.users
   set identity_event_at = identity_verified_at
 where identity_verified_at is not null
   and identity_event_at is null;
