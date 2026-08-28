-- 0471 — Die fehlenden Social-/Sonstiges-Widgets aus dem Hostaway-Vergleich
-- (`docs/HOSTAWAY-BWP-STAND.md`, Abschnitt „Widgets"): Social-Symbole,
-- Teilen-Knopf, WhatsApp, RSS-Feed, Facebook-Feed, HTML-Widget.
--
-- Sechs neue Abschnittstypen — kein einziger holt beim RENDERN etwas Fremdes
-- ungeprüft nach:
--   * `social_icons`, `share_button` — reine Links, kein Netzabruf.
--   * `whatsapp_chat` — ein `wa.me`-Link als schwebende Schaltfläche.
--   * `facebook_feed` — ein IFRAME auf Facebooks eigenem Page-Plugin, genau
--     wie `video`/`audio` schon einen Rahmen fremder Anbieter einbetten
--     (0451). Der Renderer baut die Adresse selbst aus einer geprüften
--     facebook.com-URL zusammen; die Kundeneingabe wandert nie direkt in ein
--     `src`.
--   * `rss_feed` — der Netzabruf läuft SERVERSEITIG über dieselbe SSRF-Härtung
--     wie der bestehende RSS-Import (`core/ausgehende_url.py`), mit einem
--     eigenen Zwischenspeicher (`site_rss_widget_cache`) — sonst würde jeder
--     Gast-Seitenaufruf einen Abruf beim fremden Feed auslösen (Wurzel 8:
--     teure/unbegrenzte Bereiche brauchen eine harte Kante).
--   * `html_widget` — Kundeneingabe, die beim SPEICHERN mit `nh3` gegen eine
--     Allowlist bereinigt wird (Wurzel 8), nicht per Regex.

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
        -- 0471
        'social_icons', 'share_button', 'whatsapp_chat', 'rss_feed',
        'facebook_feed', 'html_widget'
    ));

-- ============================================================================
-- Zwischenspeicher für den RSS-Feed-Abschnitt
-- ============================================================================
-- EIN globaler Cache über alle Betriebe, kein Ansatz je Tenant: derselbe
-- fremde Feed (z. B. ein News-Feed, den zwei Betriebe einbinden) wird sonst
-- doppelt abgerufen. Der Schlüssel ist die Feed-Adresse selbst, nicht die
-- Block- oder Tenant-ID — das ist eine bewusste Entscheidung, keine
-- Verkürzung: der Cache kennt keine Kundendaten, nur die zuletzt gesehene
-- öffentliche Antwort einer öffentlichen Adresse.
create table if not exists public.site_rss_widget_cache (
    id uuid primary key default gen_random_uuid(),
    -- SHA-256 der normalisierten Feed-Adresse. Nicht die Adresse selbst als
    -- Primärschlüssel: sie kann länger als ein Index-Feld sinnvoll ist, und
    -- der Hash ist stabil unabhängig von Groß-/Kleinschreibung im Query-Teil.
    feed_url_hash text not null unique,
    feed_url text not null,
    -- Die geparsten Einträge (Titel, Link, Datum, Anriss, Bild) — bereits
    -- bereinigt, NIE rohes fremdes HTML.
    items jsonb not null default '[]'::jsonb,
    fetched_at timestamptz not null default now(),
    -- Der letzte Fehler (nicht erreichbar, kein gültiges XML, …). Bleibt
    -- stehen, bis der nächste Abruf klappt — der Renderer zeigt dann lieber
    -- den ALTEN Stand als eine leere Fläche (`items` bleibt erhalten).
    last_error text
);

comment on table public.site_rss_widget_cache is
    'Zwischenspeicher für den RSS-Feed-Abschnitt (0471). Keine Kundendaten — '
    'nur zuletzt gesehene ÖFFENTLICHE Feed-Einträge. Ausschließlich vom '
    'Server gelesen/geschrieben (service_role); kein Tenant-Bezug.';

alter table public.site_rss_widget_cache enable row level security;

-- Wurzel 6: das ist ein reiner Server-Cache. Kein Tenant darf ihn lesen oder
-- schreiben — sonst könnte ein authenticated-Client mit dem anon-Key beliebige
-- Adressen als „Feed" eintragen (Cache-Poisoning) oder auslesen, welche
-- fremden Feeds andere Betriebe abonniert haben.
revoke all on public.site_rss_widget_cache from anon, authenticated;

create policy site_rss_widget_cache_service_only
    on public.site_rss_widget_cache
    as restrictive
    for all
    to anon, authenticated
    using (false)
    with check (false);
