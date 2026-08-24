-- 0428_channex_ereignis_eine_zeile.sql
-- Ein Channex-Ereignis = EINE Zeile in channex_webhook_event (Wurzel 2).
--
-- DER GEMESSENE BEFUND (Staging-DB, 24.08.2026)
-- Jedes Ereignis lag ZWEIMAL in der Tabelle, in zwei verschiedenen
-- Nutzlast-FORMEN, Minuten auseinander:
--
--   event                 zeilen  verschachtelt  flach   mit live_feed_event_id
--   review                   338            159     179                    179
--   booking_new              213            108     105                    105
--   activate_channel          41             41       0                      0
--   booking_cancellation      16              8       8                      8
--   booking_unmapped_rate     10              5       5                      5
--   sync_error                 6              3       3                      3
--   booking_modification       4              2       2                      2
--   inquiry                    2              1       1                      1
--   alteration_request         2              1       1                      1
--
-- Der Betrieb sah jeden Fehler und jede Buchung doppelt in seiner
-- Ereignis-Ansicht und musste beides einzeln quittieren.
--
-- WARUM: es schreiben ZWEI Pfade.
--   * `channels._persist_webhook_event` (Webhook) speicherte den kompletten
--     Channex-UMSCHLAG `{event, payload:{…}, user_id, timestamp, property_id}`
--     als `payload` — und liess die SPALTE `live_feed_event_id` leer, weil die
--     Ereignis-ID im Umschlag unter `payload.live_feed_event_id` steckte.
--   * `live_feed_sync._journal_ereignis_spiegeln` (Journal-Tick) speichert nur
--     den INHALT flach und setzt die Spalte.
-- Der UNIQUE-Index `channex_webhook_event_live_feed_uniq` (0284) liest die
-- SPALTE. Die Webhook-Zeile liess sie leer, fiel damit aus dem partiellen Index
-- (`where live_feed_event_id is not null`) und kollidierte nie. Live: 496 Zeilen
-- mit gesetzter Spalte, 284 mit der ID NUR im Payload, 53 ohne jede ID.
--
-- Der Code-Fix (`channels._webhook_inhalt`) packt den Umschlag jetzt beim
-- SCHREIBEN aus und zieht die Ereignis-ID in die Spalte. Diese Migration ist der
-- Backstop dahinter und raeumt den Altbestand auf.

-- ---------------------------------------------------------------------------
-- 0) DEN INDEX AUS 0284 ZUERST FALLEN LASSEN.
--    Nicht kosmetisch, sondern zwingend — im Trockenlauf gegen die Live-Daten
--    (24.08.2026, `begin … rollback`) scheiterte genau daran die erste Fassung
--    dieser Migration:
--      ERROR: duplicate key value violates unique constraint
--             "channex_webhook_event_live_feed_uniq"
--    Der Index besteht schon und greift, SOBALD Schritt 1 die Spalte fuellt.
--    Das Nachziehen der ID ist damit selbst die kollidierende Anweisung — vor
--    dem Zusammenfuehren, das die Kollision aufloesen soll. Reihenfolge also:
--    Index weg → Spalte fuellen → Doppel mergen → Index neu.
-- ---------------------------------------------------------------------------
drop index if exists public.channex_webhook_event_live_feed_uniq;

-- ---------------------------------------------------------------------------
-- 1) Altbestand: die Ereignis-ID aus dem Payload in die SPALTE nachziehen.
--    Erst danach greift der Index auf die Webhook-Zeilen ueberhaupt.
--    Gemessen: 284 Zeilen tragen sie nur im Payload.
-- ---------------------------------------------------------------------------
update public.channex_webhook_event
   set live_feed_event_id = nullif(trim(coalesce(
         payload -> 'payload' ->> 'live_feed_event_id',
         payload ->> 'live_feed_event_id'
       )), '')
 where live_feed_event_id is null
   and nullif(trim(coalesce(
         payload -> 'payload' ->> 'live_feed_event_id',
         payload ->> 'live_feed_event_id'
       )), '') is not null;

-- ---------------------------------------------------------------------------
-- 2) Altbestand: die verschachtelte Form auspacken, damit nur EINE Form in der
--    Spalte liegt. Erkannt wird der Umschlag daran, dass er BEIDES traegt: ein
--    `event` auf oberster Ebene UND ein Objekt unter `payload`. Ein flacher
--    Inhalt hat kein `event` (das steht in der eigenen Spalte).
--    Bewusst KEIN Wegwerfen von Umschlag-Feldern, die es nicht als Spalte gibt:
--    `user_id`/`timestamp` sind Channex' eigene Verarbeitungsdaten, nie die
--    Wahrheit ueber ein Fremdereignis (Wurzel 5b) — sie werden nicht gebraucht.
-- ---------------------------------------------------------------------------
update public.channex_webhook_event
   set payload = payload -> 'payload'
 where payload ? 'event'
   and jsonb_typeof(payload -> 'payload') = 'object';

-- ---------------------------------------------------------------------------
-- 3) Doppel zusammenfuehren, BEVOR der UNIQUE-Index angelegt wird — auf
--    bestehenden Doppeln liesse er sich nicht erzeugen.
--    Gemessen: 284 Gruppen mit je 2 Zeilen (568 Zeilen), davon bleiben 284
--    stehen und 284 werden entfernt. Gruppen mit widersprechendem
--    `resolved`-Stand: 0 (zum Messzeitpunkt) — der Merge unten behandelt sie
--    trotzdem, weil er zwischen Messung und Einspielen entstehen kann.
--
--    BEHALTEN WIRD DIE AELTERE ZEILE (Wurzel 5b): ihr `created_at` ist der
--    echte erste Eingang bei uns. Die juengere Zeile ist derselbe Vorgang auf
--    dem zweiten Weg, ihr Zeitstempel waere eine Falschaussage.
--
--    ABER: ein bereits gesetzter Quittungs-/Auflösungsstand darf nicht
--    verloren gehen (Wurzel 1). Quittiert haben kann der Betrieb JEDE der
--    beiden Zeilen — in der Ereignisliste sahen sie gleich aus. Der Stand wird
--    deshalb auf die Gewinnerzeile hochgezogen, bevor die Verliererin faellt.
-- ---------------------------------------------------------------------------
with paare as (
    select id,
           tenant_id,
           live_feed_event_id,
           resolved, resolution, resolved_at, resolved_by,
           row_number() over (
               partition by tenant_id, live_feed_event_id
               order by created_at asc, id asc
           ) as rang
      from public.channex_webhook_event
     where live_feed_event_id is not null
),
gewinner as (
    select id, tenant_id, live_feed_event_id from paare where rang = 1
),
-- Der Quittungsstand aus der GESAMTEN Gruppe: die erste Zeile (nach Zeit), die
-- ueberhaupt einen traegt. Nicht blind die juengere — quittiert sein kann jede.
stand as (
    select distinct on (p.tenant_id, p.live_feed_event_id)
           p.tenant_id, p.live_feed_event_id,
           p.resolution, p.resolved_at, p.resolved_by
      from paare p
     where p.resolved is true
     order by p.tenant_id, p.live_feed_event_id, p.rang asc
)
update public.channex_webhook_event e
   set resolved    = true,
       -- coalesce: einen schon auf der Gewinnerzeile stehenden Nachweis nicht
       -- durch ein NULL der anderen Zeile ersetzen.
       resolution  = coalesce(e.resolution, s.resolution),
       resolved_at = coalesce(e.resolved_at, s.resolved_at),
       resolved_by = coalesce(e.resolved_by, s.resolved_by)
  from gewinner g
  join stand s
    on s.tenant_id = g.tenant_id
   and s.live_feed_event_id = g.live_feed_event_id
 where e.id = g.id
   and e.resolved is not true;

-- Jetzt die Verlierer entfernen. Gescopt auf die konkreten ids — nie ein
-- `delete` ohne `where` (Live-DB-Regel).
with paare as (
    select id,
           row_number() over (
               partition by tenant_id, live_feed_event_id
               order by created_at asc, id asc
           ) as rang
      from public.channex_webhook_event
     where live_feed_event_id is not null
)
delete from public.channex_webhook_event
 where id in (select id from paare where rang > 1);

-- ---------------------------------------------------------------------------
-- 4) Der Backstop (Wurzel 2). Der Index aus 0284 existiert bereits mit exakt
--    diesem Praedikat — er ist ab jetzt wirksam, weil die Spalte auf BEIDEN
--    Wegen gefuellt wird. Hier nur idempotent sicherstellen, dass er steht.
--
--    PARTIELL (`where live_feed_event_id is not null`) ist Pflicht: 53 Zeilen
--    tragen gar keine Ereignis-ID (`activate_channel`, `disconnect_listing`,
--    `deactivate_channel` — Kanal-Statuswechsel kommen nur per Webhook, nie
--    ueber das Journal, also gibt es dort auch kein Doppel). Ein voller UNIQUE
--    wuerde sie alle gegeneinander kollidieren lassen.
--
--    WARUM NICHT `booking_id`: naheliegend, aber falsch. Gemessen tragen 39
--    (tenant, event, booking_id)-Gruppen MEHRERE verschiedene Ereignis-IDs —
--    eine Buchung erzeugt legitim mehrere Ereignisse. Ein UNIQUE darauf wuerde
--    echte Ereignisse verschlucken. `live_feed_event_id` ist die einzige
--    Identitaet, die beide Wege kennen.
--
--    Auf ein partielles Index-Ziel kann PostgREST NICHT per
--    `on_conflict=` upserten (42P10, siehe `jobs/queue.enqueue`) — der
--    Schreibpfad behandelt den Konflikt deshalb im Code: vorhandene Zeile
--    erkennen und stehen lassen, 23505 als „war schon da" werten.
-- ---------------------------------------------------------------------------
create unique index if not exists channex_webhook_event_live_feed_uniq
    on public.channex_webhook_event (tenant_id, live_feed_event_id)
    where live_feed_event_id is not null;

comment on column public.channex_webhook_event.payload is
  'Der INHALT des Channex-Ereignisses, flach — NICHT der Umschlag. Die '
  'Umschlag-Felder haben eigene Spalten (event, property_id, created_at). '
  'Beide Schreibwege (Webhook + Journal-Tick) legen dieselbe Form ab (0428).';

-- ---------------------------------------------------------------------------
-- 5) Wurzel 6 — unveraendert gueltig, hier nur zur Gegenprobe festgehalten:
--    die Tabelle ist gesperrt (0133 Rollen-Ausschluss beim Lesen, 0284/0224
--    Schreibentzug). Diese Migration aendert daran nichts und braucht es nicht:
--    sie fuegt keine Spalte hinzu.
--    Gegenprobe (anon-Key-curl /rest/v1/channex_webhook_event): lesen nur als
--    nicht-owner/staff/cleaner im eigenen Tenant, schreiben ausschliesslich
--    service_role.
-- ---------------------------------------------------------------------------
revoke insert, update, delete on public.channex_webhook_event
    from anon, authenticated;
