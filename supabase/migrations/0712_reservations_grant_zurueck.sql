-- 0712 — nimmt die Spalten-Einschränkung aus 0710 auf `reservations` zurück.
--
-- WARUM ZURÜCK: 0710 hat das pauschale Tabellen-GRANT durch acht Spalten
-- ersetzt, um zu verhindern, dass ein Eigentümer über
-- `GET /rest/v1/reservations` an `guest_email`, `guest_phone`,
-- `guest_address` und die Beträge kommt — Felder, die `guest_masking` ihm
-- über die API verweigert. Das Ziel war richtig, das Mittel nicht:
--
-- Supabase Realtime prüft je Ereignis die Sichtbarkeit der ZEILE, indem es
-- sie als die abonnierende Rolle liest. Fehlt der Rolle auch nur eine
-- Spalte, schlägt diese Prüfung fehl und es kommen GAR KEINE Ereignisse mehr
-- — nicht weniger, keine. An `reservations` hängen 34 Abos in allen sechs
-- Oberflächen und den drei Apps; Kalender, Posteingang, Belegung und
-- Auslastung hätten aufgehört, sich zu aktualisieren, und zwar STILL. Genau
-- die Attrappe, vor der CLAUDE.md im Realtime-Abschnitt warnt, nur diesmal
-- selbst gebaut. `scripts/realtime/abos-pruefen.sh` hat es sofort gemeldet.
--
-- WAS DAMIT OFFEN BLEIBT (bewusst, nicht vergessen): Der Direktpfad gibt
-- einem angemeldeten Eigentümer weiterhin alle Spalten SEINER Buchungen. Der
-- Zeilen-Scope aus `reservations_owner_scope` greift, die Spalten-Maske der
-- API nicht. Das ist mit einem GRANT nicht zu lösen, solange dieselbe Tabelle
-- die Realtime-Quelle ist. Die zwei tragfähigen Wege:
--   1. Realtime auf eine eigene, schlanke Signaltabelle umhängen (nur
--      `id, tenant_id, property_id, updated_at`) und `reservations` dann
--      vollständig sperren.
--   2. Eine `security_invoker`-Sicht mit den erlaubten Spalten veröffentlichen
--      und die Abos darauf legen.
-- Beides ist ein eigener Umbau mit Änderungen in allen Frontends, kein
-- Migrations-Einzeiler. Bis dahin steht der Befund offen und dokumentiert —
-- das ist ehrlicher als eine Sperre, die die App unbemerkt tot macht.
--
-- Die übrigen Teile von 0710 bleiben: der Objekt-Scope auf den 15
-- Geschwistertabellen und der Entzug für `anon`. Beide betreffen keine
-- Realtime-Quelle der Apps.

begin;

grant select on public.reservations to authenticated;

commit;
