-- Vertretungsanfragen: auch die EIGENTÜMER-Achse schließen (Wurzel 6).
--
-- 0403 hat für `task_substitutions` die Staff-Achse nachgezogen und dabei
-- übersehen, dass die Aufgaben-Familie ZWEI restriktive Achsen trägt:
-- `*_staff_scope` aus 0136 und `*_owner_scope` aus 0059. `tasks` hat beide
-- (live geprüft: `tasks_owner_scope` + `tasks_staff_scope`),
-- `task_substitutions` hatte nach 0403 nur die eine.
--
-- Die Lücke ist real, nicht theoretisch: `staff_can_see_task` gibt für
-- `role='owner'` über den Guard `not in ('staff','cleaner')` pauschal `true`
-- zurück, und `select` für `authenticated` ist auf der Tabelle nie entzogen
-- worden (0224/0337 entziehen nur insert/update/delete). Ein Eigentümer mit
-- gültigem JWT + anon-Key liest per `curl /rest/v1/task_substitutions` damit
-- ALLE Vertretungsanfragen des Mandanten — auch zu Aufgaben an Objekten
-- anderer Eigentümer. Er erfährt, wer wann an welchem fremden Haus nicht
-- konnte.
--
-- Wieder folgenlos nachholbar, weil die Tabelle weiterhin 0 Zeilen hat.

create or replace function public.owner_can_see_task(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    case
      when public.current_user_role() is distinct from 'owner' then true
      else exists (
        select 1
        from public.tasks t
        where t.id = p_task_id
          and t.tenant_id = public.current_tenant_id()
          -- Pool-Aufgaben ohne Objektbezug gehören dem Betrieb, nicht einem
          -- Eigentümer: für ihn nicht sichtbar. Anders als bei den
          -- Mitarbeitern, die zentrale Aufgaben (Lager/Büro) sehr wohl
          -- erledigen — deshalb hier KEIN `t.property_id is null`-Ast.
          and t.property_id is not null
          and exists (
            select 1
            from public.owner_property_assignments a
            where a.property_id = t.property_id
              and a.user_id = auth.uid()
              and a.tenant_id = public.current_tenant_id()
          )
      )
    end
$$;

alter function public.owner_can_see_task(uuid) set search_path = '';

drop policy if exists task_substitutions_owner_scope on public.task_substitutions;
create policy task_substitutions_owner_scope
  on public.task_substitutions
  as restrictive
  for select
  using (public.owner_can_see_task(task_id));

comment on function public.owner_can_see_task(uuid) is
  'Darf die aktuelle Rolle die Aufgabe sehen? Nicht-Eigentümer immer true, '
  'owner nur bei eigenem Objekt. Pool-Aufgaben sind für ihn nie sichtbar.';
