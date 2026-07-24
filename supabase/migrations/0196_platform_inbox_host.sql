-- Plattform-Posteingang (Betrieb-Seite) — Airbnb-Messages-Nachbau für die EIGENE
-- Plattform (/plattform), NICHT der Channel-Manager/OTA-inbox (channex_booking).
-- Grundlage sind die bestehenden guest_message_threads + guest_messages
-- (portal_guest ↔ Betrieb). Hier kommen zwei Dinge dazu, die die Betrieb-Sicht
-- braucht und die es bisher nur gast-seitig / gar nicht gab:
--
--   1. Host-Thread-Flags: gelesen / archiviert (für Filter „Ungelesen" +
--      „Archiviert" aus der Airbnb-UI). Bewusst PRO THREAD auf Betriebsseite —
--      der Gast hat seine eigene read-Logik über guest_messages.read_at.
--   2. Quick Replies: Airbnbs „Quick replies" nutzen die BESTEHENDE, schlanke
--      Tabelle message_template (title/body, tenant-scoped, aus 0037). KEINE
--      dritte Template-Tabelle — sie bekommt nur ein property_ids-Feld für die
--      Airbnb-„1 listing"-Zuordnung. (message_templates Plural/body_i18n gehört
--      zum älteren OTA-message_triggers-System und bleibt unberührt.)

-- --- 1) Host-Flags auf dem Thread ------------------------------------------
alter table public.guest_message_threads
    add column if not exists host_archived boolean not null default false,
    -- Zeitpunkt, bis zu dem der Betrieb den Thread gelesen hat. Eine Gast-
    -- Nachricht mit created_at > host_read_at gilt als ungelesen (Betrieb-Sicht).
    add column if not exists host_read_at timestamptz;

comment on column public.guest_message_threads.host_archived is
    'Betrieb hat diesen Plattform-Thread archiviert (Airbnb „Archived").';
comment on column public.guest_message_threads.host_read_at is
    'Bis hierhin hat der Betrieb gelesen; spätere Gast-Nachrichten = ungelesen.';

-- --- 2) Quick Replies: bestehende message_template um property_ids erweitern --
-- Airbnb „1 listing · …": eine Vorlage kann auf bestimmte Objekte beschränkt
-- sein. Leeres Array = für alle Objekte gültig.
alter table public.message_template
    add column if not exists property_ids uuid[] not null default '{}';

comment on column public.message_template.property_ids is
    'Airbnb „Quick replies"-Objektbindung: leer = alle Objekte, sonst nur diese.';

-- Härtung (Wurzel 6): message_template hat pauschale anon/authenticated-Grants
-- inkl. SELECT — der SCHREIB-Pfad war tenant-weit offen (nur PERMISSIVE tenant-
-- Policy, kein restriktiver Schreib-Guard). Da wir die Tabelle jetzt aktiv für
-- Quick Replies nutzen: restriktive Policies je Schreib-Kommando (nur admin/
-- co_admin verwalten Vorlagen, Airbnb „Manage quick replies"). Lesen bleibt
-- tenant-weit (alle Mitarbeiter sehen die Vorlagen im Chat). service_role umgeht
-- RLS (der Server schreibt darüber). current_db_role() aus 0194 (Rolle aus DB).
create policy message_template_write_insert on public.message_template
    as restrictive for insert
    with check (public.current_db_role() in ('admin', 'co_admin'));

create policy message_template_write_update on public.message_template
    as restrictive for update
    using (public.current_db_role() in ('admin', 'co_admin'))
    with check (public.current_db_role() in ('admin', 'co_admin'));

create policy message_template_write_delete on public.message_template
    as restrictive for delete
    using (public.current_db_role() in ('admin', 'co_admin'));
