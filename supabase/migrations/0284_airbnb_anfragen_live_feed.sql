-- Airbnb-Anfragen auflösbar machen (LiveFeedEvents).
--
-- Airbnb schickt drei handlungspflichtige Anfragearten, die KEINE Buchung sind
-- (reservation_request, inquiry, alteration_request). Beantwortet werden sie über
-- `POST /api/v1/live_feed/{live_feed_event}/resolve` — dafür braucht man die
-- Channex-EREIGNIS-ID. Die hatten wir nirgends: `channex_webhook_event` hielt nur
-- unsere eigene uuid, den Ereignisnamen und den Payload-Blob. Ohne die Ereignis-ID
-- konnte eine Anfrage nur lokal als „erledigt" markiert werden, während bei Airbnb
-- nach ~24 h der Auto-Decline zuschlug.
--
-- Feldname aus Airbnbs Dokument („LiveFeedEvents HTTP API"): das Ereignis trägt
-- `id` auf der Attribut-Ebene, `type: "live_feed_event"`.

alter table public.channex_webhook_event
  add column if not exists live_feed_event_id text,
  add column if not exists resolution jsonb,
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by uuid references public.users(id) on delete set null;

comment on column public.channex_webhook_event.live_feed_event_id is
  'Channex-LiveFeedEvent-ID. Pflicht, um die Anfrage bei Airbnb per '
  'POST live_feed/{id}/resolve zu beantworten.';
comment on column public.channex_webhook_event.resolution is
  'Die an Airbnb GESENDETE resolution (Nachweis, was der Betrieb entschieden hat).';

-- Ein Ereignis darf nur EINMAL aufgelöst werden. Der Doppelklick/Retry-Fall ist
-- real (Wurzel 2): zweimal „annehmen" wäre bei Airbnb ein Fehler, und zwei
-- widersprüchliche Entscheidungen auf dasselbe Ereignis dürfen gar nicht
-- entstehen. Der UNIQUE-Index ist der Backstop hinter dem Status-Guard im Code.
create unique index if not exists channex_webhook_event_live_feed_uniq
  on public.channex_webhook_event (tenant_id, live_feed_event_id)
  where live_feed_event_id is not null;

-- Offene handlungspflichtige Anfragen schnell finden (Ereignisliste im UI).
create index if not exists channex_webhook_event_action_offen_idx
  on public.channex_webhook_event (tenant_id, created_at desc)
  where severity = 'action' and resolved = false;

-- Wurzel 6: die Tabelle ist bereits gesperrt (restriktive Write-Policy +
-- Rollen-Ausschluss beim Lesen, 0132). Die neuen Spalten erben das, weil das
-- Tabellen-GRANT die Grenze zieht — hier ist NICHTS zusätzlich zu gewähren.
-- Gegenprobe (anon-Key-curl gegen /rest/v1/channex_webhook_event): lesen nur
-- als admin/co_admin desselben Tenants, schreiben ausschließlich service_role.
revoke insert, update, delete on public.channex_webhook_event from anon, authenticated;
