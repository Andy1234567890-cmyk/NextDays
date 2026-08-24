-- 0432 — Drei Abschnitts-Typen: Karte, Gästestimmen, Merkmale
--
-- Die drei, die auf fast jeder Unterkunfts-Website stehen und für die der
-- Betrieb bisher Rich-Text missbrauchen musste. Abgeleitet aus dem Abgleich mit
-- Hostaway „Booking Website Pro" (docs/WEBSITE-BAUKASTEN-PLAN.md, Etappe A) —
-- dort sind es die Widgets Map, Media Slider (als Testimonial-Slider dokumentiert)
-- und List.
--
--   · map          Lage des Betriebs oder eines Objekts.
--   · testimonials Frei eingetippte Gästestimmen. NICHT zu verwechseln mit
--                  `reviews` (0266): das zeigt echte, verifizierte
--                  myBestDays-Bewertungen aus der Datenbank. Hier geht es um
--                  Zitate aus dem Gästebuch, aus der Presse, aus einer E-Mail —
--                  Inhalte, die es in unseren Daten nicht gibt und die deshalb
--                  eingetippt werden. Zwei Abschnitte, weil es zwei Wahrheiten
--                  sind: die eine ist belegt, die andere behauptet.
--   · features     „Was wir bieten": Symbol + Überschrift + Text, 2–4 Spalten.
--
-- Der Blocktyp steht als CHECK und nicht als Enum (0087) — genau dafür. Die
-- vorherige Liste stammt aus 0431.

alter table public.site_blocks
    drop constraint if exists site_blocks_type_check;

alter table public.site_blocks
    add constraint site_blocks_type_check check (type in (
        'hero', 'rich_text', 'image', 'gallery', 'button',
        'spacer', 'contact', 'search', 'properties_grid',
        'featured_properties', 'reviews', 'faq',
        'map', 'testimonials', 'features'
    ));

-- Kein neues Feld: die Inhalte liegen in `content` wie bei jedem anderen Block.
-- Auch das Hintergrundbild je Abschnitt (Etappe A) braucht keine Spalte — es
-- gehört in `settings`, das für ALLE Typen gleich ist und schon als jsonb
-- vorliegt. Eine eigene Spalte dafür wäre eine zweite Wahrheit neben
-- `background_color`, das ebenfalls dort steht.
--
-- Erzwungen wird beides im Backend-Schema (`site_config/schemas.py`):
-- `MapContent`/`TestimonialsContent`/`FeaturesContent` und
-- `BlockSettings.background_image_url` mit derselben href-Allowlist wie jedes
-- andere gast-sichtbare Bild (Wurzel 8).
