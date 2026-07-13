-- 0125_task_rule_items_description.sql — Beschreibungsfeld je Vorlagen-Artikel.
-- Der Aufgabenvorlagen-Editor (Lodgify) hat pro Artikel Titel + Beschreibung.

alter table public.task_rule_items
    add column if not exists description text;
