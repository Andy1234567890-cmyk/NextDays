-- 0124_tasks_description.sql — Beschreibungsfeld auf konkreten Aufgaben.
-- Das „Aufgabe erstellen"-Popup (..-Nachbau) hat ein Beschreibungsfeld;
-- task_rules hatte description bereits (0123), tasks noch nicht.

alter table public.tasks
    add column if not exists description text;
