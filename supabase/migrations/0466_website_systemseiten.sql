-- 0466 — Systemseiten: die Buchungsstrecke wird in der Seitenliste sichtbar.
--
-- ============================================================================
-- DER BEFUND
-- ============================================================================
-- Der Renderer liefert seit jeher mehr Seiten aus, als der Baukasten kennt:
--
--   /inserat/<id>            die Objekt-Detailseite (die Objekt-Karten
--                            verlinken dorthin, `listing-card.tsx`)
--   /checkout/<id>           die Buchung
--   /checkout/abgeschlossen  die Bestätigung
--   /blog, /blog/<slug>      der Blog (0438)
--
-- In `site_pages` stand davon NICHTS. Live gemessen am 25.08.2026:
-- `select page_type, count(*) from site_pages` → genau `normal|4`.
--
-- Die Folge ist keine Kleinigkeit. Die Seitenliste behauptet, die Website habe
-- vier Seiten; ausgeliefert wird die komplette Buchungsstrecke. Für sie gibt es
-- deshalb keinen SEO-Titel, keine Beschreibung, kein `noindex`, keinen Eintrag
-- in der Sitemap-Ansicht — und der Kunde erfährt nie, dass es sie gibt. Wer die
-- Objekt-Liste auf seine Startseite setzt, veröffentlicht damit stillschweigend
-- drei weitere Seiten.
--
-- ============================================================================
-- ENTSCHEIDUNG: Zeilen in `site_pages`, kein zweiter Ort
-- ============================================================================
-- Die naheliegende Alternative wäre eine eigene kleine Tabelle nur für die
-- SEO-Angaben der Systemseiten. Sie wurde verworfen: `site_pages` trägt bereits
-- `seo_title`, `seo_description`, `seo_keywords`, `canonical_url`, `noindex`,
-- `og_image_url`, `og_image_alt`, `head_html` und `languages`. Ein zweiter Ort
-- mit denselben Feldern hieße, jede SEO-Änderung an zwei Stellen zu pflegen und
-- die Reiter „SEO → Seiten" und „Sitemap" doppelt zu speisen — die zweite
-- Wahrheit, die spätestens beim nächsten Feld auseinanderläuft.
--
-- Was eine Systemseite von einer normalen unterscheidet, ist deshalb nicht die
-- Tabelle, sondern was man mit ihr tun darf:
--
--   * Sie wird nie angelegt und nie gelöscht — sie EXISTIERT, weil es die Route
--     gibt. Der Server legt sie bei Bedarf an (idempotent über den
--     `system_key`, Wurzel 2) und weist jedes Löschen ab.
--   * Ihr Slug ist der Pfad der Route und nicht änderbar. Ein umbenannter Slug
--     würde eine Seite beschreiben, die es nicht gibt.
--   * Sie hat KEINE Blöcke zum Anordnen. Ihr Inhalt ist die Anwendung selbst:
--     ein Objekt, ein Warenkorb, eine Bestätigung. Der Baukasten kann daran
--     ihre Auffindbarkeit bestimmen, nicht ihren Aufbau.
--
-- ============================================================================
-- WARUM `system_key` UND NICHT DER SLUG ALS KENNUNG
-- ============================================================================
-- Der Slug einer Systemseite ist ein Routen-MUSTER (`inserat/[id]`), keine
-- Adresse. Zwei Betriebe haben denselben; innerhalb eines Betriebs gibt es ihn
-- genau einmal. Der `system_key` ist die stabile Kennung, an der der Server sie
-- wiederfindet, auch wenn sich das Muster einer Route einmal ändert — dann
-- wandert der Slug, die Zeile mit ihren SEO-Angaben bleibt.

alter table public.site_pages
    drop constraint if exists site_pages_page_type_check;
alter table public.site_pages
    add constraint site_pages_page_type_check
    check (page_type in (
        'normal', 'external', 'folder', 'error404', 'popup', 'post', 'system'
    ));

alter table public.site_pages
    -- Stabile Kennung der Systemseite. NULL bei jeder anderen Seite.
    add column if not exists system_key text;

-- system_key und page_type gehören zusammen: eine Systemseite OHNE Kennung wäre
-- nicht wiederfindbar (der Server legte sie bei jedem Aufruf erneut an), eine
-- Kennung an einer normalen Seite wäre eine Zusage, die niemand einlöst.
alter table public.site_pages
    drop constraint if exists site_pages_system_key_check;
alter table public.site_pages
    add constraint site_pages_system_key_check
    check (
        (page_type = 'system' and system_key is not null)
        or (page_type <> 'system' and system_key is null)
    );

-- Der Backstop gegen doppelte Systemseiten. Er ist der eigentliche Grund, warum
-- das Anlegen idempotent sein KANN: zwei gleichzeitige Aufrufe der
-- Seitenliste (zwei Reiter, ein Doppelklick) laufen sonst beide durch die
-- Prüfung „gibt es schon?" und legen beide an. Mit dieser Bedingung verliert
-- der zweite mit 23505, statt eine zweite Zeile zu erzeugen (Wurzel 2).
create unique index if not exists site_pages_system_key_uniq
    on public.site_pages (tenant_id, system_key)
    where system_key is not null;

-- Systemseiten stehen in KEINER Navigation. Sie werden erreicht, indem der Gast
-- auf ein Objekt klickt oder bucht — ein Menüpunkt „Buchung" ohne gewähltes
-- Objekt führt ins Leere.
--
-- Das gilt auch für die bestehende Bedingung aus 0433: eine Systemseite darf
-- kein Elternteil haben und keines sein.
alter table public.site_pages
    drop constraint if exists site_pages_parent_typ_check;
alter table public.site_pages
    add constraint site_pages_parent_typ_check
    check (
        parent_id is null or page_type in ('normal', 'external')
    );
