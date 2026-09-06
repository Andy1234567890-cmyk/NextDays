-- 0573_schloesser_seam.sql — Smart-Locks über den Aggregator Seam
--
-- DER ANLASS: Anfrage eines Betriebs, die igloohome-API einzubauen. Die
-- Recherche (fünf Läufe, Belege in docs/SCHLOESSER-RECHERCHE.md) hat ergeben,
-- dass KEIN etabliertes PMS n Direktintegrationen zu Schlossherstellern baut:
-- Hostaway, Guesty, Lodgify und Smoobus neue Generation gehen alle über den
-- Aggregator Seam; Smoobu migriert seine Direktanbindungen zu igloohome und
-- Nuki gerade dorthin. Der Grund ist nicht Bequemlichkeit, sondern dass die
-- Hersteller-APIs fachlich GEGENSÄTZLICH sind:
--
--   igloohome  algoPIN offline erzeugt, ohne Netz — dafür NICHT widerrufbar
--   Nuki       jederzeit widerrufbar — dafür zwingend online, Antrag nötig
--   Salto      erzeugt den PIN SELBST, eigener PIN unmöglich
--   TTLock     Passwort-Grant mit MD5 — Kundenpasswort im PMS, inakzeptabel
--
-- Seam ist damit für Schlösser, was Channex für die OTAs ist: eine Anbindung
-- statt vier Auth-Modelle, vier PIN-Typologien und vier Fehlerbilder.
--
-- WARUM `access_grants` UND NICHT `access_codes`: Seam sagt selbst „we don't
-- recommend building on the Access Codes API directly unless you specifically
-- need low-level control". Ein Grant trägt `starts_at`/`ends_at`, Seam
-- propagiert die Codes an die Geräte, materialisiert sie neu, wenn Hardware
-- online kommt, und räumt bei Ablauf auf. Der Lebenszyklus liegt damit beim
-- Aggregator statt bei uns — genau die Gegenzustandspflege aus Wurzel 1, nur
-- eine Ebene tiefer.

-- =========================================================================
-- 1) Das Seam-Konto je Betrieb (Tech-Provider-Modell)
-- =========================================================================
-- WIE 0255 (WhatsApp): Der Betrieb bringt sein EIGENES Schloss-Konto mit, wir
-- stellen nur die Schnittstelle. Wir sind nie Vertragspartner des Herstellers,
-- und die Hardware gehört dem Kunden. Verbunden wird über Seams „Connect
-- Webview": der Kunde meldet sich bei SEINEM Hersteller an, wir sehen das
-- Passwort nie. Deshalb steht hier auch kein `client_secret` des Kunden —
-- nur die Seam-seitige Verbindungskennung.
create table if not exists public.seam_connection (
    id                  uuid primary key default gen_random_uuid(),
    tenant_id           uuid not null
                          references public.tenants(id) on delete cascade,
    -- Seams Kennung dieser Verbindung (connected_account_id). Global
    -- eindeutig; ein Konto darf nicht zwei Betrieben gehören (Wurzel 2).
    connected_account_id text not null,
    -- Welcher Hersteller dahinter steht, wie Seam ihn nennt (`igloohome`,
    -- `nuki`, `ttlock`, `salto`, `keynest` …). Bewusst KEIN Enum: die Liste
    -- gehört Seam, nicht uns — ein neuer Hersteller darf keine Migration
    -- erfordern. Anzeige über den Kanal-Katalog im Frontend.
    provider            text not null,
    -- Anzeigename aus dem Hersteller-Konto, damit der Betrieb bei mehreren
    -- Verbindungen erkennt, welche welche ist.
    display_name        text,
    -- pending  = Webview geöffnet, noch nicht bestätigt
    -- connected = nutzbar
    -- error     = Seam meldet ein Problem (Zugangsdaten abgelaufen o. ä.)
    -- disconnected = vom Kunden getrennt
    status              text not null default 'pending'
                          check (status in (
                            'pending', 'connected', 'error', 'disconnected'
                          )),
    -- Warum `error`. NICHT defaulten: fehlt der Grund, ist er unbekannt und
    -- die UI muss das sagen, statt einen plausiblen zu erfinden (Wurzel 4).
    error_code          text,
    connected_at        timestamptz,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now(),
    unique (connected_account_id)
);

create index if not exists seam_connection_tenant_idx
    on public.seam_connection (tenant_id);

create trigger trg_seam_connection_updated
    before update on public.seam_connection
    for each row execute function public.set_updated_at();

-- =========================================================================
-- 2) Die Geräte — mit ihren FÄHIGKEITEN, nicht mit ihrem Hersteller
-- =========================================================================
-- DER KERN DIESER MIGRATION. Ob ein Code widerrufbar ist, ist eine
-- Eigenschaft des GERÄTS, nicht des Herstellers:
--
--   * igloohome OHNE Bridge  -> nicht widerrufbar (algoPIN gilt bis Ablauf)
--   * igloohome MIT  Bridge  -> widerrufbar (Bridge-Job löscht den PIN)
--   * TTLock ohne Gateway    -> nicht widerrufbar, selbst wenn die Marke es
--                               grundsätzlich könnte (zusätzlich muss
--                               `keyboardPwdVersion` = 4 sein)
--
-- Wer „igloohome = nicht widerrufbar" hart verdrahtet, zeigt einem Kunden MIT
-- Bridge eine Falschaussage — und umgekehrt. Deshalb wird die Fähigkeit je
-- Gerät von Seam gelesen und HIER gespeichert, damit die Oberfläche sie
-- anzeigen kann, ohne bei jedem Rendern Seam zu fragen.
create table if not exists public.seam_device (
    id                  uuid primary key default gen_random_uuid(),
    tenant_id           uuid not null
                          references public.tenants(id) on delete cascade,
    connection_id       uuid not null
                          references public.seam_connection(id)
                          on delete cascade,
    -- Seams Geräte-ID. Global eindeutig.
    seam_device_id      text not null,
    display_name        text,
    -- Was das Gerät kann, aus Seams `capabilities`/`properties` gelesen.
    -- `can_revoke` ist das wichtigste Feld der ganzen Migration: es
    -- entscheidet, ob ein Storno den Code wirklich zurückzieht oder ob die
    -- UI sagen muss „gilt bis TT.MM., nicht vorzeitig entziehbar".
    can_revoke          boolean,
    -- Offline-Codes (igloohome algoPIN, dormakaba Oracode, Lockly) werden
    -- algorithmisch erzeugt: kein Wunschwert, keine nachträgliche Änderung.
    is_offline_capable  boolean,
    -- Zeitraster des Herstellers: `free` (Nuki, sekundengenau),
    -- `hour` (igloohome hourly), `day` (igloohome daily). Steuert, ob wir
    -- Check-in-Zeiten runden müssen.
    time_granularity    text
                          check (time_granularity is null
                                 or time_granularity in ('free','hour','day')),
    -- Betriebszustand, gespiegelt aus Seam. KEIN Default „online": fehlt der
    -- Wert, ist er unbekannt und der Anzeigepfad muss ihn prüfen (Wurzel 4).
    -- WICHTIG: bei igloohome ohne Bridge ist `online = false` der NORMALFALL
    -- und kein Fehler — beide Referenz-PMS erklären das in eigenen FAQ, weil
    -- es sonst als Störung gemeldet wird.
    online              boolean,
    battery_level       numeric(4,3),
    -- Wie viele Codes das Gerät noch fasst. igloohome: 199 gesamt, davon
    -- 3 pro Stunde / 3 pro Tag; Nuki: 100 (Smart Lock 1/2) bzw. 200 (3+).
    -- Stornos verbrauchen das Kontingent mit — deshalb ist das ein echter
    -- Grenzwert, der zu 422 führen muss und nicht zu einem stillen Fehlschlag.
    capacity_total      integer,
    capacity_used       integer,
    last_seen_at        timestamptz,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now(),
    unique (seam_device_id)
);

create index if not exists seam_device_tenant_idx
    on public.seam_device (tenant_id);
create index if not exists seam_device_connection_idx
    on public.seam_device (connection_id);

create trigger trg_seam_device_updated
    before update on public.seam_device
    for each row execute function public.set_updated_at();

-- =========================================================================
-- 3) Zuordnung Gerät -> Einheit ODER Gebäude (Türtyp)
-- =========================================================================
-- Guesty trennt „private unit door" und „common door" — die beste Lösung im
-- Feld, und sie passt exakt auf unser Modell (CLAUDE.md, Datenmodell):
--
--   private Tür       -> hängt an der EINHEIT (`property_units`, 0265)
--   Gemeinschaftstür  -> hängt am GEBÄUDE (`buildings`, 0264)
--
-- Damit ist der Hoteleingang abgebildet, OHNE eine Kategorie-Ebene im Objekt
-- zu erfinden. Lodgify macht es falsch und schaltet Smart Locks komplett ab,
-- „if room types or bookable units are activated" — für unser Modell (1 Typ
-- mit n Einheiten) wäre das eine Sackgasse. Uplisting kann es richtig
-- („assign a lock to each individual unit").
--
-- n:m ist Absicht, in BEIDE Richtungen: eine Einheit kann mehrere Schlösser
-- haben (Haustür + Wohnungstür), ein Schloss mehrere Einheiten (Hauseingang).
create table if not exists public.seam_device_zuordnung (
    id             uuid primary key default gen_random_uuid(),
    tenant_id      uuid not null
                     references public.tenants(id) on delete cascade,
    device_id      uuid not null
                     references public.seam_device(id) on delete cascade,
    -- GENAU EINES von beiden ist gesetzt — erzwungen durch den Check unten.
    unit_id        uuid references public.property_units(id) on delete cascade,
    building_id    uuid references public.buildings(id) on delete cascade,
    created_at     timestamptz not null default now(),
    -- Der Türtyp ist nicht redundant zu den zwei Spalten, sondern deren
    -- fachliche Bedeutung: `unit` = nur dieser Gast, `common` = jeder Gast
    -- im Gebäude. Ein XOR, kein Nullable-Paar mit Interpretationsspielraum.
    constraint seam_zuordnung_genau_eine_ebene check (
        (unit_id is not null and building_id is null)
        or (unit_id is null and building_id is not null)
    ),
    -- Dasselbe Gerät nicht zweimal an dieselbe Stelle (Wurzel 2:
    -- Doppelklick/Retry beim Zuordnen).
    unique (device_id, unit_id),
    unique (device_id, building_id)
);

create index if not exists seam_zuordnung_tenant_idx
    on public.seam_device_zuordnung (tenant_id);
create index if not exists seam_zuordnung_unit_idx
    on public.seam_device_zuordnung (unit_id);
create index if not exists seam_zuordnung_building_idx
    on public.seam_device_zuordnung (building_id);

-- =========================================================================
-- 4) Der Zugang je Buchung (Seam Access Grant)
-- =========================================================================
-- Ein Grant je Reservierung, nicht ein PIN je Gerät: Seam bündelt über den
-- `reservation_key` alle Geräte einer Buchung und liefert EINEN Code. Das ist
-- auch fachlich richtig — der Gast will eine Zahl, nicht drei.
create table if not exists public.seam_zugang (
    id                 uuid primary key default gen_random_uuid(),
    tenant_id          uuid not null
                         references public.tenants(id) on delete cascade,
    reservation_id     uuid not null
                         references public.reservations(id) on delete cascade,
    -- Seams Kennungen. `grant_id` ist null, solange der Grant nur geplant,
    -- aber noch nicht bei Seam angelegt ist (Zustand `geplant`).
    seam_grant_id      text,
    -- Unser Schlüssel für Seam, damit ein Retry denselben Grant wiederfindet
    -- statt einen zweiten anzulegen (Wurzel 2). Aus der Reservierung
    -- abgeleitet und stabil über Änderungen hinweg.
    reservation_key    text not null,
    -- Der Code selbst. NULL heißt „noch nicht bekannt" — bei Salto und
    -- igloohome-offline erzeugt das SCHLOSSSYSTEM den Wert, wir lesen ihn
    -- zurück. Ein PMS, das den Code selbst würfelt und in die Anreisemail
    -- schreibt, verschickt bei Salto einen falschen Code.
    code               text,
    -- Gültigkeit, wie sie an Seam gegeben wurde (mit Puffer, siehe
    -- `seam_einstellungen`). NICHT identisch mit Anreise/Abreise.
    starts_at          timestamptz not null,
    ends_at            timestamptz not null,
    -- geplant       = bei uns angelegt, noch nicht an Seam gegeben
    -- angelegt      = bei Seam, wartet auf Auslieferung ans Gerät
    -- aktiv         = am Gerät angekommen und gültig
    -- fehlgeschlagen= Seam meldet einen Fehler (Gerät offline, Speicher voll)
    -- abgelaufen    = ends_at vorbei
    -- widerrufen    = zurückgezogen, bestätigt
    -- nicht_widerrufbar = Storno gab es, aber der Code läuft weiter
    --
    -- Der letzte Zustand ist der wichtigste und der Grund, warum hier ein
    -- Enum und kein boolean steht: bei einem Offline-Code IST der Storno
    -- passiert, aber der Code gilt weiter. Beides zu vermischen wäre genau
    -- die stille Falschaussage aus Wurzel 5b — plausibel aussehend und von
    -- niemandem als Bug erkennbar. Seam wörtlich: „you cannot revoke a
    -- created offline access code before the configured expiration date".
    status             text not null default 'geplant'
                         check (status in (
                           'geplant', 'angelegt', 'aktiv', 'fehlgeschlagen',
                           'abgelaufen', 'widerrufen', 'nicht_widerrufbar'
                         )),
    -- Klartext für die Oberfläche, wenn etwas nicht klappt. Kein Default.
    status_grund       text,
    -- Wann der Code an Seam gegeben wurde bzw. am Gerät ankam. Getrennt,
    -- weil das ZWEI Ereignisse sind: Hostaway und Guesty programmieren
    -- Codes 72 h vor Aktivierung aufs Schloss, ausdrücklich um ein
    -- Wiederholfenster bei Fehlschlag zu haben.
    angelegt_at        timestamptz,
    am_gerraet_at      timestamptz,
    widerrufen_at      timestamptz,
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now(),
    -- EIN aktiver Zugang je Reservierung. Der Backstop gegen doppelte
    -- Erzeugung bei Retry/Doppelklick (Wurzel 2) — ohne ihn verbraucht jeder
    -- Retry einen der 3 PIN-Slots pro Tag bei igloohome.
    unique (reservation_key)
);

create index if not exists seam_zugang_tenant_idx
    on public.seam_zugang (tenant_id);
create index if not exists seam_zugang_reservation_idx
    on public.seam_zugang (reservation_id);
-- Für den Worker-Tick „welche Grants müssen jetzt angelegt werden".
create index if not exists seam_zugang_faellig_idx
    on public.seam_zugang (status, starts_at)
    where status in ('geplant', 'angelegt');

create trigger trg_seam_zugang_updated
    before update on public.seam_zugang
    for each row execute function public.set_updated_at();

-- =========================================================================
-- 5) Einstellungen je Objekt (Puffer, Vorlauf)
-- =========================================================================
-- Alle Referenz-PMS machen die Gültigkeit konfigurierbar, und zwar als PUFFER
-- in Minuten um Check-in/Check-out — nicht als absolute Uhrzeit. Lodgify:
-- 30 min vor/nach als Default. Uplisting: getrennte Puffer. Wir folgen dem.
create table if not exists public.seam_einstellungen (
    property_id        uuid primary key
                         references public.properties(id) on delete cascade,
    tenant_id          uuid not null
                         references public.tenants(id) on delete cascade,
    -- Minuten VOR Check-in, ab wann der Code gilt.
    puffer_vor_min     integer not null default 30
                         check (puffer_vor_min between 0 and 1440),
    -- Minuten NACH Check-out, bis wann er gilt.
    puffer_nach_min    integer not null default 30
                         check (puffer_nach_min between 0 and 1440),
    -- Wie viele Stunden vor Gültigkeitsbeginn der Grant an Seam geht.
    -- Default 72 h wie bei Hostaway und Guesty — ausdrücklich als
    -- Wiederholfenster begründet, nicht als Willkür.
    vorlauf_stunden    integer not null default 72
                         check (vorlauf_stunden between 0 and 720),
    -- Ob überhaupt automatisch Codes erzeugt werden.
    aktiv              boolean not null default true,
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now()
);

create index if not exists seam_einstellungen_tenant_idx
    on public.seam_einstellungen (tenant_id);

create trigger trg_seam_einstellungen_updated
    before update on public.seam_einstellungen
    for each row execute function public.set_updated_at();

-- =========================================================================
-- 6) Webhook-Eingang (Idempotenz-Backstop, Wurzel 2)
-- =========================================================================
-- Seam liefert Ereignisse per Webhook, und Redelivery ist real. Ohne
-- UNIQUE auf der Ereignis-ID würde eine zweite Zustellung denselben Zustand
-- ein zweites Mal verarbeiten. Der DB-Backstop ist die einzige Stelle, die
-- auch bei parallelen Zustellungen hält.
create table if not exists public.seam_webhook_eingang (
    event_id       text primary key,
    event_type     text not null,
    -- Wann SEAM das Ereignis erzeugt hat, nicht wann wir es bekamen. Der
    -- Unterschied ist Wurzel 5b: `created_at` unten ist UNSERE Uhr und
    -- beschreibt nur unsere Verarbeitung.
    occurred_at    timestamptz,
    payload        jsonb not null,
    verarbeitet_at timestamptz,
    fehler         text,
    created_at     timestamptz not null default now()
);

create index if not exists seam_webhook_offen_idx
    on public.seam_webhook_eingang (created_at)
    where verarbeitet_at is null;

-- =========================================================================
-- RLS + Grant-Entzug (Wurzel 6)
-- =========================================================================
-- Der Türcode ist ein Zugangsgeheimnis wie `door_code` und `wifi_password`
-- (0314). Ein eingeloggter cleaner darf ihn NICHT per
-- `curl /rest/v1/seam_zugang?select=code` abholen können. Also: Tenant-Policy
-- als Backstop, dazu vollständiger Grant-Entzug und eine restriktive Policy,
-- die auch dann greift, wenn eine späte Migration versehentlich neu grantet.
--
-- `seam_device` und `seam_device_zuordnung` sind kein Geheimnis im engeren
-- Sinn, werden aber genauso gesperrt: `seam_device_id` ist die Kennung, mit
-- der man bei Seam operiert, und die Zuordnung verrät die Objektstruktur.
-- Gelesen wird ausschließlich über die API, die den Rollen-Datensplit kennt.

alter table public.seam_connection        enable row level security;
alter table public.seam_device            enable row level security;
alter table public.seam_device_zuordnung  enable row level security;
alter table public.seam_zugang            enable row level security;
alter table public.seam_einstellungen     enable row level security;
alter table public.seam_webhook_eingang   enable row level security;

drop policy if exists seam_connection_tenant on public.seam_connection;
create policy seam_connection_tenant on public.seam_connection
    for all using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

drop policy if exists seam_device_tenant on public.seam_device;
create policy seam_device_tenant on public.seam_device
    for all using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

drop policy if exists seam_zuordnung_tenant on public.seam_device_zuordnung;
create policy seam_zuordnung_tenant on public.seam_device_zuordnung
    for all using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

drop policy if exists seam_zugang_tenant on public.seam_zugang;
create policy seam_zugang_tenant on public.seam_zugang
    for all using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

drop policy if exists seam_einstellungen_tenant on public.seam_einstellungen;
create policy seam_einstellungen_tenant on public.seam_einstellungen
    for all using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- Kein Direktzugriff für anon/authenticated auf ALLE sechs Tabellen.
revoke all on public.seam_connection       from anon, authenticated;
revoke all on public.seam_device           from anon, authenticated;
revoke all on public.seam_device_zuordnung from anon, authenticated;
revoke all on public.seam_zugang           from anon, authenticated;
revoke all on public.seam_einstellungen    from anon, authenticated;
revoke all on public.seam_webhook_eingang  from anon, authenticated;

-- Restriktive Policies: über RLS darf niemand an diese Zeilen. Die
-- service_role umgeht RLS ohnehin, das sperrt also nur den Direktpfad
-- (PostgREST/Realtime) — und genau das ist gewollt.
drop policy if exists seam_connection_kein_direktzugriff
    on public.seam_connection;
create policy seam_connection_kein_direktzugriff on public.seam_connection
    as restrictive for all using (false) with check (false);

drop policy if exists seam_device_kein_direktzugriff on public.seam_device;
create policy seam_device_kein_direktzugriff on public.seam_device
    as restrictive for all using (false) with check (false);

drop policy if exists seam_zuordnung_kein_direktzugriff
    on public.seam_device_zuordnung;
create policy seam_zuordnung_kein_direktzugriff
    on public.seam_device_zuordnung
    as restrictive for all using (false) with check (false);

drop policy if exists seam_zugang_kein_direktzugriff on public.seam_zugang;
create policy seam_zugang_kein_direktzugriff on public.seam_zugang
    as restrictive for all using (false) with check (false);

drop policy if exists seam_einstellungen_kein_direktzugriff
    on public.seam_einstellungen;
create policy seam_einstellungen_kein_direktzugriff
    on public.seam_einstellungen
    as restrictive for all using (false) with check (false);

drop policy if exists seam_webhook_kein_direktzugriff
    on public.seam_webhook_eingang;
create policy seam_webhook_kein_direktzugriff on public.seam_webhook_eingang
    as restrictive for all using (false) with check (false);

-- =========================================================================
-- Kommentare
-- =========================================================================
comment on table public.seam_connection is
    'Schloss-Konto des Betriebs beim Aggregator Seam (Connect Webview). Der '
    'Betrieb bringt sein eigenes Hersteller-Konto mit; wir speichern nur die '
    'Seam-Verbindungskennung, NIE Hersteller-Zugangsdaten.';

comment on column public.seam_device.can_revoke is
    'Ob ein Code an DIESEM Gerät zurückgezogen werden kann. Eigenschaft des '
    'GERAETS, nicht des Herstellers: igloohome mit Bridge kann es, ohne '
    'Bridge nicht. NULL = unbekannt -> die UI darf keinen Widerruf '
    'versprechen (Wurzel 4/5b).';

comment on column public.seam_device.online is
    'Netzzustand des Geraets, gespiegelt aus Seam. Bei igloohome OHNE Bridge '
    'ist false der NORMALFALL und kein Fehler.';

comment on column public.seam_zugang.code is
    'Der Tuercode. Geheimnis wie property_guest_portal.door_code — nur ueber '
    'den Server, nie per anon-Key lesbar. NULL = noch nicht bekannt; bei '
    'Salto und igloohome-offline erzeugt das Schlosssystem den Wert.';

comment on column public.seam_zugang.status is
    'nicht_widerrufbar ist der fachlich wichtigste Zustand: der Storno ist '
    'passiert, aber ein Offline-Code (algoPIN) laeuft bis ends_at weiter. Die '
    'UI muss das SAGEN statt "widerrufen" zu behaupten.';

comment on table public.seam_webhook_eingang is
    'Idempotenz-Backstop fuer Seam-Webhooks (Wurzel 2): Redelivery ist real, '
    'die event_id als Primaerschluessel haelt auch bei parallelen '
    'Zustellungen.';
