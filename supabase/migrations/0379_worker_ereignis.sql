-- Worker-Verlauf: was der Hintergrund-Prozess tut, live und nachlesbar.
--
-- WARUM DIESE TABELLE, OBWOHL ES DREI QUELLEN GIBT:
-- Der Worker hinterlässt seine Spuren heute an drei Stellen, und jede kann nur
-- ein Drittel der Frage beantworten:
--
--   `jobs`                  — was abgearbeitet wurde (Typ, Status, Versuche)
--   `channex_debug_log`     — was gesendet und empfangen wurde (Methode, Pfad,
--                             Bodies, HTTP-Status, Dauer)
--   `channex_webhook_event` — was von aussen eintraf
--
-- Live gemessen (12.08.2026, 24 h): 1.422 Jobs über 13 Typen, 522
-- Channex-Aufrufe, 588 Webhook-Ereignisse. Wer wissen will, was der Worker
-- gerade macht, muss drei Tabellen von Hand zusammenlegen — im Backoffice gibt
-- es dafür keine Ansicht.
--
-- ENTSCHEIDEND IST ABER NICHT DIE ANSICHT, SONDERN REALTIME:
-- Keine der drei Tabellen ist abonnierbar (gegen die Live-DB geprüft: nicht in
-- `supabase_realtime`, kein `select` für `authenticated`). Und sie DÜRFEN es
-- nicht werden: `channex_debug_log.request_body` und `ari_outbox.payload`
-- tragen vollständige Nutzlasten — Gastdaten, Preise, Portal-Kennungen. Ein
-- Grant für `authenticated` öffnete sie dem DB-Direktpfad; ein eingeloggter
-- Cleaner käme mit dem anon-Key per `curl` an alles (Wurzel 6).
--
-- Diese Tabelle ist deshalb die ABONNIERBARE Spur: nur Metadaten, keine
-- Bodies. Sie sagt DASS etwas passiert ist und wie es ausging. Die Details
-- holt die Oberfläche danach über den Backoffice-Endpunkt, der service-role
-- läuft und `is_platform_admin()` prüft — dort ist alles sichtbar, auch jede
-- Fehlermeldung und jeder Body.
--
-- WAS SIE NICHT IST: keine zweite Wahrheit. `jobs` bleibt die Warteschlange,
-- `channex_debug_log` das Protokoll der Aufrufe. Hier steht der Verlauf.

create table if not exists public.worker_ereignis (
    id            uuid        primary key default gen_random_uuid(),
    -- Woher das Ereignis kommt: 'job' (Warteschlange), 'gesendet' (Aufruf an
    -- ein Portal), 'empfangen' (Webhook von aussen), 'tick' (Wartungslauf).
    -- Die Richtung ist die wichtigste Achse der Oberfläche — deshalb eine
    -- eigene Spalte und kein aus dem Typ geratener Wert.
    richtung      text        not null,
    -- Der fachliche Vorgang: Job-Typ ('push_ari'), Webhook-Event
    -- ('booking_new') oder Aufruf-Schritt ('availability_push').
    vorgang       text        not null,
    -- Ausgang. 'ok' | 'fehler' | 'gestartet' — bewusst nur drei Werte: der
    -- Verlauf soll auf einen Blick lesbar sein, die Feinheiten stehen in den
    -- Quelltabellen.
    ergebnis      text        not null,
    -- Bezug, soweit vorhanden. Kein FK: das Objekt darf verschwinden, das
    -- Ereignis bleibt wahr. `tenant_id` ist NULL bei kontoweiten Läufen
    -- (Feed-Pull) — das ist ein echter Zustand, kein fehlender Wert.
    tenant_id     uuid,
    property_id   uuid,
    -- Verweis in die Quelltabelle, damit die Oberfläche die Details nachladen
    -- kann, ohne sie hier zu duplizieren.
    quelle_tabelle text,
    quelle_id      uuid,
    -- HTTP-Seite eines Aufrufs. NULL bei Jobs/Ticks — dort gibt es keine.
    http_methode  text,
    http_pfad     text,
    http_status   integer,
    dauer_ms      integer,
    -- Die Fehlermeldung im Klartext, gedeckelt auf das Lesbare. NULL bei
    -- Erfolg. Wird NICHT gekürzt, wenn sie kurz ist — und nie erfunden, wenn
    -- keine vorlag (Wurzel 4).
    fehler_text   text,
    -- Wie oft dieser Vorgang schon versucht wurde (aus `jobs.attempts`).
    -- Macht sichtbar, was im Kreis läuft, statt es als Einzelfall zu zeigen.
    versuche      integer,
    -- UNSERE Uhr: wann der Worker das getan hat. Bei einem 'empfangen' ist das
    -- der EINGANG bei uns, nicht der Zeitpunkt beim Portal (Wurzel 5b) — der
    -- steht in der Quelltabelle.
    erfasst_at    timestamptz not null default now()
);

-- Der Verlauf wird IMMER zeitlich absteigend gelesen.
create index if not exists worker_ereignis_zeit_idx
    on public.worker_ereignis (erfasst_at desc);
-- „nur Fehler zeigen" ist der häufigste Filter — partiell, damit der Index
-- klein bleibt (Fehler sind die Minderheit: 3 von 522 Aufrufen in 24 h).
create index if not exists worker_ereignis_fehler_idx
    on public.worker_ereignis (erfasst_at desc)
    where ergebnis = 'fehler';
-- Filter „diese Richtung" und „dieser Vorgang" in der Oberfläche.
create index if not exists worker_ereignis_richtung_idx
    on public.worker_ereignis (richtung, erfasst_at desc);
create index if not exists worker_ereignis_vorgang_idx
    on public.worker_ereignis (vorgang, erfasst_at desc);
-- „was lief an diesem Objekt" — der Einstieg aus der Objekt-Diagnose.
create index if not exists worker_ereignis_objekt_idx
    on public.worker_ereignis (property_id, erfasst_at desc)
    where property_id is not null;

-- IDEMPOTENZ (Wurzel 2): Der Worker tickt eng, und ein Job kann nach einem
-- Retry erneut denselben Abschluss melden. Ohne Backstop stünde derselbe
-- Vorgang mehrfach im Verlauf. Schlüssel ist (Quelle, Ergebnis): EIN Job geht
-- genau einmal nach 'ok' bzw. 'fehler'. Partiell, weil `quelle_id` bei einem
-- Tick ohne Quellzeile NULL sein darf.
create unique index if not exists worker_ereignis_quelle_uidx
    on public.worker_ereignis (quelle_tabelle, quelle_id, ergebnis)
    where quelle_id is not null;

alter table public.worker_ereignis enable row level security;

-- Wurzel 6: Schreiben ausschliesslich der Server (service_role) — sonst
-- könnte ein eingeloggter Nutzer per anon-Key einen erfundenen Verlauf
-- hineinschreiben. LESEN muss `authenticated` erlaubt sein, sonst ist das
-- Realtime-Abo eine stumme Attrappe; WELCHE Zeilen, entscheidet die Policy.
revoke all on public.worker_ereignis from anon, authenticated;
grant select on public.worker_ereignis to authenticated;

-- Nur Backoffice. Kein Mandantenbezug in der Policy, obwohl `tenant_id`
-- mitgeführt wird: der Worker gehört der Plattform, nicht einem Betrieb. Ein
-- Betriebs-Nutzer hat hier nichts zu suchen — auch nicht bei „seinen" Zeilen,
-- denn daraus liesse sich die Arbeitsweise der Plattform ablesen.
create policy worker_ereignis_platform_read on public.worker_ereignis
    for select to authenticated
    using (public.is_platform_admin());

-- Restriktiv für ALLE Kommandos: schliesst den Schreibpfad mit, nicht nur
-- select (ein reines `for select` liesse insert/update/delete offen).
create policy worker_ereignis_deny_write on public.worker_ereignis
    as restrictive for all
    using (public.is_platform_admin())
    with check (false);

-- Realtime: der Verlauf im Backoffice hört hier zu. Grant (oben) UND
-- Publikation müssen BEIDE stimmen, sonst ist das Abo eine Attrappe.
do $$
begin
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'worker_ereignis'
    ) then
        alter publication supabase_realtime add table public.worker_ereignis;
    end if;
end $$;

comment on table public.worker_ereignis is
    'Abonnierbarer Verlauf der Worker-Taetigkeit (Jobs, Portal-Aufrufe, '
    'Webhook-Eingaenge). Nur METADATEN: die Nutzlasten bleiben in jobs / '
    'channex_debug_log / channex_webhook_event, die fuer authenticated '
    'gesperrt sind (Wurzel 6). Nur Server schreibt.';
comment on column public.worker_ereignis.richtung is
    'job | gesendet | empfangen | tick — die Hauptachse der Oberflaeche.';
comment on column public.worker_ereignis.quelle_tabelle is
    'Wo die Details liegen (jobs, channex_debug_log, channex_webhook_event). '
    'Die Oberflaeche laedt sie ueber den Backoffice-Endpunkt nach, nicht per '
    'Direktzugriff.';
comment on column public.worker_ereignis.fehler_text is
    'Fehlermeldung im Klartext. NULL bei Erfolg — nie ein geratener Text.';
comment on column public.worker_ereignis.erfasst_at is
    'UNSERE Uhr. Bei richtung=empfangen der EINGANG bei uns, nicht der '
    'Zeitpunkt beim Portal (Wurzel 5b).';
