-- 0685_datev_settings.sql — DATEV-Einstellungen je Betrieb (Bereich »datev«)
--
-- WARUM CSV UND KEINE API: Das alte Werkzeug hatte 14 DATEV-Endpunkte, alle
-- Attrappen (`sandbox.datev.invalid`, Mock-Tokens, `/validate` immer `true`;
-- docs/buchhaltung/TASKILO-FINANZ-BESTAND-2026-09-11.md Z. 69-73). Echt war
-- ausschließlich der Buchungsstapel-Export im EXTF-Format. Genau der wird hier
-- gebaut — der Steuerberater importiert die Datei in DATEV Rechnungswesen.
--
-- WARUM KEINE DEFAULTS: Beraternummer und Mandantennummer vergibt DATEV je
-- Kanzlei/Mandant — es gibt keinen richtigen Ersatzwert. Kontenrahmen (SKR03/
-- SKR04), Sachkontenlänge und Wirtschaftsjahr-Beginn entscheidet der
-- Steuerberater. Erlös-, Aufwands- und Finanzkonto sind Sachkonten des
-- Kontenplans des Betriebs; die BU-Schlüssel je Steuersatz hängen davon ab,
-- ob Automatikkonten (BU leer!) oder manuelle Konten gebucht werden — ein
-- fest verdrahtetes „19 % → 3" wäre bei Automatikkonten ein Importfehler und
-- für einen dänischen Betrieb (25 %) schlicht erfunden (Wurzel 4). Alle Fach-
-- felder sind deshalb NULL-fähig (Upsert), und der Export prüft die
-- Vollständigkeit: fehlt ein Pflichtfeld, antwortet er mit 422 UND der Liste
-- der fehlenden Felder (`bereiche/datev/service.py::_settings_pflicht`).
--
-- Debitoren-/Kreditorenkonten: DATEV-Personenkonten sind Sachkontenlänge + 1
-- Stellen lang; das Schema hier ist „Kundennummer + Startwert" (Debitor
-- 10000 + Kundennummer, Kreditor 70000 + Kundennummer), Startwerte je Betrieb.
--
-- `bu_schluessel_erloes` / `bu_schluessel_aufwand`: jsonb-Map Steuersatz →
-- BU-Schlüssel, z. B. {"19.00": "3", "7.00": "2", "0.00": ""}. Ein leerer
-- String heißt „bewusst kein Schlüssel" (Automatikkonto); ein FEHLENDER Satz
-- heißt „nicht zugeordnet" → 422 beim Export.
-- `finanzkonten`: jsonb-Map payment_accounts.id → Sachkonto (1200/1800 …);
-- ein Zahlungskonto ohne Eintrag fällt auf `standard_finanzkonto`.
--
-- Finanz-/Betriebseinstellungen sind server-only (Wurzel 6): RLS + revoke,
-- keine Realtime-Publikation.

create table if not exists public.datev_settings (
    tenant_id                uuid primary key references public.tenants(id) on delete cascade,
    berater_nummer           integer  check (berater_nummer is null or berater_nummer between 1001 and 9999999),
    mandanten_nummer         integer  check (mandanten_nummer is null or mandanten_nummer between 1 and 99999),
    kontenrahmen             text     check (kontenrahmen is null or kontenrahmen in ('SKR03', 'SKR04')),
    sachkontenlaenge         smallint check (sachkontenlaenge is null or sachkontenlaenge between 4 and 8),
    -- Monat, in dem das Wirtschaftsjahr beginnt (1 = Kalenderjahr).
    wirtschaftsjahr_beginn_monat smallint check (wirtschaftsjahr_beginn_monat is null
                                                 or wirtschaftsjahr_beginn_monat between 1 and 12),
    standard_erloeskonto     text     check (standard_erloeskonto is null or standard_erloeskonto ~ '^[0-9]{4,8}$'),
    standard_aufwandskonto   text     check (standard_aufwandskonto is null or standard_aufwandskonto ~ '^[0-9]{4,8}$'),
    standard_finanzkonto     text     check (standard_finanzkonto is null or standard_finanzkonto ~ '^[0-9]{4,8}$'),
    debitor_konto_start      integer  check (debitor_konto_start is null or debitor_konto_start between 1000 and 999999999),
    kreditor_konto_start     integer  check (kreditor_konto_start is null or kreditor_konto_start between 1000 and 999999999),
    bu_schluessel_erloes     jsonb,
    bu_schluessel_aufwand    jsonb,
    finanzkonten             jsonb    not null default '{}'::jsonb,
    -- Festschreibung im Stapel-Header (1 = der Berater kann die Buchungen
    -- nicht mehr ändern). Der Betrieb entscheidet, kein Default.
    festschreibung           boolean,
    created_at               timestamptz not null default now(),
    updated_at               timestamptz not null default now()
);

comment on table public.datev_settings is
    'DATEV-Exporteinstellungen je Betrieb (Beraternummer, Mandant, SKR, Konten, '
    'BU-Schlüssel). Alle Fachfelder ohne Default; Vollständigkeit prüft der Service.';

drop trigger if exists trg_datev_settings_updated on public.datev_settings;
create trigger trg_datev_settings_updated
    before update on public.datev_settings
    for each row execute function public.set_updated_at();

alter table public.datev_settings enable row level security;

drop policy if exists datev_settings_tenant on public.datev_settings;
create policy datev_settings_tenant on public.datev_settings
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- Wurzel 6: der Direktpfad (PostgREST mit anon-Key + JWT) bleibt zu.
revoke select, insert, update, delete on public.datev_settings from anon, authenticated;
