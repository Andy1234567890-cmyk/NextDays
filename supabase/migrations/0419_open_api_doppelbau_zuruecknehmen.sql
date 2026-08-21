-- 0419_open_api_doppelbau_zuruecknehmen.sql — Rücknahme von 0418_open_api_webhooks_idempotenz
--
-- WAS HIER PASSIERT: Die vier Tabellen aus 0418_open_api_webhooks_idempotenz
-- (`api_events`, `api_webhooks`, `api_webhook_deliveries`,
-- `api_idempotency_keys`) werden entfernt. Sie sind ein DOPPELBAU: dieselbe
-- Sache existiert bereits als `public_api_events`, `public_api_webhooks`,
-- `public_api_deliveries`, `public_api_idempotency` aus
-- `0418_public_api.sql` — samt der DB-Trigger, die Ereignisse selbst erzeugen.
--
-- WIE ES DAZU KAM: Am 21.08.2026 wurde die öffentliche Partner-API in zwei
-- Strängen gleichzeitig gebaut. Beide kamen fachlich zum gleichen Ergebnis
-- (RFC 9457 als Fehlerformat, Idempotency-Key nach Stripe-Vorbild, Ereignisse
-- als abrufbare Tabelle statt nur als Push) — was für die Recherche spricht,
-- aber zwei Tabellensätze für eine Sache hinterlassen hat. Beide wurden im
-- selben Lauf eingespielt, weil sie dieselbe Nummer 0418 tragen.
--
-- WARUM DIESER SATZ GEHT UND DER ANDERE BLEIBT: `public_api_*` ist der Satz,
-- an dem der laufende Dienst `apps/public-api` hängt, und er kann mehr —
-- die Ereignis-Erzeugung sitzt dort in DB-Triggern auf `reservations`,
-- `availability`, `rate_plan_price_overrides` und `tasks`. Das ist der
-- robustere Schnitt: ein Trigger kann nicht vergessen werden, ein Aufruf im
-- Anwendungscode schon. Genau daran scheitern Ereignis-Systeme in der Praxis —
-- ein neuer Schreibpfad wird gebaut, und niemand denkt an die Benachrichtigung.
--
-- SICHERHEIT DES LÖSCHENS: Vor dem Schreiben dieser Migration wurde gegen die
-- Live-DB geprüft, dass alle vier Tabellen 0 Zeilen enthalten — sie waren
-- Minuten alt und nie in Benutzung. Es gehen keine Daten verloren. Ohne
-- diesen Nachweis wäre ein `drop table` hier nicht zulässig.
--
-- `if exists` + `cascade`: idempotent (die Migration darf mehrfach laufen), und
-- `cascade` nimmt die zugehörigen Indizes/Policies mit. `cascade` ist hier
-- gefahrlos, weil auf diese vier Tabellen nichts anderes verweist — sie waren
-- nie verbaut. Bei einer Tabelle mit Fremdschlüssel-Bezügen wäre das eine
-- andere Entscheidung und müsste erst geprüft werden.

drop table if exists public.api_webhook_deliveries cascade;
drop table if exists public.api_idempotency_keys cascade;
drop table if exists public.api_events cascade;
drop table if exists public.api_webhooks cascade;
