-- 0410 — Storno: WER hat storniert (Partei) und WARUM (kategorisierter Grund)
--
-- DER ANLASS: Eine Marktplatz-Buchung (myBestDays, 8 % Provision) soll bei
-- einem Storno je nach VERURSACHER anders behandelt werden — das ist das
-- Modell der Portale: bei Booking.com fällt Provision auf einbehaltene
-- Stornogebühren an, entfällt aber bei einem korrekt beantragten Storno des
-- Gastgebers; bei Airbnb behält Airbnb die Servicegebühr, wenn der GAST
-- storniert, und belastet den GASTGEBER, wenn er selbst storniert. Beide
-- Regeln setzen voraus, dass das System die Partei kennt.
--
-- HEUTE KENNT ES SIE NICHT: `reservations.cancelled_by` (0050) ist eine nackte
-- User-UUID ohne Rollenkategorie, und der Gast-Storno über
-- `guest_bookings.cancel_booking` schreibt dort `NULL` — ein Portal-Gast ist
-- keine `public.users`-Zeile, der FK bräche sonst. „Gast hat storniert" und
-- „Auslöser unbekannt" sind damit NICHT unterscheidbar. `cancel_reason` ist
-- Pflicht-FREITEXT und für eine Regel nicht auswertbar.
--
-- WAS DIESE MIGRATION TUT: zwei typisierte Spalten an `reservations` und
-- dieselben zwei an der append-only Historie `reservation_cancellation_log`.
-- Der Freitext `cancel_reason` BLEIBT — er trägt den Einzelfall, der Code die
-- Kategorie. Vorbild für die Typisierung: `reservation_addons.cancelled_by`
-- (0397).
--
-- BESTANDSZEILEN BEKOMMEN KEINEN WERT. Für die rund 20 Jahre Storno-Historie
-- dieses Systems ist die Partei nicht rekonstruierbar: `cancelled_by = NULL`
-- kann Gast ODER System ODER Import sein. Ein geratener Wert wäre eine
-- Falschaussage, auf deren Grundlage später echtes Geld verteilt wird
-- (Wurzel 4). Die Spalten bleiben dort `null`, und die Oberfläche benennt das
-- als „nicht erfasst".
--
-- KEINE RLS-/GRANT-ÄNDERUNG: es sind Spalten an bestehenden Tabellen, deren
-- Policies und Grants unverändert weitergelten (`reservations` seit 0023,
-- `reservation_cancellation_log` seit 0050).

-- ---------------------------------------------------------------------------
-- 1) Die Partei — WESSEN Sphäre den Storno ausgelöst hat.
--
--    Als Enum und nicht als text+CHECK, weil dieser Wert in Etappe 3/4 eine
--    Geldentscheidung steuert: ein Tippfehler („gaste") muss beim INSERT
--    scheitern, nicht erst im Regelwerk als unbekannter Fall auftauchen.
--    Muster wie `platform_fee_status` (0182).
-- ---------------------------------------------------------------------------
do $$
begin
    if not exists (select 1 from pg_type where typname = 'cancel_party') then
        create type public.cancel_party as enum (
            -- Der Gast selbst (Gäste-Storno über die Buchungsansicht).
            'gast',
            -- Der Eigentümer des Objekts bzw. seine Sphäre (Eigennutzung).
            'eigentuemer',
            -- Ein Co-Gastgeber / eine verwaltende Agentur.
            'agentur',
            -- Der Betrieb selbst (admin/co_admin im PMS).
            'betrieb',
            -- Das Portal/OTA hat storniert (Import eines Fremd-Stornos).
            'portal',
            -- Unsere eigene Automatik (Rollback, Aufräumlauf) — kein Mensch.
            'system'
        );
    end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2) Der kategorisierte Grund — WARUM.
--
--    Ergänzt den Freitext, ersetzt ihn nicht. Zweck: auswertbar machen, was
--    heute nur lesbar ist (Statistik, Regelvorschlag, Filter in der Queue).
-- ---------------------------------------------------------------------------
do $$
begin
    if not exists (
        select 1 from pg_type where typname = 'cancel_reason_code'
    ) then
        create type public.cancel_reason_code as enum (
            -- Der Gast will nicht mehr / hat umdisponiert.
            'gast_wunsch',
            -- Zahlung kam nicht (Frist verstrichen, Karte abgelehnt).
            'zahlung_ausgeblieben',
            -- Das Objekt/die Einheit steht nicht zur Verfügung.
            'objekt_nicht_verfuegbar',
            -- Schaden/Instandsetzung macht den Aufenthalt unmöglich.
            'schaden_instandsetzung',
            -- Der Zeitraum wird für Eigennutzung gebraucht.
            'eigennutzung',
            -- Eine EIGENNUTZUNG wird aufgelöst (Eigentümer entfernt,
            -- Sperrgenehmigung widerrufen). Nicht dasselbe wie
            -- 'eigennutzung': dort ist sie der Grund, hier das Objekt.
            'eigennutzung_aufgeloest',
            -- Dieselben Nächte doppelt verkauft.
            'doppelbuchung',
            -- Betrugsverdacht (Zahlungsmittel, Identität).
            'verdacht_betrug',
            -- Das Portal hat storniert, wir ziehen nach.
            'portal_storno',
            -- Unsere Automatik nimmt eine eigene Anlage zurück.
            'system_rollback',
            -- Alles andere — dann trägt der Freitext die Erklärung.
            'sonstiges'
        );
    end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3) Die Spalten an der Reservierung (denormalisiert am Datensatz, Muster 0050).
-- ---------------------------------------------------------------------------
alter table public.reservations
    add column if not exists cancelled_by_party public.cancel_party,
    add column if not exists cancel_reason_code public.cancel_reason_code;

comment on column public.reservations.cancelled_by_party is
    'Wessen Sphäre den Storno ausgelöst hat. NULL = vor 0410 storniert, also '
    'nicht erfasst — NIE als "unbekannt" oder als Gast-Storno deuten.';
comment on column public.reservations.cancel_reason_code is
    'Kategorie des Storno-Grundes, zusätzlich zum Freitext cancel_reason. '
    'NULL = nicht angegeben (der Freitext ist die Pflichtangabe, nicht dieser '
    'Code).';

-- ---------------------------------------------------------------------------
-- 4) Dieselben zwei Spalten in der append-only Historie.
--
--    WARUM DOPPELT: `reservations` trägt den LETZTEN Storno, das Log JEDEN.
--    Eine Buchung kann storniert, per Support reaktiviert und erneut
--    storniert werden — dann von einer anderen Partei aus einem anderen
--    Grund. Nur im Log bleibt beides erhalten.
-- ---------------------------------------------------------------------------
alter table public.reservation_cancellation_log
    add column if not exists cancelled_by_party public.cancel_party,
    add column if not exists cancel_reason_code public.cancel_reason_code;

comment on column public.reservation_cancellation_log.cancelled_by_party is
    'Partei DIESES Storno-Vorgangs (der Datensatz an reservations trägt nur '
    'den letzten). NULL = Zeile aus der Zeit vor 0410.';
comment on column public.reservation_cancellation_log.cancel_reason_code is
    'Grund-Kategorie DIESES Storno-Vorgangs, zusätzlich zum Freitext reason.';

-- ---------------------------------------------------------------------------
-- 5) Index für die Auswertung „welche Stornos wartet auf einen Entscheid".
--
--    Die Storno-Queue (Etappe 3) filtert je Tenant auf storniert + Partei.
--    Partiell auf die Storno-Zeilen: sie sind der kleine Teil der Tabelle.
-- ---------------------------------------------------------------------------
create index if not exists reservations_cancel_party_idx
    on public.reservations (tenant_id, cancelled_by_party)
    where status = 'cancelled';
