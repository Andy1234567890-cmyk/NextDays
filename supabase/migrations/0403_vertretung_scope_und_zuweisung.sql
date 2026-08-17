-- Vertretungsanfragen: Rollen-Scope im Direktpfad schließen (Wurzel 6).
--
-- Ausgangslage: `task_substitutions` war die EINZIGE Tabelle der Aufgaben-
-- Familie mit `select`-Grant für `authenticated`, die keine restriktive
-- Rollen-Policy trug. `tasks`, `task_rule_assignments` und
-- `staff_property_assignments` haben ihre seit 0136 — hier fehlte sie, weil
-- die Tabelle kein eigenes `property_id` hat und das Muster von 0136 sich
-- deshalb nicht kopieren ließ.
--
-- ACHTUNG: Diese Migration schließt nur die MITARBEITER-Achse. Die Familie
-- trägt zwei restriktive Achsen — `*_staff_scope` (0136) und `*_owner_scope`
-- (0059). Die Eigentümer-Achse holt 0404 nach.
--
-- Folge ohne diese Migration: ein eingeloggter cleaner mit dem öffentlichen
-- anon-Key liest per `curl /rest/v1/task_substitutions` JEDE Vertretungs-
-- anfrage des ganzen Mandanten — auch zu Aufgaben an Objekten, die ihm nie
-- freigegeben wurden. Er erfährt damit, wer wann an welchem Haus nicht
-- konnte. Der FastAPI-Layer hilft dagegen nichts, er wird umgangen.
--
-- Aktuell ist die Tabelle leer (0 Zeilen, alle Mandanten). Genau deshalb
-- jetzt: die Lücke schließt sich hier folgenlos, sobald das Feature Daten
-- bekommt, wäre es ein Leak mit Historie.

-- Der Scope läuft über die AUFGABE, an der die Anfrage hängt. Eigene Funktion
-- statt eines EXISTS direkt in der Policy: `tasks` trägt selbst RLS, ein
-- Unterselect von dort auf sie zurück löste die Policies rekursiv aus.
-- security definer + leerer search_path + schema-qualifiziert (Wurzel 6).
create or replace function public.staff_can_see_task(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    case
      when public.current_user_role() is null
        or public.current_user_role() not in ('staff', 'cleaner')
        then true
      else exists (
        select 1
        from public.tasks t
        where t.id = p_task_id
          and t.tenant_id = public.current_tenant_id()
          and (
            -- Pool-Aufgabe ohne Objektbezug: für jeden Mitarbeiter sichtbar,
            -- wie im Service-Filter (`list_own_tasks`: `t.property_id is None
            -- or …`). Zentrale Aufgaben (Lager, Büro) hängen an keinem Objekt
            -- und dürfen deshalb an keiner Objekt-Freigabe scheitern.
            --
            -- Vorsicht bei der Verallgemeinerung: `tasks_staff_scope` (0136)
            -- macht es ANDERS. Dort steht blank
            -- `staff_can_see_property(property_id)`, und bei NULL wird daraus
            -- `a.property_id = NULL` → NULL → false. Ein Mitarbeiter sieht
            -- seine Pool-Aufgabe also über die API, aber nicht im
            -- Direktpfad/Realtime — das Abo auf `tasks` liefert für sie nie
            -- ein Event. Kein Loch (zu streng, nicht zu locker), aber eine
            -- Divergenz, die hier bewusst NICHT nachgebaut wird: eine
            -- Vertretungsanfrage zu einer Pool-Aufgabe muss der Kollege sehen
            -- können, der einspringen soll.
            t.property_id is null
            or exists (
              select 1
              from public.staff_property_assignments a
              where a.property_id = t.property_id
                and a.user_id = auth.uid()
                and a.tenant_id = public.current_tenant_id()
            )
          )
      )
    end
$$;

alter function public.staff_can_see_task(uuid) set search_path = '';

-- Kein `revoke execute` hier — er wäre wirkungslos und damit eine Lüge im
-- Code. Zwei Gründe, beide live nachgeprüft (17.08.2026):
--   1. Postgres vergibt `execute` bei `create function` automatisch an PUBLIC;
--      ein `revoke ... from anon, authenticated` lässt diese Erbschaft stehen,
--      `has_function_privilege('authenticated', …)` bleibt `true`.
--   2. Eigentümer aller Policy-Helfer ist `supabase_admin`, der Migrations-
--      Runner läuft als `postgres` — sein `revoke` quittiert Postgres mit
--      „no privileges could be revoked".
-- Der Aufruf ist auch nicht schutzbedürftig: ohne gültiges JWT ist
-- `current_user_role()` NULL, die Funktion fällt in den Nicht-Mitarbeiter-Ast
-- und liefert pauschal `true`, ohne die Aufgabe je zu lesen. Sie ist ein
-- Policy-Prädikat, kein Datenzugang — genau wie die Bestandshelfer
-- `staff_can_see_property`/`owner_can_see_property` (0136), die seit jeher
-- PUBLIC-ausführbar sind. Den Zugriff regelt die Policy darunter.

drop policy if exists task_substitutions_staff_scope on public.task_substitutions;
create policy task_substitutions_staff_scope
  on public.task_substitutions
  as restrictive
  for select
  using (public.staff_can_see_task(task_id));

comment on function public.staff_can_see_task(uuid) is
  'Darf die aktuelle Rolle die Aufgabe sehen? Nicht-Mitarbeiter immer true, '
  'staff/cleaner nur bei Objekt-Freigabe oder Pool-Aufgabe. Fail-closed.';
