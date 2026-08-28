-- 0479 — Mediathek: alle Medienarten (Bilder · Symbole · Videos · Audio · Dateien)
--
-- WARUM
-- =====
-- Die Mediathek war eine BILDERmediathek: Bucket-Allowlist, Magic-Byte-Prüfung
-- und Oberfläche kannten JPEG, PNG und WebP. Der Media Manager, an dem der
-- Baukasten gemessen wird, führt fünf Reiter — Images · Icons · Videos · Audio ·
-- Files — und derselbe Bestand trägt alle fünf.
--
-- Fünf Arten in EINER Tabelle und nicht fünf Tabellen: Ordner, Alt-Text,
-- Verwendungsnachweis, Ersetzen, Bestandsgrenze und Tenant-Scope gelten für
-- jede Art gleich. Eine zweite Tabelle wäre ein zweiter Ort, an dem man den
-- Scope vergisst (Wurzel 3), und ein zweiter Ordnerbaum, den niemand pflegt.
--
-- `kind` und nicht „aus dem MIME ableiten": die Oberfläche filtert und zählt
-- nach Art (der Reiter IST der Filter, die Zahl in der linken Spalte kommt aus
-- derselben Frage). Eine Ableitung `mime like 'image/%'` müsste an jeder
-- Abfrage- und Anzeigestelle erneut stimmen; sobald eine Stelle sie anders
-- schreibt, zählt die Spalte etwas anderes als der Filter zeigt. Der Check
-- unten hält Art und MIME zusammen, damit die Spalte nicht auseinanderlaufen
-- kann.
--
-- SVG bleibt VERBOTEN als Upload — ein SVG im öffentlichen Bucket ist
-- Stored-XSS (Wurzel 8). Symbole kommen deshalb wie Stock-Fotos als HOTLINK
-- (Iconify), ohne Datei bei uns: `path is null`, dafür Nachweis + Kennung.
-- Genau diesen Fall deckt der Constraint `site_media_herkunft_stimmig` aus
-- 0461 schon ab; hier kommt nur der Herkunftswert dazu.

-- == 1. Die Art ==============================================================
alter table public.site_media
    add column if not exists kind text not null default 'image';

-- Bestand: alles, was es bis hier gibt, ist ein Bild (die Allowlist ließ
-- nichts anderes zu). Ausdrücklich gesetzt und nicht dem Default überlassen —
-- ein Default gilt für neue Zeilen, nicht für die 65 vorhandenen.
update public.site_media set kind = 'image' where kind is null or kind = '';

alter table public.site_media drop constraint if exists site_media_kind_check;
alter table public.site_media drop constraint if exists site_media_art_erlaubt;
alter table public.site_media
    add constraint site_media_art_erlaubt check (
        kind in ('image', 'icon', 'video', 'audio', 'file')
    );

-- Art und MIME dürfen nicht auseinanderlaufen. Ohne diesen Check wäre
-- `kind='audio', mime='image/png'` eine gültige Zeile — die Kachelwand würde
-- ein <audio>-Element für ein PNG bauen, und der Fehler stünde in den Daten,
-- nicht im Code (Wurzel 4: keine Lücke, die später jemand plausibel füllt).
alter table public.site_media drop constraint if exists site_media_art_passt_zum_mime;
alter table public.site_media
    add constraint site_media_art_passt_zum_mime check (
        case kind
            when 'image' then mime like 'image/%' and mime <> 'image/svg+xml'
            -- Symbole sind Vektoren und liegen NICHT bei uns (Hotlink).
            when 'icon' then mime = 'image/svg+xml'
            when 'video' then mime like 'video/%'
            when 'audio' then mime like 'audio/%'
            -- Dokumente: application/*, plus die OOXML-Typen, die ebenfalls
            -- application/* sind. Kein `like '%'`, sonst wäre die Spalte frei.
            when 'file' then mime like 'application/%'
        end
    );

comment on column public.site_media.kind is
    'Medienart: image | icon | video | audio | file. Der Reiter der Oberfläche '
    'IST dieser Filter; die Zähler der linken Spalte zählen dieselbe Spalte. '
    'Bleibt per Check mit `mime` deckungsgleich (0479).';

create index if not exists site_media_tenant_kind_idx
    on public.site_media (tenant_id, kind);

-- == 2. Iconify als Herkunft =================================================
-- Symbole kommen von Iconify (api.iconify.design): Hotlink auf die SVG-Adresse
-- des Symbolsatzes, dazu Satzname und Lizenz-Adresse als Nachweis. Damit
-- greift derselbe Zweig von `site_media_herkunft_stimmig`, der für Stock-Fotos
-- gilt — Nachweis und Kennung sind Pflicht, `path` bleibt leer.
--
-- Der Constraint wurde in 0461 INLINE an der Spalte angelegt und heißt deshalb
-- `site_media_source_check`. Er wird hier ersetzt, nicht erweitert: eine
-- zweite Bedingung neben der ersten wäre eine, die niemand findet.
alter table public.site_media drop constraint if exists site_media_source_check;
alter table public.site_media drop constraint if exists site_media_herkunft_erlaubt;
alter table public.site_media
    add constraint site_media_herkunft_erlaubt check (
        source in ('upload', 'unsplash', 'pexels', 'iconify')
    );

comment on column public.site_media.source is
    'Herkunft: upload (Datei im Bucket) | unsplash | pexels | iconify '
    '(Hotlink, kein Rehosting — bei den Stock-Anbietern Vorgabe, bei Iconify '
    'weil ein SVG im öffentlichen Bucket Stored-XSS wäre). Shutterstock fehlt '
    'bewusst: braucht Abo und AGB-Erweiterung (0461/0479).';

-- == 3. Bucket: die neuen Dateitypen =========================================
-- ZWEITER Riegel, nicht der erste: der erste ist die Magic-Byte-Prüfung im
-- Upload-Endpunkt (`medien.datei_typ`). Der vom Client behauptete content_type
-- ist frei wählbar und schützt nichts.
--
-- Was NICHT drinsteht und warum:
--   • image/svg+xml — Stored-XSS im öffentlichen Bucket (siehe oben).
--   • image/gif — bringt nichts für Objektfotos, zusätzliche Decoder-CVEs.
--   • text/plain, text/csv — haben KEINE Signatur. Was wir nicht am Byte
--     erkennen können, laden wir nicht (fail-closed, Wurzel 5).
--   • video/quicktime (.mov) — dieselbe ftyp-Familie wie MP4, aber Apple-
--     spezifische Codecs, die kein Browser zuverlässig abspielt. Ein Upload,
--     der lautlos nicht abspielbar ist, ist schlechter als eine Ablehnung.
--
-- Das Größenlimit steigt auf 200 MB: 20 MB reichen für ein Foto, nicht für ein
-- Video. Es ist das Limit des Buckets; der Dienst deckelt je Art enger
-- (`MEDIA_MAX_BYTES`), weil ein 200-MB-Bild kein Bild ist.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'site-media',
    'site-media',
    true,
    209715200,  -- 200 MB
    array[
        'image/jpeg', 'image/png', 'image/webp',
        'video/mp4', 'video/webm',
        'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg',
        'application/pdf',
        'application/zip',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ]
)
on conflict (id) do update set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

comment on constraint site_media_art_passt_zum_mime on public.site_media is
    'Art und MIME bleiben deckungsgleich. Ohne diesen Check wäre '
    'kind=audio/mime=image/png eine gültige Zeile, und der Fehler stünde in '
    'den Daten statt im Code (0479).';
