-- ============================================================================
-- 0474 — Die Buchungsstrecke wird gestaltbar
-- ============================================================================
--
-- DER BEFUND
-- ==========
-- Seit 0466 führt die Seitenliste die Buchungsstrecke als „Systemseiten":
-- `checkout/[id]`, `checkout/abgeschlossen` und `blog`. Sie waren dort
-- ANSEHBAR, aber nicht gestaltbar — ein Klick öffnete nur die SEO-Felder, weil
-- sie keine Blöcke hatten. Ihr Aussehen stand fest im Renderer.
--
-- Für die Objektseite war genau das schon einmal der Fehler. 0468 hat sie
-- deshalb aus den Systemseiten herausgelöst und zur dynamischen Seite gemacht,
-- mit der Begründung: „Sie ist die Seite, auf der gebucht wird; sie ist der
-- eigentliche Wert des Baukastens für einen Vermieter. Eine Seite, die man
-- nicht gestalten kann, nimmt ihm genau das weg."
--
-- Dasselbe Argument gilt für den Checkout, und dort wiegt es schwerer: er ist
-- der letzte Schritt vor dem Geld. Wer keinen eigenen Vertrauens-Hinweis,
-- keinen eigenen Ton und keine eigene Reihenfolge setzen kann, verkauft mit
-- einer fremden Seite.
--
-- Beim BLOG kam der Widerspruch aus der eigenen Oberfläche: das Blog-CMS führt
-- einen Menüpunkt „Layouts", der ausdrücklich in den Editor der
-- Blog-Übersichtsseite springt und ihre Bausteine („Alle Beiträge",
-- „Beitragssuche") als das Layout bezeichnet. Diese Bausteine gab es an der
-- Seite nie — der Menüpunkt zeigte auf eine Seite, die man nicht öffnen konnte.
--
-- WAS DIESE MIGRATION TUT
-- =======================
--   1. Vier neue Bausteintypen für `site_blocks.type`.
--   2. Nichts weiter. Die Seiten bleiben `page_type = 'system'`.
--
-- WARUM DIE SEITEN `system` BLEIBEN
-- =================================
-- Der naheliegende Griff wäre, sie auf `normal` zu setzen, damit die
-- Oberfläche sie wie jede Seite behandelt. Das wäre falsch: `page_type` sagt,
-- WER die Seite verantwortet, nicht ob man sie gestalten darf. Als `normal`
-- wären sie löschbar, umbenennbar und ihr Slug wäre frei — und ihr Slug ist das
-- MUSTER einer Renderer-Route. Ein Betrieb, der seine Checkout-Seite löscht
-- oder auf `/kontakt` umbenennt, hätte eine Route, die weiter antwortet, und
-- eine Seite, die nicht mehr dazu passt.
--
-- Gestaltbarkeit und Löschbarkeit sind also zwei Achsen. 0468 hat dafür schon
-- die dritte Form eingeführt (`dynamic`): gestaltbar, aber nicht löschbar. Die
-- Systemseiten werden hier genauso behandelt — die Sperre bleibt, was wegfällt
-- ist nur die Annahme „hat keine Blöcke". Diese Annahme stand ausschließlich in
-- der Oberfläche und in der Doku, nie in einer Bedingung: `site_blocks` hat
-- nie geprüft, an welchem `page_type` ein Block hängt. Es gibt hier deshalb
-- keine Sperre zu lösen.
--
-- WAS NICHT PASSIERT: EINSAAT
-- ===========================
-- Diese Migration legt KEINE Blöcke an. Aus demselben Grund, aus dem 0466 die
-- Systemseiten nicht eingesät hat: eine Migration bedenkt die HEUTIGEN Betriebe
-- und keinen der morgen angelegten. Die Blöcke entstehen, wenn der Betrieb im
-- Baukasten eine Strecken-Vorlage wählt; bis dahin liefert der Renderer sein
-- eingebautes Layout aus, genau wie er es bei der Objektseite ohne Vorlage tut.
--
-- Das ist zugleich der Grund, warum niemand vor einer leeren Buchungsstrecke
-- steht: „keine Blöcke" heißt im Renderer nicht „leere Seite", sondern
-- „eingebautes Layout" (`ladeObjektVorlage`-Muster, builder/lib/site.ts).

-- ============================================================================
-- Bausteintypen
-- ============================================================================
-- Vollständig neu gesetzt (drop + add), nicht ergänzt: ein CHECK lässt sich
-- nicht erweitern. Gültig ist damit immer der aus der höchsten
-- Migrationsnummer — worauf sich `scripts/i18n/blocktypen-pruefen.mjs`
-- ausdrücklich verlässt.
--
-- Die vier neuen stehen am Ende mit ihrer Nummer, wie bei 0471.
alter table public.site_blocks
    drop constraint if exists site_blocks_type_check;
alter table public.site_blocks
    add constraint site_blocks_type_check
    check (type in (
        'hero', 'rich_text', 'image', 'gallery', 'button', 'spacer', 'contact',
        'search', 'properties_grid', 'featured_properties', 'reviews', 'faq',
        'map', 'testimonials', 'features', 'form', 'posts', 'accordion', 'tabs',
        'countdown', 'table', 'list', 'file', 'copyright', 'breadcrumbs',
        'media_slider', 'video', 'audio', 'before_after', 'shape',
        'business_hours', 'click_to_call', 'click_to_email', 'multi_location',
        'search_posts',
        'property_book_form', 'property_gallery', 'property_description',
        'property_amenities', 'property_map',
        'social_icons', 'share_button', 'whatsapp_chat', 'rss_feed',
        'facebook_feed', 'html_widget',
        -- 0472
        'container',
        -- 0474 — die Buchungsstrecke
        --
        -- `checkout_form` ist der PFLICHT-Baustein der Buchungsseite: ohne ihn
        -- kann niemand buchen. Erzwungen wird das im Service
        -- (`bloecke.py`) und nicht hier, und das ist eine bewusste
        -- Entscheidung: eine DB-Bedingung „mindestens ein checkout_form je
        -- Buchungsseite" müsste beim LÖSCHEN eines anderen Blocks zählen, also
        -- ein Trigger sein. Ein Trigger, der beim Auswerten seiner eigenen
        -- Bedingung wirft, legt jede Änderung an `site_blocks` lahm — genau der
        -- Schaden vom 23.08.2026 (0418→0424). Die Regel gehört an die EINE
        -- Stelle, die löscht, mit einer Fehlermeldung, die den Grund nennt.
        'checkout_form', 'checkout_summary', 'checkout_result', 'post_list'
    ));

comment on constraint site_blocks_type_check on public.site_blocks is
    'Bausteintypen des Website-Baukastens. Eine von SIEBEN Stellen, die '
    'deckungsgleich bleiben müssen — geprüft von '
    'scripts/i18n/blocktypen-pruefen.mjs.';
