-- 0134_channex_feed_lock.sql
-- Session-Advisory-Lock für den kontoweiten Channex-Booking-Feed-Pull.
--
-- Der Job-Dedup-Key koalesziert nur QUEUED-Jobs (0108). Er verhindert NICHT,
-- dass ein Webhook-getriggerter sync_bookings_feed-Job neben einem bereits
-- LAUFENDEN Feed-Job geclaimt wird (claim_jobs prüft keine laufenden Zwillinge).
-- Zwei parallele Feed-Läufe auf demselben kontoweiten Feed würden sich
-- gegenseitig die Seiten weg-acken (Revisions-Regression) und beim Insert in
-- den reservations-Unique-Index laufen.
--
-- Diese RPCs kapseln pg_try_advisory_lock/unlock (SECURITY DEFINER, damit die
-- Service-Role sie ohne extra Grant nutzen kann). try_… gibt true zurück, wenn
-- der Lock frei war und erworben wurde; sonst false → der Aufrufer kehrt sofort
-- ohne Arbeit zurück (Single-Flight). release_… gibt ihn wieder frei.
--
-- Der Lock ist SESSION-scoped: der supabase-py-Client hält eine dauerhafte
-- Verbindung; ein Prozess-/Verbindungsabbruch gibt den Lock automatisch frei
-- (kein Deadlock bei Worker-Crash).

create or replace function public.try_channex_feed_lock(p_key bigint)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select pg_try_advisory_lock(p_key);
$$;

create or replace function public.release_channex_feed_lock(p_key bigint)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select pg_advisory_unlock(p_key);
$$;
