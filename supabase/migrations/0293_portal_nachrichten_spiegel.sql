-- 0293 — Portal-Nachrichten lokal spiegeln (`portal_messages`)
--
-- DER ANLASS (06.08.2026): Zwischen 10:29 und 10:40 wies der Webhook-Endpunkt
-- eingehende Gastnachrichten mit HTTP 503 ab (Redis kurzzeitig weg). Diese
-- Nachrichten sind damit ENDGÜLTIG verloren gewesen — es gab keinen Nachholweg:
--
--   * `live_feed_sync.py` behandelt Nachrichten NICHT (das Wort „message" kommt
--     dort nicht vor); der 5-Minuten-Backstop deckt sie also nicht ab.
--   * Der Posteingang holt den Verlauf bei JEDEM Öffnen live beim Aggregator
--     (`inbox.service._portal_nachrichten`) und speichert nichts.
--   * Folge: `guest_messages` ist leer (0 Zeilen), obwohl bei den Portalen
--     vollständige Verläufe liegen — live geprüft: ein Thread mit 10, ein
--     anderer mit 14 Nachrichten.
--
-- Der Webhook war damit die EINZIGE Quelle. Fällt er aus, ist die Nachricht weg,
-- und niemand merkt es. Diese Tabelle macht ihn zum schnellen, nicht zum
-- einzigen Weg: ein regelmäßiger Abgleich zieht nach, was verpasst wurde.
--
-- WARUM NICHT `guest_messages`: Die Tabelle gehört dem myBestDays-Marktplatz
-- (`guest_message_threads` → `portal_guest_id`, eigene Auth-Welt). OTA-
-- Nachrichten hängen an einer Portal-Buchung, nicht an einem Marktplatz-Gast.
-- Beides in eine Tabelle zu zwingen hieße, zwei Domänen zu vermischen — hier
-- eine eigene, klar benannte.
--
-- IDENTITÄT ÜBER DIE PORTAL-NACHRICHTEN-ID: `ota_message_id` (im Webhook-Payload
-- vorhanden) bzw. die Nachrichten-ID des Aggregators. Der UNIQUE-Index ist der
-- Backstop gegen Doppelanlage, wenn Webhook und Abgleich dieselbe Nachricht
-- gleichzeitig bringen (Wurzel 2 — real kommt alles doppelt).

create table if not exists public.portal_messages (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants (id) on delete cascade,
  -- Thread beim Aggregator; die Klammer zur Buchung.
  thread_ref    text not null,
  -- Buchung, sofern zuzuordnen. Nullable: manche Anfragen entstehen VOR der
  -- Buchung (Airbnb-Inquiry) — die Nachricht ist trotzdem echt und darf nicht
  -- verworfen werden, nur weil die Buchung fehlt.
  booking_ref   text,
  -- Die ID der Nachricht BEIM PORTAL. Quelle der Idempotenz.
  message_ref   text not null,
  -- 'guest' oder 'property'. Kein Enum: die Portale liefern eigene Rollen-Namen
  -- (Channex „property", Airbnb „HOST"), die Normalisierung gehört in den Code,
  -- nicht in einen DB-Typ, der bei jedem neuen Portal migriert werden müsste.
  sender        text not null,
  body          text not null,
  -- WANN die Nachricht beim Portal geschrieben wurde — nie unsere Uhr
  -- (Wurzel 5b, 0291/0292). NOT NULL: eine Nachricht ohne Zeitpunkt wäre im
  -- Verlauf nicht einsortierbar.
  sent_at       timestamptz not null,
  -- Rohpayload für spätere Felder (Anhänge, Übersetzungen), ohne Migration.
  raw           jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

-- Idempotenz: dieselbe Portal-Nachricht genau einmal (Wurzel 2).
create unique index if not exists portal_messages_ref_uidx
  on public.portal_messages (tenant_id, message_ref);

-- Der Verlauf eines Threads, chronologisch — die Hauptabfrage des Posteingangs.
create index if not exists portal_messages_thread_idx
  on public.portal_messages (tenant_id, thread_ref, sent_at);

-- Für den Abgleich: „was ist das Neueste, das ich zu dieser Buchung habe?"
create index if not exists portal_messages_booking_idx
  on public.portal_messages (tenant_id, booking_ref)
  where booking_ref is not null;

alter table public.portal_messages enable row level security;

-- Mandanten-Policy für den Lesepfad der App.
drop policy if exists portal_messages_tenant on public.portal_messages;
create policy portal_messages_tenant on public.portal_messages
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- Wurzel 6: RLS + Tenant-Policy allein reicht NICHT. Gastnachrichten sind
-- personenbezogener Inhalt — geschrieben wird ausschließlich serverseitig
-- (Webhook, Abgleich), nie vom Client. Ohne diesen Entzug könnte ein
-- eingeloggter cleaner per anon-Key direkt gegen /rest/v1/portal_messages
-- schreiben und fremde Verläufe fälschen.
revoke insert, update, delete on public.portal_messages from anon, authenticated;

comment on table public.portal_messages is
  'Lokaler Spiegel der Gastnachrichten von den Buchungsportalen (0293). Der '
  'Webhook ist der schnelle Weg, NICHT der einzige: ein Ausfall (live 503 am '
  '06.08.2026) verlor Nachrichten unwiederbringlich, weil der Posteingang sie '
  'nur live beim Aggregator las und nichts speicherte.';

comment on column public.portal_messages.sent_at is
  'Zeitpunkt BEIM PORTAL, nie unsere Schreibzeit (Wurzel 5b).';
