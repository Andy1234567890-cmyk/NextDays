-- 0619 — Digitale Mappe: PDFs in der Gästemappe/Hausmappe eines Objekts
--
-- WARUM: Die Gästemappe (`properties.type_attributes.messaging`) und die
-- Hausmappe (`property_housebook`, Kartei-Stufe 7) führen heute nur getippte
-- Texte. Was ein Betrieb real hat, ist ein PDF: die Hausordnung vom Verwalter,
-- das WLAN-Blatt des Providers, die Anfahrtsbeschreibung des Vorbesitzers.
-- Bisher blieb nur, alles abzutippen — und was niemand abtippt, steht in der
-- Mappe eben nicht.
--
-- Zwei Dinge passieren mit so einem PDF:
--   1. Gemini liest es (Vertex, `erzeuge_multimodal`) und SCHLÄGT VOR, welche
--      Mappenfelder sich damit füllen lassen. Vorgeschlagen, nicht gesetzt —
--      siehe unten.
--   2. Es BLEIBT liegen. Die Mappe zeigt es als Kachel, ein Klick zieht es
--      groß, und man liest im Original nach. Das ist der eigentliche Zweck:
--      der ausgewertete Text ist eine Zusammenfassung, das PDF die Quelle.
--
-- WARUM DIE DATEI EINE ZEILE BEKOMMT UND DIE VORSCHLÄGE NICHT: Das Dokument
-- ist Bestand — es soll morgen noch da sein. Die Vorschläge sind ein
-- Zwischenschritt; sie gehen als Antwort an die Oberfläche und kommen mit dem
-- Übernehmen zurück. Eine Vorschlagstabelle wäre ein weiterer Zustand mit
-- eigenem Gegenzustand (Wurzel 1): verwaiste Zeilen, die niemand aufräumt,
-- weil jemand den Reiter zugemacht hat. Dieselbe Entscheidung wie beim
-- Wissens-Import (0496).
--
-- WARUM NICHTS AUTOMATISCH GESCHRIEBEN WIRD: OCR liest falsch — eine gedrehte
-- Seite, ein Handscan, eine Tabelle. Landet ein falscher Türcode ungesehen in
-- der Gästemappe, sieht ihn der GAST vor dem Betrieb. Deshalb: erkannt →
-- vorgeschlagen → ein Mensch bestätigt.
--
-- SICHERHEIT (Wurzel 6): Diese PDFs sind Hausordnungen und WLAN-Blätter, also
-- Türcodes und Passwörter. Behandlung wie `ki_wissen_quelle`: RLS, restriktive
-- `for all`-Policy UND Entzug aller Rechte für anon/authenticated. Der Bucket
-- ist privat, der Zugriff läuft ausschliesslich über signierte URLs vom
-- Server. Ein eingeloggter cleaner darf per `curl /rest/v1/mappe_dokument`
-- weder lesen noch schreiben.

-- --------------------------------------------------------------------------
-- Die abgelegten Dokumente
-- --------------------------------------------------------------------------
create table if not exists public.mappe_dokument (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants (id) on delete cascade,
    -- Ein Mappendokument gehört IMMER zu einem Objekt (anders als bei
    -- `ki_wissen_quelle`, wo `null` „betriebsweit" heisst). Eine Hausordnung
    -- ohne Haus wäre in keiner Mappe zu finden.
    property_id uuid not null references public.properties (id) on delete cascade,

    -- In welche Mappe es gehört. `gast` = die Gästemappe (der Gast sieht sie),
    -- `haus` = die Hausmappe (nur der Betrieb und das Personal). Die Trennung
    -- entscheidet, wer das PDF zu sehen bekommt — deshalb eine Spalte und
    -- keine Ableitung aus dem Dateinamen.
    mappe text not null check (mappe in ('gast', 'haus')),

    datei_name text not null,
    datei_pfad text not null,
    datei_groesse_bytes integer not null
        check (datei_groesse_bytes >= 0),
    -- Seitenzahl, wie das Modell sie gemeldet hat; null = nicht ermittelt.
    -- KEIN Ersatzwert: „1 Seite" bei einem 40-Seiter wäre eine Falschaussage
    -- (Wurzel 4).
    seiten integer check (seiten is null or seiten > 0),

    -- Wurde das Dokument schon ausgewertet, und was kam dabei heraus? Der
    -- Zustand hängt AN DER DATEI, nicht an einer Sitzung: wer die Mappe morgen
    -- öffnet, muss sehen, ob ein PDF noch ungelesen daliegt.
    --   offen       = hochgeladen, noch nicht gelesen
    --   gelesen     = ausgewertet, Vorschläge lagen vor
    --   uebernommen = mindestens ein Vorschlag wurde bestätigt
    --   ohne_treffer= gelesen, aber nichts Verwertbares gefunden
    --   fehler      = das Lesen schlug fehl (Grund in `auswertung_hinweis`)
    auswertung text not null default 'offen'
        check (auswertung in ('offen', 'gelesen', 'uebernommen',
                              'ohne_treffer', 'fehler')),
    -- Warum es schiefging bzw. was gefunden wurde. Klartext für den Menschen,
    -- nicht für den Code.
    auswertung_hinweis text,
    ausgewertet_am timestamptz,

    hochgeladen_von uuid references public.users (id) on delete set null,
    created_at timestamptz not null default now(),

    constraint mappe_dokument_datei_name_laenge
        check (length(datei_name) <= 300),
    constraint mappe_dokument_datei_pfad_laenge
        check (length(datei_pfad) <= 600),
    constraint mappe_dokument_hinweis_laenge
        check (auswertung_hinweis is null
               or length(auswertung_hinweis) <= 2000),
    -- Ein Fehler ohne Grund wäre ein rotes Symbol, mit dem niemand etwas
    -- anfangen kann.
    constraint mappe_dokument_fehler_hat_grund
        check (auswertung <> 'fehler' or auswertung_hinweis is not null)
);

create index if not exists mappe_dokument_objekt_idx
    on public.mappe_dokument (tenant_id, property_id, mappe, created_at desc);

comment on table public.mappe_dokument is
    'PDFs in der Gäste-/Hausmappe eines Objekts. Enthalten Türcodes und '
    'WLAN-Passwörter → privater Bucket, kein Direktzugriff für '
    'anon/authenticated.';

comment on column public.mappe_dokument.auswertung is
    'offen | gelesen | uebernommen | ohne_treffer | fehler — hängt an der '
    'Datei, damit ein ungelesenes PDF morgen noch als solches erkennbar ist.';

-- --------------------------------------------------------------------------
-- Welches Feld wurde AUS WELCHEM Dokument gefüllt
-- --------------------------------------------------------------------------
-- Ohne diese Spur ist ein übernommener Wert nicht mehr von einem getippten zu
-- unterscheiden. Genau das ist bei Türcodes die Frage, die zählt: steht da
-- noch der Code aus der Hausordnung von 2024? Die Zeile beantwortet sie.
--
-- `on delete cascade` am Dokument, NICHT `set null`: verschwindet die Datei,
-- ist die Herkunftsangabe „aus Datei X" gegenstandslos. Der ÜBERNOMMENE WERT
-- bleibt davon unberührt — er steht in `properties`/`property_guest_portal`
-- und gehört dem Betrieb, nicht der Datei (dieselbe Trennung wie bei
-- `inbox_knowledge_fact.quelle_id`, 0496).
create table if not exists public.mappe_dokument_uebernahme (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants (id) on delete cascade,
    dokument_id uuid not null
        references public.mappe_dokument (id) on delete cascade,

    -- Wohin der Wert ging. Zwei Ziele, weil dieselbe Angabe im Projekt zwei
    -- Heimaten hat: den Freitextblock der Gästemappe UND das strukturierte
    -- Feld im Gastportal. Live am 11.08.2026 gingen sechs Anreise-Mails nicht
    -- raus, weil nur eine der beiden gepflegt war.
    --   messaging       = properties.type_attributes.messaging.<feld>.<sprache>
    --   guest_portal    = property_guest_portal.<spalte>
    --   policies        = properties.type_attributes.policies.<feld>
    ziel text not null check (ziel in ('messaging', 'guest_portal', 'policies')),
    -- Der Feldname im jeweiligen Ziel (z. B. 'wifi', 'wifi_password').
    feld text not null check (length(feld) <= 100),
    -- Nur bei ziel='messaging': welche Sprachfassung. Sonst null.
    sprache text check (sprache is null or sprache in ('de', 'en', 'da')),

    created_at timestamptz not null default now(),

    -- Dasselbe Feld darf nur einmal je Dokument als übernommen geführt
    -- werden — sonst stünden nach einem Doppelklick zwei Herkunftszeilen für
    -- denselben Wert (Wurzel 2).
    constraint mappe_uebernahme_eindeutig
        unique (dokument_id, ziel, feld, sprache)
);

create index if not exists mappe_uebernahme_dokument_idx
    on public.mappe_dokument_uebernahme (tenant_id, dokument_id);

comment on table public.mappe_dokument_uebernahme is
    'Welches Mappenfeld aus welchem PDF gefüllt wurde. Beantwortet die Frage '
    '„woher stammt dieser Türcode und wie alt ist er?".';

-- --------------------------------------------------------------------------
-- RLS (Wurzel 6)
-- --------------------------------------------------------------------------
alter table public.mappe_dokument enable row level security;

drop policy if exists mappe_dokument_tenant on public.mappe_dokument;
create policy mappe_dokument_tenant on public.mappe_dokument
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

drop policy if exists mappe_dokument_kein_direktzugriff on public.mappe_dokument;
create policy mappe_dokument_kein_direktzugriff on public.mappe_dokument
    as restrictive for all
    using (false)
    with check (false);

revoke all on public.mappe_dokument from anon, authenticated;

alter table public.mappe_dokument_uebernahme enable row level security;

drop policy if exists mappe_uebernahme_tenant on public.mappe_dokument_uebernahme;
create policy mappe_uebernahme_tenant on public.mappe_dokument_uebernahme
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

drop policy if exists mappe_uebernahme_kein_direktzugriff
    on public.mappe_dokument_uebernahme;
create policy mappe_uebernahme_kein_direktzugriff
    on public.mappe_dokument_uebernahme
    as restrictive for all
    using (false)
    with check (false);

revoke all on public.mappe_dokument_uebernahme from anon, authenticated;

-- --------------------------------------------------------------------------
-- Bucket für die Mappen-PDFs
-- --------------------------------------------------------------------------
-- PRIVAT, aus demselben Grund wie 0496: in einer Hausordnung stehen Türcode
-- und Alarmcode. Zugriff ausschliesslich über signierte URLs vom Server.
-- 20 MB und nur PDF — beides zusätzlich serverseitig geprüft (Magic-Bytes),
-- weil ein Client-content_type nichts beweist.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('mappe-dokumente', 'mappe-dokumente', false, 20971520,
        array['application/pdf'])
on conflict (id) do update
    set public = false,
        file_size_limit = 20971520,
        allowed_mime_types = array['application/pdf'];

-- --------------------------------------------------------------------------
-- KI-Funktionsname für den Tagesdeckel
-- --------------------------------------------------------------------------
-- MUSS hier UND in `ki_nutzung.FUNKTIONEN` stehen. Fehlt der Name, steigt
-- `_schreiben` still aus: der Zähler bewegt sich nicht, `deckel_pruefen`
-- prüft einen Stand, der nie steigt, und der Tagesdeckel ist ausgerechnet
-- beim teuersten Aufruf eine Attrappe. Genau das ist in diesem Projekt schon
-- viermal passiert.
--
-- Der CHECK wird ERSETZT, nicht ergänzt: jeder bestehende Name muss
-- mitgeführt werden, sonst weist die Datenbank vorhandene Zeilen ab und die
-- Migration scheitert.
-- KEINE Klammern in den Kommentaren dieses Blocks: der Test
-- `test_funktionen_deckungsgleich_mit_db_check` liest die Werteliste bis zur
-- ersten schliessenden Klammer.
alter table public.site_ai_usage
  drop constraint if exists site_ai_usage_funktion_check;

alter table public.site_ai_usage
  add constraint site_ai_usage_funktion_check check (
    funktion in (
      'umschreiben',
      'seo',
      'alt_text',
      'abschnitt',
      'blogbeitrag',
      'profil_vorschlag',
      'seite_uebersetzen',
      'gast_antwort',
      'wissen_import',
      'wissen_lernen',
      'bewertung_deuten',
      'bewertung_bilanz',
      'addon_uebersetzen',
      'personal_prognose',
      'personal_autoplan',
      'personal_assistent',
      'bewertung_gast',
      'bewertung_antwort',
      'dp_regel_berater',
      -- Neu 0619: ein PDF der Gaeste-/Hausmappe lesen. Eigener Name und nicht
      -- unter 'wissen_import' mitgefuehrt, obwohl beide ein PDF durch Gemini
      -- schicken: der Wissens-Import fuellt die Wissensdatenbank, dieser hier
      -- die Mappenfelder. In einem Topf liesse sich nicht sagen, welcher den
      -- Deckel gesprengt hat.
      'mappe_dokument'
    )
  );
