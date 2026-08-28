-- 0450 — Basis-Widgets des Website-Baukastens
--
-- Hostaways „Booking Website Pro" führt rund 40 Abschnittstypen, wir hatten 17
-- (docs/HOSTAWAY-BWP-STAND.md, Abschnitt 3). Diese Migration öffnet den
-- DB-CHECK für die ersten acht der fehlenden — die Gruppe, die Hostaway
-- „Basis" nennt:
--
--   accordion    aufklappbare Abschnitte (KEIN FAQ-Schema — das macht `faq`)
--   tabs         Inhalte in Reitern, auf dem Telefon als Accordion
--   countdown    Zähler auf einen Zeitpunkt (ISO 8601 MIT Zeitzone)
--   table        Text-Tabelle, höchstens 150 Zeilen × 30 Spalten (Hostaways Zahlen)
--   list         vorformatierte Liste mit Bild, Text und Link je Eintrag
--   file         Dateien zum Herunterladen
--   copyright    Copyright-Zeile mit mitlaufendem Jahr
--   breadcrumbs  Pfad-Navigation aus der SEITENHIERARCHIE (nicht eingetippt)
--
-- KEINE neue Tabelle und keine neue Spalte: ein Abschnittstyp ist eine Zeile in
-- `site_blocks`, seine Felder stehen im bestehenden `content`-jsonb. Deshalb
-- gibt es hier auch nichts an RLS zu tun — `site_blocks` ist seit 0087
-- abgesichert, und diese Migration ändert daran nichts.
--
-- Der CHECK wird komplett neu gesetzt (drop + add) und nicht ergänzt: Postgres
-- kennt kein „add value to check". Die vollständige Liste steht deshalb genau
-- einmal, hier — `scripts/i18n/blocktypen-pruefen.mjs` liest sie aus der
-- HÖCHSTEN Migrationsnummer und vergleicht sie mit `BlockType`, den beiden
-- TypeScript-Unions, dem Katalog und dem Renderer.
--
-- ACHTUNG, HIER LIEGT EINE FALLE — und sie hat live schon zugeschlagen:
-- Weil jede Migration den CHECK VOLLSTÄNDIG neu schreibt, LÖSCHT die zuletzt
-- eingespielte alle Typen, die sie nicht selbst aufzählt. Am 25.08.2026 kam
-- 0458 (`search_posts`) nach dieser Migration in die Datenbank und setzte den
-- CHECK auf seine eigene Liste zurück — die acht Typen von hier waren danach
-- wieder verboten, ohne dass irgendwo ein Fehler stand. Sichtbar wurde es erst
-- beim Zurücklesen von `pg_get_constraintdef`.
--
-- Daraus folgt die Regel für JEDE künftige Migration an dieser Stelle: sie
-- zählt ALLE Typen auf, die es zu ihrem Zeitpunkt gibt — nicht nur die eigenen.
-- Deshalb steht `search_posts` unten mit in dieser Liste, obwohl es nicht zu
-- diesem Zug gehört: dieselbe Migration ein zweites Mal einzuspielen (Neuaufbau
-- der Datenbank, Wiederherstellung) darf keinen fremden Typ verlieren.
--
-- Warum ein CHECK und kein Enum (Entscheidung aus 0087, hier nur bestätigt):
-- ein neuer Typ ist damit ein `drop constraint`/`add constraint` in einer
-- Transaktion statt eines `alter type … add value`, das in Postgres nicht
-- zurückgerollt werden kann.

alter table public.site_blocks
    drop constraint if exists site_blocks_type_check;
alter table public.site_blocks
    add constraint site_blocks_type_check check (type in (
        -- Bestand (0087 … 0438)
        'hero', 'rich_text', 'image', 'gallery', 'button',
        'spacer', 'contact', 'search', 'properties_grid',
        'featured_properties', 'reviews', 'faq',
        'map', 'testimonials', 'features', 'form', 'posts',
        -- 0458 (Beitragssuche) — steht hier mit, siehe die Falle oben
        'search_posts',
        -- 0450: Basis
        'accordion', 'tabs', 'countdown', 'table', 'list',
        'file', 'copyright', 'breadcrumbs'
    ));

comment on constraint site_blocks_type_check on public.site_blocks is
    'Erlaubte Abschnittstypen des Website-Baukastens. Diese Liste ist der '
    'ANFANG der Kette: sie entscheidet, was gespeichert werden kann. Ein Typ, '
    'der hier steht und den das Pydantic-Enum BlockType nicht kennt, lässt '
    'JEDE Antwort an der Validierung zerbrechen — auch für Seiten, die vorher '
    'liefen. Geprüft wird das von scripts/i18n/blocktypen-pruefen.mjs.';
