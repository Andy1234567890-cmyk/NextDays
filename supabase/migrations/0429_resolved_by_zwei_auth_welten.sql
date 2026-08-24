-- 0429_resolved_by_zwei_auth_welten.sql
-- `resolved_by` muss BEIDE Auth-Welten tragen — Betrieb UND Backoffice.
--
-- DER GEMESSENE BEFUND (Staging-DB, 24.08.2026)
-- Der Betrieb konnte im Backoffice KEIN Ereignis quittieren. Die Oberfläche
-- zeigte nur `internal_error`. Von Hand nachgestellt (lesend, in einer
-- zurückgerollten Transaktion):
--
--   update channex_webhook_event set resolved=true, resolved_by='…'::uuid …
--   ERROR:  insert or update on table "channex_webhook_event" violates
--           foreign key constraint "channex_webhook_event_resolved_by_fkey"
--   DETAIL: Key (resolved_by)=(…) is not present in table "users".
--
-- WARUM: der Fremdschlüssel zeigte auf `public.users` —
--
--   channex_webhook_event_resolved_by_fkey
--     FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL
--
-- `public.users` sind die BETRIEBS-Benutzer, jeder mit `tenant_id`. Das
-- Backoffice ist aber eine EIGENE Auth-Welt: seine Identität steht in
-- `platform_admins`, und `ctx.user_id` ist dort die `sub`-Claim des JWT, also
-- die `auth.users`-ID (`core/security.py` `get_current_platform_admin` filtert
-- `platform_admins.user_id = sub`). Live gemessen:
--
--   platform_admins            1
--   davon in auth.users        1
--   davon in public.users      0
--
-- Es gibt genau EINEN Backoffice-Admin, und der stand nie in `public.users`.
-- Folge: kein Backoffice-Admin konnte JEMALS quittieren, an keinem Ereignis.
--
-- WARUM NICHT EINFACH DEN FK LÖSCHEN
-- Weil die Spalte von ZWEI Pfaden geschrieben wird — beide belegt im Code:
--   * `channel_manager/ota_extras.py:812` — ein BETRIEBS-Benutzer quittiert
--     eine Airbnb-Anfrage (`ctx.user_id` = `public.users.id`).
--   * `platform_admin/ereignis_erledigen.py:106` — ein BACKOFFICE-Admin hakt
--     ab (`ctx.user_id` = `auth.users.id`, NICHT in `public.users`).
-- Ein FK auf EINE der beiden Tabellen ist damit grundsätzlich falsch: er
-- schliesst immer die andere Welt aus. Ganz ohne FK wäre die Spalte dagegen
-- ein Datenfriedhof — eine gelöschte Identität bliebe als tote UUID stehen.
--
-- DIE LÖSUNG: `auth.users` ist die gemeinsame OBERMENGE, nicht ein Kompromiss.
-- Live geprüft: `public.users.id` hat selbst einen FK auf `auth.users(id)`
-- (`users_id_fkey`, ON DELETE CASCADE), und alle 31 Zeilen in `public.users`
-- stehen in `auth.users` — 0 Ausreisser. Jede Identität BEIDER Welten ist also
-- genau dort vertreten. Der FK bleibt damit erhalten (kein Datenfriedhof) und
-- trägt trotzdem beide Schreiber.
--
-- Gegenprobe gegen die Live-DB, in `begin; … rollback;`: mit dem FK auf
-- `auth.users` schrieb der Backoffice-Admin durch UND ein Betriebs-Benutzer
-- ebenfalls. Vorher schlug der Admin fehl.
--
-- BESTEHENDE DATEN (Wurzel 1)
-- Vor der Migration live gezählt:
--   channex_webhook_event  resolved_by gefüllt: 0   (bei 4 `resolved=true`)
--   account_deletion_requests           gefüllt: 0
-- Es gibt also NICHTS zu verlieren — genau WEIL der FK das Schreiben
-- verhinderte. Die Umstellung ist trotzdem verlustfrei gebaut: `auth.users`
-- ist die Obermenge von `public.users`, jeder bisher gültige Wert bleibt
-- gültig. Deshalb wird der neue FK OHNE `not valid` angelegt — Postgres
-- prüft den Altbestand mit, und würde die Migration abbrechen statt eine
-- verwaiste Zeile stillschweigend durchzulassen (fail-closed, Wurzel 5).

-- ---------------------------------------------------------------------------
-- 1) channex_webhook_event — der gemeldete Fall.
-- ---------------------------------------------------------------------------
alter table public.channex_webhook_event
  drop constraint if exists channex_webhook_event_resolved_by_fkey;

alter table public.channex_webhook_event
  add constraint channex_webhook_event_resolved_by_fkey
  foreign key (resolved_by) references auth.users(id) on delete set null;

comment on column public.channex_webhook_event.resolved_by is
  'Wer quittiert hat — auth.users-ID. BEWUSST auf auth.users und nicht auf '
  'public.users: es schreiben zwei Auth-Welten (Betriebs-Benutzer über den '
  'Kanalmanager, Backoffice-Admin über platform_admins). Ein Backoffice-Admin '
  'steht NICHT in public.users; ein FK dorthin machte das Quittieren im '
  'Backoffice unmöglich (0429).';

-- ---------------------------------------------------------------------------
-- 2) account_deletion_requests — DERSELBE Fehler, dieselbe Ursache.
--    Auch hier schreiben beide Welten:
--      * `account_deletion/in_app.py:134` — der Antragsteller zieht selbst
--        zurück (Betriebs-Benutzer).
--      * `platform_admin/loeschantraege.py:143` — das Backoffice schliesst ab
--        (`ctx.user_id` = auth.users-ID, nicht in public.users).
--    Der Backoffice-Weg wäre an genau demselben FK gescheitert. Nicht
--    „vorsichtshalber mitgenommen", sondern derselbe belegte Defekt: das
--    Abschliessen eines Löschantrags ist eine DSGVO-Frist, kein Komfort.
-- ---------------------------------------------------------------------------
alter table public.account_deletion_requests
  drop constraint if exists account_deletion_requests_resolved_by_fkey;

alter table public.account_deletion_requests
  add constraint account_deletion_requests_resolved_by_fkey
  foreign key (resolved_by) references auth.users(id) on delete set null;

comment on column public.account_deletion_requests.resolved_by is
  'Wer den Antrag geschlossen hat — auth.users-ID. Zwei Schreiber: der '
  'Antragsteller selbst (Rücknahme) und das Backoffice (Abschluss). Siehe '
  'die Begründung an channex_webhook_event.resolved_by (0429).';

-- ---------------------------------------------------------------------------
-- 3) worker_ereignis braucht NICHTS.
--    Live geprüft: die Spalte `resolved_by` (uuid, nullable) hat dort GAR
--    KEINEN Fremdschlüssel — `worker_ereignis` trägt überhaupt keinen FK.
--    Der Worker-Monitor funktionierte deshalb schon vorher, obwohl er durch
--    exakt denselben Code läuft (`ereignis_erledigen.WORKER`). Hier wird
--    bewusst kein FK NACHGEZOGEN: das wäre eine Verschärfung ohne Befund und
--    gehört nicht in eine Fehlerbehebung.
-- ---------------------------------------------------------------------------
