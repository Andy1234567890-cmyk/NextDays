-- 0184_property_booking_mode_and_request.sql — Airbnb-Anfrage-Modell (Teil 2/2)
--
-- Nutzt die in 0183 committeten Enum-Werte (requested/declined/expired). Legt
-- den Buchungsmodus je OBJEKT an (1 property = 1 buchbare Einheit) + die
-- Anfrage-Felder auf reservations + baut den Double-Booking-EXCLUDE-Constraint
-- neu, damit eine offene Anfrage den Slot atomar belegt, eine abgelehnte/
-- abgelaufene ihn aber freigibt.

-- 1) Buchungsmodus je Objekt ---------------------------------------------------
-- instant = Sofortbuchung (Gast bucht, sofort confirmed — heutiges Verhalten).
-- request = Anfrage (Status 'requested', Host akzeptiert/lehnt in 24 h ab).
do $$
begin
    if not exists (select 1 from pg_type where typname = 'property_booking_mode') then
        create type public.property_booking_mode as enum ('instant', 'request');
    end if;
end $$;

alter table public.properties
    add column if not exists booking_mode public.property_booking_mode
        not null default 'instant';

comment on column public.properties.booking_mode is
  'Airbnb-Modell: instant = Sofortbuchung (sofort confirmed), request = Anfrage '
  '(Status requested, Host akzeptiert/lehnt in 24 h ab). Default instant '
  '(Bestandsobjekte buchen unverändert sofort).';

-- 2) Anfrage-Felder auf reservations -------------------------------------------
alter table public.reservations
    -- Ablauf der Anfrage (created_at + 24 h). NULL bei Sofortbuchungen (kein
    -- erfundener Default, Wurzel 4). Der Expire-Job liest status='requested'
    -- AND request_expires_at < now().
    add column if not exists request_expires_at timestamptz,
    -- Wer die Anfrage entschieden hat (accept/decline) + wann. NULL beim Auto-
    -- Ablauf (kein User als Auslöser → sonst FK-Verletzung).
    add column if not exists request_decided_by uuid references public.users (id),
    add column if not exists request_decided_at timestamptz,
    -- Optionale Ablehnungs-Begründung (Timeline/Gast). NULL = keine.
    add column if not exists request_decline_reason text;

-- Teil-Index für den Expire-Job: nur offene Anfragen mit Frist (klein, heiß).
create index if not exists reservations_requested_expiry_idx
    on public.reservations (request_expires_at)
    where status = 'requested';

comment on column public.reservations.request_expires_at is
  'Ablauf der Anfrage (created_at + 24 h). NULL bei Sofortbuchungen. Der '
  'Expire-Job setzt status=requested nach Ablauf auf expired + gibt Nächte frei.';

-- 3) EXCLUDE-Constraint neu (Double-Booking-Schutz, Wurzel 2) ------------------
-- Alt (0104): status <> 'cancelled'. Neu:
--  - 'requested' bleibt DRIN → eine offene Anfrage belegt den Slot atomar
--    (advisory-lock + EXCLUDE) → keine zwei gleichzeitigen Anfragen/Buchungen
--    auf dieselbe Nacht.
--  - 'declined'/'expired' MÜSSEN wie 'cancelled' RAUS, sonst blockiert eine
--    abgelehnte/abgelaufene Anfrage den Slot dauerhaft.
-- Der neue WHERE ist strikt STRENGER (schließt mehr aus) → kann gegen
-- Bestandsdaten keinen neuen Overlap-Konflikt erzeugen.
alter table public.reservations
    drop constraint if exists reservations_no_local_overlap;
alter table public.reservations
    add constraint reservations_no_local_overlap
    exclude using gist (
        property_id with =,
        daterange(check_in, check_out, '[)') with &&
    )
    where (
        status not in ('cancelled', 'declined', 'expired')
        and source_channex_booking_id is null
    );

-- 4) RLS: reservations ist bereits geschützt (0004/0058/0059 tenant + owner-
-- scope, Schreibpfade nur service_role). Die neuen Spalten sind nicht sensibler
-- als check_in/status → kein zusätzliches revoke nötig (Wurzel 6).
