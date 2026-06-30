-- 0085_service_role_statement_timeout.sql — DB-Backpressure (Infra-Runbook Punkt 8)
--
-- Problem: Die Rolle `service_role` (mit der das Backend für viele Pfade arbeitet,
-- u. a. der booking_engine/listings-Pfad, der den N+1-Timeout auslöste) hatte
-- KEIN statement_timeout — eine langsame Query lief unbegrenzt und konnte
-- Connections aushungern, bis der ganze Server mitgerissen wurde. anon (3s) und
-- authenticated/authenticator (8s) waren bereits gedeckelt; service_role nicht.
--
-- Fix: endlicher Statement-/Lock-Deckel auch für service_role. Großzügiger als
-- authenticated (das Backend macht legitim auch mal schwerere Aggregationen/
-- Recompute), aber endlich — verhindert das „ein Endpoint reißt alles mit".
--
-- Idempotent: ALTER ROLE SET ist wiederholbar. Wirkt für neue Sessions/Connections
-- (PostgREST baut den Pool neu auf); ein PostgREST-Neustart erzwingt es sofort.
-- Kein Tabellen-/RLS-/Realtime-Bezug.

alter role service_role set statement_timeout = '15s';
alter role service_role set lock_timeout = '8s';
