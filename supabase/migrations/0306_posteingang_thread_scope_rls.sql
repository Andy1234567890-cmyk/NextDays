-- 0306 — Posteingang: der Thread-Scope gilt jetzt auch am DB-Direktpfad
--
-- DER BEFUND (Wurzel 6 + Wurzel 9, gefunden bei der Prüfung von 0305):
-- Auf `channex_booking` lag ausschliesslich die Mandanten-Policy aus 0027
-- (`tenant_id = current_tenant_id()`) plus der Schreib-Riegel aus 0224. Eine
-- ROLLEN-Prüfung gab es nicht — obwohl der Service-Layer seit jeher eine
-- durchsetzt:
--
--   inbox/service.py:181  Liste  → bei scope='assigned' nur assigned_user_id = ich
--   inbox/service.py:497  Detail → `_load_thread_scoped` re-prüft dasselbe (404)
--
-- Genau das ist der Fall, vor dem Wurzel 6 warnt: der Service-Check ist
-- WIRKUNGSLOS gegen einen Client, der mit gültigem JWT und dem öffentlichen
-- anon-Key direkt gegen PostgREST geht. Ein Mitarbeiter mit `assigned`-Scope
-- konnte per `curl /rest/v1/channex_booking?id=eq.<fremd>` jede Buchung seines
-- Mandanten lesen — inklusive `customer` (Gastname, E-Mail, Telefon, 0027) und
-- `amount_cents`. Der Rollen-Datensplit aus §4.3 war am DB-Pfad nicht
-- vorhanden.
--
-- Die Lücke ist ÄLTER als 0305 und wird hier nicht neu geschaffen, sondern
-- geschlossen. Sie fällt jetzt auf, weil 0305 `channex_booking` zum
-- Aktivitäts-Kanal des Posteingangs macht: ohne diese Policy erführe ein
-- assigned-Nutzer live, in welchen FREMDEN Threads gerade Gastkommunikation
-- läuft — ein Metadaten-Kanal, den es vorher so nicht gab.
--
-- WARUM DIE PERMISSION UND NICHT DIE ROLLE:
-- Der Scope hängt im Service an `inbox_view_all` (granular_permissions.py),
-- nicht an der Rolle — ein Mitarbeiter KANN alle Threads sehen dürfen, wenn
-- ihm die Berechtigung erteilt wurde. Eine Policy, die stattdessen auf die
-- Rolle schaut, wäre eine ZWEITE Wahrheit und würde legitime Nutzer aussperren
-- oder Unberechtigte durchlassen. Gelesen wird deshalb `users.permissions` aus
-- der DB — die Quelle der Wahrheit (Wurzel 7: nie die evtl. veraltete Rolle
-- aus dem JWT).

-- Darf der eingeloggte Nutzer ALLE Threads des Mandanten sehen?
--
-- Fail-CLOSED (Wurzel 6): ohne Nutzer, ohne Zeile, bei unbekannter Rolle → false,
-- dann greift die Assignment-Prüfung. Nur wer die Berechtigung nachweislich
-- hat, bekommt `true`. admin/co_admin haben sie über die Rollen-Defaults
-- (`effective_permissions`), tragen sie aber nicht zwingend in der Spalte —
-- deshalb stehen sie hier zusätzlich explizit.
create or replace function public.inbox_sieht_alle_threads()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.tenant_id = public.current_tenant_id()
      and (
        u.role in ('admin', 'co_admin')
        or u.permissions ? 'inbox_view_all'
      )
  )
$$;

comment on function public.inbox_sieht_alle_threads is
  'Spiegelt InboxAccess.scope (inbox/authz.py) auf DB-Ebene: true = alle '
  'Threads des Mandanten, false = nur zugewiesene. Fail-closed. Noetig, weil '
  'ein Client mit anon-Key PostgREST direkt anspricht und den Service-Check '
  'damit umgeht (Wurzel 6).';

-- SECURITY DEFINER: nur der Server darf die Funktion aufrufen können, nicht
-- der Client selbst (Wurzel 6). Die Policy unten ruft sie im Namen des
-- Definers auf — dafür braucht `authenticated` kein EXECUTE.
revoke execute on function public.inbox_sieht_alle_threads() from anon, authenticated;

-- Die eigentliche Schranke. RESTRICTIVE, damit sie ZUSÄTZLICH zur
-- Mandanten-Policy greift und nicht per ODER neben ihr steht.
--
-- `for all`, nicht `for select`: ein reines Lese-Restriktiv liesse den
-- SCHREIB-Pfad mandantenweit offen — genau der Fehler, den Wurzel 6 benennt.
-- Der Schreibpfad ist über 0224 bereits entzogen; diese Policy ist der zweite
-- Riegel, falls ein späteres Grant das aufweicht.
drop policy if exists channex_booking_thread_scope on public.channex_booking;
create policy channex_booking_thread_scope on public.channex_booking
  as restrictive
  for all
  using (
    public.inbox_sieht_alle_threads()
    or assigned_user_id = auth.uid()
  )
  with check (
    public.inbox_sieht_alle_threads()
    or assigned_user_id = auth.uid()
  );

comment on table public.channex_booking is
  'OTA-Buchungen; zugleich die Thread-Zeile des Posteingangs. Zwei Schranken: '
  'Mandant (0027) UND Thread-Scope (0306, restriktiv) — letztere spiegelt den '
  'assigned-only-Scope aus inbox/authz.py auf den DB-Direktpfad.';

-- WURZEL-6-GEGENPROBE
-- Was kann ein eingeloggter cleaner mit assigned-Scope per curl?
--   GET  /rest/v1/channex_booking?id=eq.<eigener>  → seine Zeile, wie bisher.
--   GET  /rest/v1/channex_booking?id=eq.<fremder>  → jetzt LEER (vorher: volle
--        Zeile inkl. customer/amount_cents). Auch das Realtime-Abo aus 0305
--        liefert fuer fremde Threads damit kein Event mehr.
--   POST/PATCH/DELETE                              → weiterhin zu (0224).
-- Ein admin/co_admin und jeder Nutzer mit `inbox_view_all` sieht unveraendert
-- alle Threads seines Mandanten.
