-- 0711 — Nachtrag zu 0710: `dp_day_modes` war übersehen.
--
-- Dieselbe Lücke wie bei den drei anderen `dp_*`-Tabellen (Wurzel 6): SELECT
-- für `anon` UND `authenticated`, dazu nur eine mandantenweite Policy
-- (`dp_day_modes_via_property`, permissiv, `for all`). Die Tabelle trägt
-- `adjust_pct` — die prozentuale Preisanpassung JE TAG. Ein Eigentümer mit
-- einem Haus konnte damit die Tagespreisstrategie ALLER Objekte des Betriebs
-- lesen, `anon` die des ganzen Mandanten, sobald eine Policy sie durchliess.
--
-- Gefunden beim Nachmessen NACH dem Einspielen von 0710: dort stand die Liste
-- der drei bekannten `dp_*`-Tabellen, nicht das Muster. Die Prüffrage aus
-- CLAUDE.md lautet „was kann ein eingeloggter cleaner per curl lesen" — sie
-- ist an einer Aufzählung nicht zu beantworten, nur an der Tabelle selbst.

begin;

revoke select on public.dp_day_modes from anon;

drop policy if exists dp_day_modes_owner_scope on public.dp_day_modes;
drop policy if exists dp_day_modes_staff_scope on public.dp_day_modes;

create policy dp_day_modes_owner_scope on public.dp_day_modes
  as restrictive for select to authenticated
  using (public.owner_can_see_property(property_id));
create policy dp_day_modes_staff_scope on public.dp_day_modes
  as restrictive for select to authenticated
  using (public.staff_can_see_property(property_id));

commit;
