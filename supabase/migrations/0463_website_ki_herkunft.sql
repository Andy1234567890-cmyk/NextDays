-- 0463 — Herkunft eines Textes: von Hand, KI-überarbeitet oder KI-erzeugt
--
-- Das ist der Teil des KI-Assistenten, den Hostaway NICHT hat. Hostaway ist ein
-- White-Label von Duda; Duda nennt als Anbieter „OpenAI", kennzeichnet nichts
-- und schiebt die Pflicht per AGB auf den Kunden. Das geht seit dem 02.08.2026
-- nicht mehr auf.
--
-- WARUM UNS DIE PFLICHT TRIFFT UND NICHT NUR DEN KUNDEN
--
-- Der EU AI Act (VO 2024/1689) gilt in seinen Transparenzpflichten seit dem
-- 02.08.2026. Nach Art. 3(3) ist ANBIETER, wer ein KI-System entwickelt und es
-- UNTER EIGENEM NAMEN oder eigener Marke auf den Markt bringt. Genau das tun
-- wir: der Betrieb klickt in myNextDays auf „Text erzeugen", nicht bei Google.
-- „Wir nutzen doch nur eine API" befreit nicht — sonst wäre jeder Anbieter
-- eines KI-Produkts über einen Fremdmodell-Aufruf aus der Pflicht.
--
--   * Uns (Anbieter) trifft Art. 50 Abs. 2: die Ausgaben müssen in einem
--     MASCHINENLESBAREN Format als künstlich erzeugt markiert sein.
--   * Den Betrieb (Betreiber) trifft Art. 50 Abs. 4: er muss offenlegen, wenn
--     er KI-erzeugten Text zu Themen von öffentlichem Interesse verbreitet.
--     Davon ausgenommen ist Inhalt, der einer MENSCHLICHEN REDAKTIONELLEN
--     KONTROLLE unterlag und für den jemand die Verantwortung trägt.
--
-- Beides bedient diese Migration mit EINEM Feld je Zeile plus einem Nachweis
-- der Freigabe. Kein Wasserzeichen, kein Anbieterversprechen: SynthID ist für
-- BILDER belegt, für Text widersprüchlich dokumentiert, und ein öffentliches
-- Prüfwerkzeug dafür gibt es nicht. Auf etwas, das niemand nachprüfen kann,
-- lässt sich keine Rechtspflicht stützen. Unser eigenes Feld ist die Wahrheit.
--
-- DIE DREI WERTE, UND WARUM ES GENAU DREI SIND
--
--   human        Der Mensch hat den Text geschrieben. Standard für ALLES, was
--                schon da ist — deshalb `default 'human'` und `not null`: eine
--                fehlende Herkunft gibt es nicht, und „unbekannt" wäre der
--                erfundene Ersatzwert, den Wurzel 4 verbietet.
--
--   ai_rewritten Der Mensch hat den Text geschrieben, die KI hat ihn
--                UMGESCHRIEBEN — gekürzt, verlängert, im Ton geändert,
--                korrigiert, übersetzt. Das ist nach dem Erwägungsgrund 133
--                „assistierende Bearbeitung", die die Eingabedaten nicht
--                wesentlich verändert: keine Kennzeichnungspflicht. Wir führen
--                den Wert trotzdem, weil er die Frage „hat hier je eine KI
--                mitgeschrieben?" beantwortbar macht, ohne sie zu einer
--                Kennzeichnung aufzublasen.
--
--   ai_generated Die KI hat den Text NEU erzeugt. Nur dieser Wert löst die
--                maschinenlesbare Kennzeichnung im gerenderten HTML aus und
--                nur dieser Wert verlangt die Freigabe vor der
--                Veröffentlichung.
--
-- Textwerte mit check-Constraint statt eines Enum-Typs: ein vierter Wert wäre
-- sonst eine Typänderung mit Sperre auf jeder Tabelle, die ihn benutzt, und
-- `coalesce(<enum-spalte>, '…')` in einem Trigger ist im August 2026 schon
-- einmal teuer geworden (0418→0424).
--
-- WAS BEWUSST NICHT GEKENNZEICHNET WIRD
--
-- Objektbeschreibungen bekommen KEIN Gast-Banner. Sie sind Werbung für die
-- eigene Unterkunft — kein „Thema von öffentlichem Interesse" im Sinn der
-- FAQ der Kommission zu Art. 50. Ein Banner „dieser Text stammt von einer KI"
-- über einer Objektbeschreibung wäre keine Rechtstreue, sondern ein
-- Verkaufsschaden ohne Rechtsgrund.
--
-- BLOGBEITRÄGE bekommen einen dezenten Fußhinweis, und zwar deshalb: ein
-- Beitrag über die neue Kurtaxe, über lokale Umweltauflagen oder über eine
-- Wahl im Ort kann die Grenze zum öffentlichen Interesse reißen, und man sieht
-- es dem Beitrag beim Schreiben nicht an. Die Unterscheidung „Werbetext" vs.
-- „Beitrag" ist die einzige, die sich ohne Inhaltsprüfung treffen lässt.

-- === Seiten und Beiträge ==================================================
alter table public.site_pages
    add column if not exists content_origin text not null default 'human',
    -- Welches Modell, wann. Nicht Zierde: die Frage „womit wurde das erzeugt?"
    -- ist Teil der Rechenschaft, und ein Modellname, den man erst später
    -- nachtragen will, ist nicht mehr rekonstruierbar.
    --
    -- Wurzel 5b gilt hier NICHT: `ai_generated_at` beschreibt unsere eigene
    -- Verarbeitung („wann haben WIR erzeugt"), nicht das Ereignis eines
    -- Fremdsystems. Es darf deshalb aus unserer Uhr kommen.
    add column if not exists ai_model text,
    add column if not exists ai_generated_at timestamptz,
    -- Der Freigabe-Nachweis. Das ist die Ausnahme aus Art. 50 Abs. 4: „Inhalt,
    -- der einer menschlichen Überprüfung oder redaktionellen Kontrolle
    -- unterlag und für den eine natürliche oder juristische Person die
    -- redaktionelle Verantwortung trägt."
    --
    -- Deshalb steht hier eine PERSON und nicht nur ein Haken: „geprüft" ohne
    -- „von wem" trägt keine Verantwortung. `ai_reviewed_by` ist die
    -- Nutzer-Kennung aus dem Token, nicht der Name — Namen ändern sich, IDs
    -- nicht.
    add column if not exists ai_reviewed_at timestamptz,
    add column if not exists ai_reviewed_by uuid;

alter table public.site_pages
    drop constraint if exists site_pages_content_origin_check;
alter table public.site_pages
    add constraint site_pages_content_origin_check check (
        content_origin in ('human', 'ai_rewritten', 'ai_generated')
    );

-- DER EIGENTLICHE ZAHN: neu erzeugter Text darf nicht veröffentlicht sein,
-- solange ihn niemand freigegeben hat.
--
-- Warum als check-Constraint und nicht nur im Dienst: die Freigabe ist die
-- Rechtsgrundlage, auf der die fehlende Offenlegung ruht. Eine Prüfung, die
-- nur in FastAPI sitzt, ist gegen den PostgREST-Direktpfad wirkungslos
-- (Wurzel 6) — und selbst wenn dieser Pfad hier heute zu ist, wäre der
-- Schutz beim nächsten Grant still weg. Ein Constraint hält, egal wer
-- schreibt: unser Dienst, ein künftiger Job, eine Migration, eine Hand am
-- psql-Prompt.
--
-- Kein Bestandsproblem: alle vorhandenen Zeilen tragen `human`.
alter table public.site_pages
    drop constraint if exists site_pages_ki_freigabe_vor_veroeffentlichung;
alter table public.site_pages
    add constraint site_pages_ki_freigabe_vor_veroeffentlichung check (
        content_origin <> 'ai_generated'
        or is_published is not true
        or ai_reviewed_at is not null
    );

comment on column public.site_pages.content_origin is
    'Herkunft des Seiteninhalts: human | ai_rewritten | ai_generated. '
    'Nur ai_generated löst die maschinenlesbare Kennzeichnung im HTML und '
    'die Freigabepflicht aus (EU AI Act Art. 50 Abs. 2/4).';
comment on column public.site_pages.ai_reviewed_at is
    'Zeitpunkt der inhaltlichen Freigabe durch einen Menschen. Trägt die '
    'Ausnahme "redaktionelle Kontrolle" aus Art. 50 Abs. 4. Reines '
    'Rechtschreib-Lektorat genügt dafür laut FAQ der Kommission NICHT — '
    'die UI verlangt deshalb eine ausdrückliche Bestätigung, keinen '
    'Nebeneffekt des Speicherns.';
comment on column public.site_pages.ai_reviewed_by is
    'Wer freigegeben hat (users.id). Ohne Person trägt niemand die '
    'redaktionelle Verantwortung, und die Ausnahme greift nicht.';

-- === Abschnitte ===========================================================
-- Der Text steht in Wahrheit hier, nicht auf der Seite: eine Seite ist eine
-- Abfolge von Abschnitten, und der KI-Knopf sitzt an EINEM Textfeld. Ohne
-- Herkunft je Abschnitt wäre eine Seite entweder ganz „von der KI" (falsch,
-- sobald ein Absatz von Hand ist) oder ganz „von Hand" (falsch, sobald einer
-- erzeugt wurde). Die Seite fasst zusammen, der Abschnitt weiß es genau.
alter table public.site_blocks
    add column if not exists content_origin text not null default 'human',
    add column if not exists ai_model text,
    add column if not exists ai_generated_at timestamptz,
    add column if not exists ai_reviewed_at timestamptz,
    add column if not exists ai_reviewed_by uuid;

alter table public.site_blocks
    drop constraint if exists site_blocks_content_origin_check;
alter table public.site_blocks
    add constraint site_blocks_content_origin_check check (
        content_origin in ('human', 'ai_rewritten', 'ai_generated')
    );

comment on column public.site_blocks.content_origin is
    'Herkunft des Abschnittstextes. Die Seite veröffentlicht erst, wenn kein '
    'Abschnitt mit ai_generated ohne Freigabe darunter hängt — das prüft der '
    'Dienst, weil es eine Bedingung ÜBER Zeilen ist und ein Constraint sie '
    'nicht sehen kann.';

-- Der Lesepfad der Freigabe-Prüfung beim Veröffentlichen: „hat diese Seite
-- einen erzeugten, nicht freigegebenen Abschnitt?" Er läuft bei jedem
-- Veröffentlichen und muss nicht die ganze Seite lesen.
create index if not exists site_blocks_ki_offen_idx
    on public.site_blocks (page_id)
    where content_origin = 'ai_generated' and ai_reviewed_at is null;

-- === Mediathek: Herkunft des Alt-Textes ===================================
-- `alt_text` selbst legt 0460 an (Mediathek-Ordner). Hier kommt NUR die
-- Herkunft dazu — keine zweite Spalte für denselben Inhalt.
--
-- Warum überhaupt: ein Alt-Text ist Text auf einer öffentlichen Seite. Er
-- beschreibt allerdings ein ECHTES Foto und ist Barrierefreiheit, keine
-- Darstellung einer erfundenen Wirklichkeit — deshalb löst er KEINE
-- Kennzeichnung im HTML aus. Geführt wird die Herkunft trotzdem: die Frage
-- „welche Alt-Texte hat die Maschine geschrieben?" muss beantwortbar sein,
-- wenn ein Betrieb sie durchsehen will.
alter table public.site_media
    add column if not exists alt_text_origin text not null default 'human';

alter table public.site_media
    drop constraint if exists site_media_alt_text_origin_check;
alter table public.site_media
    add constraint site_media_alt_text_origin_check check (
        alt_text_origin in ('human', 'ai_rewritten', 'ai_generated')
    );

comment on column public.site_media.alt_text_origin is
    'Herkunft des Alt-Textes. Löst bewusst KEINE Kennzeichnung im HTML aus: '
    'ein Alt-Text beschreibt ein echtes Foto und dient der Barrierefreiheit. '
    'Geführt wird er, damit ein Betrieb die maschinell geschriebenen '
    'Beschreibungen wiederfinden kann.';

-- An den GRANTS ändert sich NICHTS und das ist geprüft, nicht angenommen:
-- site_pages, site_blocks und site_media tragen für anon/authenticated weder
-- insert noch update noch delete, dazu je eine restriktive Schreib-Policy
-- (site_*_write_restrict). Der Direktpfad über PostgREST ist damit schon zu;
-- neue Spalten auf einer Tabelle ohne Schreibrecht öffnen ihn nicht.
