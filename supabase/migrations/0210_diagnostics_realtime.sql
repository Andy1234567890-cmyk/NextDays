-- Realtime für die Diagnose-Ereignisse (Ergänzung zu 0206/0208).
--
-- BEFUND: support_diagnostics stand auf deny-all und war weder in der
-- Realtime-Publication noch hatte es Grants. Der Support musste die Seite von
-- Hand neu laden, um ein Ereignis zu sehen — und weil die Ansicht rein
-- serverseitig rendert, tat sie das nie von selbst. Aus Sicht des Supports
-- wirkte die Diagnose schlicht tot.
--
-- LÖSUNG und ihre Grenzen — das ist die sensibelste Tabelle des Slices, weil
-- sie den Bedienablauf eines Kunden enthält:
--
--   • SELECT NUR für aktive Backoffice-Nutzer (is_platform_admin() aus 0206).
--     Kein anon, kein normaler authenticated-Nutzer.
--   • ZUSÄTZLICH muss für den betroffenen Kunden gerade eine Freigabe LAUFEN.
--     Diese Bedingung steht bewusst in der POLICY, nicht nur im Service: Über
--     den DB-Direktpfad (anon-Key + JWT) wird der Service umgangen, und ohne
--     sie könnte ein Backoffice-Nutzer den kompletten Verlauf aller Kunden
--     lesen — auch ohne oder nach Ablauf einer Einwilligung (Wurzel 6).
--   • INSERT/UPDATE/DELETE bleiben vollständig gesperrt. Ereignisse schreibt
--     ausschließlich der Server (service_role) über /diagnostics/events, wo
--     die Freigabe-Prüfung für die einwilligungspflichtigen Arten greift.
--
-- Der Rückblick von _RUECKBLICK_STUNDEN bleibt eine Regel des Services. Die
-- Policy ist bewusst etwas weiter (ganzes Konto, solange Freigabe läuft) — sie
-- ist der Sicherheits-Backstop gegen den Direktpfad, nicht die Feinsteuerung
-- der Ansicht.

-- --- Helper: läuft für dieses Konto gerade eine Freigabe? -------------------
-- SECURITY DEFINER, weil support_debug_sessions für Backoffice-Nutzer nicht
-- lesbar ist (dort steht nur eine self-read-Policy für den Kunden selbst).
-- Gibt nur einen Boolean zurück, nie Daten. Fail-closed: ohne Identität oder
-- ohne laufende Freigabe false.
create or replace function public.diagnostics_freigabe_laeuft(
    p_user_id uuid,
    p_guest_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.support_debug_sessions s
        where s.ended_at is null
          and s.expires_at > now()
          and (
              (p_user_id is not null and s.user_id = p_user_id)
              or (p_guest_id is not null and s.guest_id = p_guest_id)
          )
    )
$$;

comment on function public.diagnostics_freigabe_laeuft(uuid, uuid) is
    'True, wenn für dieses Konto gerade eine Diagnose-Freigabe aktiv ist. '
    'SECURITY DEFINER, weil support_debug_sessions für Backoffice-Nutzer '
    'gesperrt ist. Backstop gegen den DB-Direktpfad. Fail-closed.';

revoke execute on function public.diagnostics_freigabe_laeuft(uuid, uuid)
    from anon, authenticated;

-- --- Lesezugriff: nur Backoffice, nur bei laufender Freigabe ----------------
-- Die deny-all-Policy aus 0208 fällt weg; an ihre Stelle tritt eine gezielte
-- SELECT-Policy. Schreiben bleibt ohne Policy und ohne Grant gesperrt.
drop policy if exists support_diagnostics_deny_all on public.support_diagnostics;

create policy support_diagnostics_backoffice_read
    on public.support_diagnostics
    for select
    using (
        public.is_platform_admin()
        and public.diagnostics_freigabe_laeuft(user_id, guest_id)
    );

-- NUR select. Ohne insert/update/delete bleibt der Schreibpfad dem Server
-- vorbehalten (Wurzel 6: erst das Tabellen-GRANT klein halten).
grant select on public.support_diagnostics to authenticated;

-- --- Realtime ---------------------------------------------------------------
-- Ohne Publication liefert das Abo keine Events, egal wie die Policies stehen.
alter publication supabase_realtime add table public.support_diagnostics;
