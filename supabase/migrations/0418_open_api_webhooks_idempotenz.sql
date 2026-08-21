-- 0418_open_api_webhooks_idempotenz.sql — Fundament der öffentlichen Open API
--
-- Ergänzt den bestehenden Entwickler-Zugang (0179 api_clients) um die drei
-- Bausteine, die eine öffentliche Partner-API braucht und die im Markt
-- reihum fehlen (Recherche: docs/OPEN-API-KONKURRENZ.md):
--
--   1. api_webhooks            — Push-Ziele des Partners (Standard Webhooks)
--   2. api_events              — die Ereignisse selbst, ABRUFBAR (Nachhol-Pull)
--   3. api_webhook_deliveries  — Zustellprotokoll je Versuch
--   4. api_idempotency_keys    — Idempotency-Key-Speicher (Stripe-Modell)
--
-- Warum api_events als eigene Tabelle und nicht nur ein Job:
-- Booking.com — der größte Absender von Buchungsnachrichten der Branche —
-- verlässt sich NICHT auf Push. Dort liegt eine Queue je Provider, der Partner
-- quittiert jede Reservierung, und bis zur Quittung wird sie erneut
-- ausgeliefert; ohne Quittung geht nach 30 Minuten eine Fallback-Mail an das
-- Haus (developers.booking.com/connectivity/docs/reservations-api/
-- reservations-overview). Ein Webhook allein IST keine Zustellgarantie: der
-- Partner-Server ist irgendwann weg, und dann fehlt die Buchung still. Deshalb
-- ist jedes Ereignis hier eine Zeile, die der Partner über
-- GET /v1/events?starting_after=… nachholen kann — der Webhook ist nur die
-- schnelle Benachrichtigung, die Tabelle ist die Wahrheit.
--
-- SICHERHEIT (Wurzel 6): alle vier Tabellen sind rein serverseitig. Das
-- Webhook-Secret signiert die Nutzlast und liegt daher im Klartext — genau
-- deshalb wird das Tabellen-GRANT vollständig entzogen: ein eingeloggter
-- Nutzer mit anon-Key darf per curl /rest/v1/api_webhooks WEDER lesen NOCH
-- schreiben. api_events enthält Gastdaten (Name, Zeitraum), api_idempotency_keys
-- enthält gespeicherte Antwortkörper — beide ebenso gesperrt.

-- =========================================================================
-- 1. api_webhooks — Zustellziele
-- =========================================================================
create table if not exists public.api_webhooks (
    id              uuid primary key default gen_random_uuid(),
    tenant_id       uuid not null references public.tenants(id) on delete cascade,
    -- Der API-Client, dem dieses Ziel gehört. Ein Partner sieht und verwaltet
    -- nur seine EIGENEN Webhooks, nicht die anderer Clients desselben Betriebs
    -- (Wurzel 9: derselbe Scope im Detail wie in der Liste).
    api_client_id   uuid not null references public.api_clients(id) on delete cascade,
    -- Ziel-URL des Partners. NUR https, keine internen Netze — geprüft beim
    -- Anlegen UND erneut unmittelbar vor jedem Versand mit IP-Pinning
    -- (OWASP API7 SSRF / Wurzel 8). Die Prüfung beim Anlegen allein genügt
    -- nicht: ein Angreifer kann den DNS-Eintrag danach umbiegen (Rebinding).
    url             text not null,
    -- Signier-Secret (Standard Webhooks, HMAC-SHA256 über
    -- "{id}.{timestamp}.{payload}"). Klartext, weil damit signiert wird —
    -- die Tabelle ist deshalb hart gesperrt (siehe unten). Dem Partner wird es
    -- genau EINMAL beim Anlegen gezeigt (show-once wie das Client-Secret).
    secret          text not null,
    secret_last4    text not null,
    -- Auf welche Ereignistypen dieses Ziel hört. Leer = KEINE (fail-closed,
    -- Wurzel 5) — nicht „alle". Smoobu schickt jedem Ziel alle Events; das ist
    -- bequem und falsch, weil der Partner dann Daten empfängt, die er nicht
    -- angefragt hat.
    event_types     text[] not null default '{}',
    -- Test-Ziele bekommen ausschließlich Ereignisse von Test-Clients und
    -- umgekehrt (strikte Trennung wie Bookings test-Claim).
    is_test         boolean not null default false,
    enabled         boolean not null default true,
    -- Selbst-Abschaltung nach dauerhaftem Scheitern. Grund wird benannt, damit
    -- der Partner in der UI sieht, WARUM er nichts mehr bekommt (nie stilles
    -- Verstummen). Lodgify deaktiviert bei HTTP 410, wir zusätzlich nach einer
    -- Kette harter Fehler.
    disabled_at     timestamptz,
    disabled_reason text,
    last_success_at timestamptz,
    last_error      text,
    consecutive_failures integer not null default 0,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create index api_webhooks_client_idx on public.api_webhooks (api_client_id);
create index api_webhooks_tenant_idx on public.api_webhooks (tenant_id);
-- Auswahl der Zustellziele je Ereignis: nur aktive, nach Umgebung getrennt.
create index api_webhooks_aktiv_idx on public.api_webhooks (tenant_id, is_test)
    where enabled and disabled_at is null;

create trigger trg_api_webhooks_updated
    before update on public.api_webhooks
    for each row execute function public.set_updated_at();

-- =========================================================================
-- 2. api_events — die Ereignisse selbst (Quelle der Wahrheit, abrufbar)
-- =========================================================================
create table if not exists public.api_events (
    -- Diese ID geht als `webhook-id`-Header raus und ist Teil der Signatur.
    -- Sie ist damit auch der Replay-Schutz-Anker beim Partner.
    id           uuid primary key default gen_random_uuid(),
    tenant_id    uuid not null references public.tenants(id) on delete cascade,
    -- z. B. reservation.created, reservation.cancelled, availability.updated.
    event_type   text not null,
    -- Fachlicher Bezug, damit der Partner filtern kann, ohne die Nutzlast zu
    -- parsen (und damit die Objekt-Beschränkung eines Clients greifen kann).
    property_id  uuid references public.properties(id) on delete set null,
    object_id    text,
    -- Die Nutzlast in der Form der öffentlichen API (nicht die interne Zeile!).
    -- Eingefroren zum Zeitpunkt des Ereignisses: ein später umbenanntes
    -- internes Feld ändert ein bereits ausgeliefertes Ereignis nicht.
    payload      jsonb not null,
    is_test      boolean not null default false,
    -- WANN ES FACHLICH PASSIERTE. Getrennt von created_at, weil unsere Uhr nie
    -- der Zeitpunkt eines fremden Ereignisses ist (Wurzel 5b): eine
    -- OTA-Buchung, die wir um 10:48 einlesen, wurde vielleicht im März
    -- gebucht. Fehlt der echte Wert, bleibt hier NULL — kein Rückfall auf
    -- now() (Wurzel 4).
    occurred_at  timestamptz,
    created_at   timestamptz not null default now()
);

-- Nachhol-Pull (GET /v1/events): stabile Sortierung + Cursor. created_at ist
-- hier korrekt, weil der Cursor unsere Ausliefer-Reihenfolge abbildet, nicht
-- den fachlichen Zeitpunkt.
create index api_events_pull_idx
    on public.api_events (tenant_id, is_test, created_at desc, id desc);
create index api_events_typ_idx on public.api_events (tenant_id, event_type);
create index api_events_property_idx on public.api_events (property_id)
    where property_id is not null;

-- =========================================================================
-- 3. api_webhook_deliveries — Zustellprotokoll
-- =========================================================================
create table if not exists public.api_webhook_deliveries (
    id            uuid primary key default gen_random_uuid(),
    event_id      uuid not null references public.api_events(id) on delete cascade,
    webhook_id    uuid not null references public.api_webhooks(id) on delete cascade,
    tenant_id     uuid not null references public.tenants(id) on delete cascade,
    -- pending | delivered | failed | dropped
    status        text not null default 'pending',
    attempts      integer not null default 0,
    response_status integer,
    -- Gekürzte Antwort/Fehlermeldung des Partners — für dessen eigene
    -- Fehlersuche in der UI (Airbnb hat dafür ein „Error Dashboard").
    error         text,
    duration_ms   integer,
    next_attempt_at timestamptz,
    delivered_at  timestamptz,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

-- Ein Ereignis wird je Ziel GENAU EINMAL protokolliert. Damit ist ein doppelt
-- eingereihter Zustell-Job harmlos (Wurzel 2: real kommt alles doppelt) —
-- der UNIQUE-Index ist der Backstop, nicht die Hoffnung auf einen einzigen
-- Aufruf.
create unique index api_webhook_deliveries_uq
    on public.api_webhook_deliveries (event_id, webhook_id);
create index api_webhook_deliveries_offen_idx
    on public.api_webhook_deliveries (next_attempt_at)
    where status = 'pending';
create index api_webhook_deliveries_webhook_idx
    on public.api_webhook_deliveries (webhook_id, created_at desc);

create trigger trg_api_webhook_deliveries_updated
    before update on public.api_webhook_deliveries
    for each row execute function public.set_updated_at();

-- =========================================================================
-- 4. api_idempotency_keys — Idempotency-Key (Stripe-Modell)
-- =========================================================================
-- Der Befund der Marktrecherche: KEINER der acht geprüften Wettbewerber
-- (Guesty, Hostaway, Lodgify, Mews, Apaleo, Beds24, Smoobu, Cloudbeds)
-- dokumentiert einen Idempotency-Key. Bei einer API, über die Buchungen und
-- Stornos laufen, ist das die gefährlichste Lücke: ein Timeout beim
-- POST /v1/reservations, und der Partner weiß nicht, ob gebucht wurde —
-- sein Retry erzeugt die Doppelbuchung. Wurzel 2 verlangt genau hier den
-- Guard VOR dem Seiteneffekt.
create table if not exists public.api_idempotency_keys (
    id            uuid primary key default gen_random_uuid(),
    tenant_id     uuid not null references public.tenants(id) on delete cascade,
    api_client_id uuid not null references public.api_clients(id) on delete cascade,
    -- Der vom Partner gesendete Idempotency-Key (max. 255 wie Stripe).
    idem_key      text not null,
    method        text not null,
    path          text not null,
    -- SHA-256 über den kanonisierten Request-Körper. Gleicher Key + anderer
    -- Körper = Programmierfehler des Partners → 422, NICHT die gecachte
    -- Antwort des ersten Aufrufs (die wäre eine Falschaussage).
    fingerprint   text not null,
    -- in_progress | completed
    status        text not null default 'in_progress',
    response_status integer,
    response_body jsonb,
    created_at    timestamptz not null default now(),
    -- 24-Stunden-Fenster (Stripe/Shopify). Danach ist der Key wieder frei.
    expires_at    timestamptz not null default (now() + interval '24 hours')
);

-- DER eigentliche Schutz: derselbe Key kann pro Client nur EINMAL angelegt
-- werden. Zwei parallele Requests → einer gewinnt den Insert, der andere
-- bekommt 23505 und daraus einen 409 (wie es der IETF-Entwurf vorsieht).
-- Ein Guard im Code allein hätte zwischen Prüfen und Schreiben eine Lücke.
create unique index api_idempotency_keys_uq
    on public.api_idempotency_keys (api_client_id, idem_key);
create index api_idempotency_keys_verfall_idx
    on public.api_idempotency_keys (expires_at);

-- =========================================================================
-- Wurzel 6 — RLS + harter GRANT-Entzug für alle vier Tabellen
-- =========================================================================
-- Begründung je Tabelle:
--   api_webhooks           — enthält das Signier-Secret im Klartext
--   api_events             — enthält Gastdaten in der Nutzlast
--   api_webhook_deliveries — enthält Fremdserver-Antworten
--   api_idempotency_keys   — enthält gespeicherte Antwortkörper (Buchungsdaten)
-- Keine dieser Tabellen wird je von einem Browser gelesen: der Partner spricht
-- die Open API über sein Bearer-Token an, die Dashboard-UI über FastAPI. Es
-- gibt also keinen legitimen Direktpfad, den der Entzug kaputt macht.
alter table public.api_webhooks enable row level security;
alter table public.api_events enable row level security;
alter table public.api_webhook_deliveries enable row level security;
alter table public.api_idempotency_keys enable row level security;

create policy api_webhooks_tenant_isolation on public.api_webhooks
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

create policy api_events_tenant_isolation on public.api_events
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

create policy api_webhook_deliveries_tenant_isolation on public.api_webhook_deliveries
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

create policy api_idempotency_keys_tenant_isolation on public.api_idempotency_keys
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke select, insert, update, delete on public.api_webhooks from anon;
revoke select, insert, update, delete on public.api_webhooks from authenticated;
revoke select, insert, update, delete on public.api_events from anon;
revoke select, insert, update, delete on public.api_events from authenticated;
revoke select, insert, update, delete on public.api_webhook_deliveries from anon;
revoke select, insert, update, delete on public.api_webhook_deliveries from authenticated;
revoke select, insert, update, delete on public.api_idempotency_keys from anon;
revoke select, insert, update, delete on public.api_idempotency_keys from authenticated;

comment on table public.api_webhooks is
  'Push-Ziele der Open API je API-Client (Standard Webhooks, HMAC-SHA256). '
  'Secret im Klartext, weil damit signiert wird — Tabelle daher gegen '
  'anon/authenticated gesperrt. event_types leer = keine Zustellung.';
comment on table public.api_events is
  'Ereignisse der Open API als Quelle der Wahrheit. Der Webhook ist nur die '
  'Benachrichtigung; über GET /v1/events holt ein Partner Verpasstes nach '
  '(Booking-Queue-Prinzip). occurred_at = fachlicher Zeitpunkt (Wurzel 5b), '
  'NULL wenn unbekannt; created_at = unser Eingang.';
comment on table public.api_webhook_deliveries is
  'Zustellprotokoll je (Ereignis, Ziel). UNIQUE über beide Spalten macht eine '
  'doppelte Einreihung harmlos (Wurzel 2).';
comment on table public.api_idempotency_keys is
  'Idempotency-Key-Speicher (24 h, Stripe-Modell): Antwort des ersten Aufrufs '
  'wird gespeichert und bei Wiederholung identisch zurückgegeben. Gleicher '
  'Key + anderer Körper -> 422, parallel -> 409 über den UNIQUE-Index.';
