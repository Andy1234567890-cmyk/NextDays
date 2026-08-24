-- 0431 — Blocktyp „faq" für den Page-Builder
--
-- Ein Frage-Antwort-Abschnitt. Zwei Gründe, und der zweite ist der wichtigere:
--
-- 1) Fast jede Unterkunfts-Website hat einen. Bisher musste der Betrieb ihn als
--    Rich-Text nachbauen — als Liste ohne Aufklappen, ohne Struktur.
--
-- 2) Ohne ihn wäre der Schalter „Fragen und Antworten" unter SEO → Strukturierte
--    Daten (0430) eine ATTRAPPE. Er verspricht ein `FAQPage`-JSON-LD, und das
--    entsteht nur aus einem Block, der Fragen und Antworten getrennt führt. Aus
--    einem Rich-Text-Absatz lässt sich nicht ableiten, was Frage und was Antwort
--    ist — jeder Versuch wäre Raten (Wurzel 4).
--    Was das bringt: Google zeigt für eine gültige `FAQPage` die Fragen direkt
--    im Suchergebnis, aufklappbar. Das ist die einzige Rich-Result-Form, die
--    eine Textseite ohne Preis und ohne Bewertung überhaupt erreichen kann.
--
-- Der Blocktyp steht als CHECK und nicht als Enum (0087) — genau dafür:
-- erweitern ohne `alter type`. Die vorherige Liste stammt aus 0266.

alter table public.site_blocks
    drop constraint if exists site_blocks_type_check;

alter table public.site_blocks
    add constraint site_blocks_type_check check (type in (
        'hero', 'rich_text', 'image', 'gallery', 'button',
        'spacer', 'contact', 'search', 'properties_grid',
        'featured_properties', 'reviews', 'faq'
    ));

-- Kein neues Feld und keine neue Tabelle: die Fragen liegen in `content` wie bei
-- jedem anderen Block, als Liste von `{question, answer}` mit Locale-Maps. Das
-- Schema dazu erzwingt das Backend (`FaqContent` in site_config/schemas.py) —
-- inklusive einer Obergrenze, damit ein Abschnitt nicht unbegrenzt wächst
-- (Wurzel 8).
