-- Übernommener Nachrichtenverlauf zu einer Buchung (Bestandsübernahme).
--
-- WOZU: Zieht ein Betrieb von einem anderen PMS zu uns um, kommt nicht nur der
-- Kalender mit, sondern auch die Korrespondenz. Bei der Übernahme von AirSmil
-- (12.08.2026) hingen an 9 Website-Buchungen 90 Nachrichten — darunter
-- WLAN-Passwörter, Check-in-Codes, Absprachen zur Ankunftszeit und Rückfragen
-- zur Endreinigung. Ohne sie beginnt der Betrieb bei uns bei null und muss dem
-- Gast Dinge erneut abfragen, die längst geklärt waren.
--
-- WARUM EINE EIGENE TABELLE UND NICHT `guest_messages`:
-- `guest_message_threads` verlangt `portal_guest_id NOT NULL` mit Fremdschlüssel
-- auf `portal_guests` — das sind Konten des MARKTPLATZES myBestDays. Die Gäste
-- eines übernommenen Bestands haben dort nie ein Konto gehabt. Um den
-- Fremdschlüssel zu befriedigen, müsste man 9 Marktplatz-Konten für Menschen
-- erfinden, die sich nie dort registriert haben: erfundene Daten in der
-- Gäste-Welt der anderen Marke (Wurzel 4) und ein Bruch der Markengrenze
-- myNextDays/myBestDays. Deshalb steht die übernommene Korrespondenz getrennt
-- und vermischt sich mit nichts.
--
-- ABGRENZUNG zu den drei bestehenden Nachrichtenwegen:
--   `guest_messages`     — Marktplatz-Chat myBestDays (portal_guests)
--   `portal_messages`    — OTA-Nachrichten über den Channel-Manager
--   `messages`           — interner Betriebs-Posteingang
--   DIESE TABELLE        — eingefrorene Historie aus einem FREMDEN System.
--                          Read-only-Archiv: hier wird nie geantwortet.
--
-- `herkunft` benennt das Quellsystem ('lodgify'), `kanal` den Vertriebsweg der
-- zugehörigen Buchung ('website'). Beides steht ausdrücklich an der Zeile,
-- damit später niemand raten muss, woher ein Verlauf stammt — und damit eine
-- Auswertung „Korrespondenz je Kanal" möglich ist, ohne über die Buchung zu
-- joinen.

create table if not exists public.reservation_nachricht_uebernahme (
    id              uuid primary key default gen_random_uuid(),
    tenant_id       uuid not null references public.tenants(id) on delete cascade,
    reservation_id  uuid not null references public.reservations(id) on delete cascade,
    -- Quellsystem der Übernahme ('lodgify'). Kein Enum: das nächste
    -- Quellsystem soll keine Migration erzwingen.
    herkunft        text not null,
    -- Vertriebskanal der Buchung zum Zeitpunkt der Übernahme ('website').
    -- Bewusst mitgeführt statt nur über reservations.channel gejoint: ändert
    -- jemand später den Kanal der Buchung, bleibt hier wahr, WOHER dieser
    -- Verlauf kam.
    kanal           text not null,
    -- Thread-Kennung des Quellsystems — alle Nachrichten einer Unterhaltung.
    quelle_thread   text,
    -- Nachrichten-ID des Quellsystems. Trägt die Idempotenz (siehe Index).
    quelle_id       text,
    -- 'gast' | 'gastgeber'. Ohne Richtung ist ein Verlauf unlesbar.
    richtung        text not null check (richtung in ('gast', 'gastgeber')),
    betreff         text,
    -- Der Text. Beim Import aus HTML in Klartext gewandelt: rohes Fremd-HTML
    -- anzuzeigen wäre ein XSS-Sink (Wurzel 8), und der Verlauf wird gelesen,
    -- nicht gerendert.
    text            text not null,
    -- Zeitpunkt AUS DER QUELLE (Wurzel 5b). Niemals unsere Verarbeitungszeit:
    -- sonst sähen alle 90 Nachrichten aus, als wären sie am Importtag
    -- geschrieben worden, und die Sortierung wäre wertlos.
    gesendet_at     timestamptz,
    -- Hatte die Nachricht im Quellsystem Anhänge? Die Dateien selbst werden
    -- NICHT übernommen: Lodgify liefert nur signierte S3-Links mit 300 s
    -- Gültigkeit (live geprüft, X-Amz-Expires=300) — gespeichert wären sie tot,
    -- bevor sie jemand anklickt. Die Zahl bleibt, damit sichtbar ist, dass es
    -- welche gab.
    anhaenge_anzahl integer not null default 0,
    -- UNSERE Uhr: wann übernommen wurde. Getrennt von `gesendet_at`.
    uebernommen_at  timestamptz not null default now()
);

-- Der Verlauf wird immer je Buchung chronologisch gelesen.
create index if not exists reservation_nachricht_uebernahme_res_idx
    on public.reservation_nachricht_uebernahme (reservation_id, gesendet_at);

-- IDEMPOTENZ (Wurzel 2): Ein Import läuft real mehrfach — abgebrochen,
-- wiederholt, später nachgezogen. Ohne Riegel stünde der Verlauf doppelt.
-- Schlüssel ist (Herkunft, Nachrichten-ID des Quellsystems); partiell, weil
-- eine Quelle theoretisch keine ID liefern kann.
create unique index if not exists reservation_nachricht_uebernahme_quelle_uidx
    on public.reservation_nachricht_uebernahme (tenant_id, herkunft, quelle_id)
    where quelle_id is not null;

alter table public.reservation_nachricht_uebernahme enable row level security;

-- Wurzel 6: `enable rls` + Tenant-Policy genügt NICHT. Diese Zeilen tragen
-- Gast-Korrespondenz im Klartext — im AirSmil-Bestand nachweislich
-- WLAN-Passwörter und Check-in-Codes. Türcodes/Dossier gehören ausdrücklich zu
-- den Daten, die der Direktpfad nicht sehen darf. Deshalb: KEIN Grant für
-- anon/authenticated. Gelesen wird ausschliesslich über die API (service_role),
-- die den Rollen-Scope durchsetzt.
revoke all on public.reservation_nachricht_uebernahme from anon, authenticated;

-- Restriktiv für ALLE Kommandos (nicht nur select) — ein reines `for select`
-- ließe den Schreibpfad mandantenweit offen.
create policy reservation_nachricht_uebernahme_deny
    on public.reservation_nachricht_uebernahme
    as restrictive for all
    using (false)
    with check (false);

-- KEINE Realtime-Publikation: Ein eingefrorenes Archiv ändert sich nicht, es
-- gibt nichts zu abonnieren. Und ohne SELECT-Grant (oben) wäre ein Abo ohnehin
-- eine stumme Attrappe.

comment on table public.reservation_nachricht_uebernahme is
    'Eingefrorener Nachrichtenverlauf aus einem FREMDEN PMS, uebernommen mit '
    'dem Buchungsbestand. Read-only-Archiv — hier wird nie geantwortet. '
    'Getrennt von guest_messages (Marktplatz myBestDays), portal_messages '
    '(OTA) und messages (Betriebs-Posteingang): nichts wird vermischt.';
comment on column public.reservation_nachricht_uebernahme.kanal is
    'Vertriebskanal der Buchung bei der Uebernahme (z. B. website). Bewusst '
    'redundant zu reservations.channel, damit die Herkunft wahr bleibt, auch '
    'wenn der Kanal der Buchung spaeter geaendert wird.';
comment on column public.reservation_nachricht_uebernahme.gesendet_at is
    'Zeitpunkt AUS DER QUELLE (Wurzel 5b) — nicht der Importzeitpunkt. Der '
    'steht in uebernommen_at.';
