-- 0426 — Website-Baukasten: Sprachen, Anzeige, Erweitert, Farbrollen, Logo-Text
--
-- Schließt die Lücke zum Branchenstandard (live abgelesen bei Lodgify am
-- 23.08.2026: /settings/languages, /settings/display, /settings/advanced,
-- /rentals, /external-widgets, /styles mit sechs Farbrollen).
--
-- Was hier NICHT entsteht, weil es schon existiert:
--   · SEO je Seite  → site_pages.seo_title / seo_description / og_image_url
--   · Objekt-Auswahl → properties.listed_on_website
--   · Externe Widgets → rein clientseitiger Code-Generator, kein Zustand
--
-- Wurzel 4: alle neuen Text-/Farbspalten sind NULL-fähig ohne Default. NULL heißt
-- „nie gewählt", und der Renderer entscheidet dann. Ein plausibler Startwert
-- (etwa ein Header-Weiß) wäre eine erfundene Kundenentscheidung.
-- Die BOOLEANS sind die Ausnahme: ein Schalter hat keinen dritten Zustand, und
-- „aus" ist bei jedem von ihnen der zurückhaltende (kein Banner, kein Code, nicht
-- offline). Deshalb NOT NULL DEFAULT mit dem harmlosen Wert.
--
-- Wurzel 6: tenant_site_config trägt bereits `revoke insert, update, delete`
-- (0337) und eine restriktive Tenant-Policy. Der Schreibpfad ist damit auch für
-- die neuen Spalten geschlossen — insbesondere für head_html/custom_js, die im
-- Gast-Browser ausgeführt werden. `select` bleibt offen (das Realtime-Abo der
-- Design-Ansicht hängt daran); eigenen Code lesen zu können ist kein Schaden.

-- == 1) Sprachen der Website (Lodgify: /settings/languages) ==================
-- Welche Sprachen die Kunden-Website führt, und welche davon die Standardsprache
-- ist. Beides gehört zusammen an die Site, nicht an die Seite: ein Sprachwähler
-- in der Kopfzeile wäre sonst je Seite anders bestückt.
--
-- text[] und keine eigene Tabelle: es ist eine kurze, geordnete Liste von
-- Sprachcodes ohne eigene Eigenschaften. Eine Zuordnungstabelle bräuchte eine
-- position-Spalte und einen Gegenzustand beim Löschen — für nichts.
alter table public.tenant_site_config
    add column if not exists languages text[],
    add column if not exists default_language text;

-- Die Standardsprache MUSS in der Sprachliste stehen. Ohne diese Bedingung
-- entstünde eine Site, deren Standardsprache sie selbst nicht führt — der
-- Renderer fiele auf die erste vorhandene zurück und der Kunde sähe eine andere
-- Sprache als eingestellt, ohne Fehlermeldung.
alter table public.tenant_site_config
    drop constraint if exists tenant_site_config_default_language_in_list;
alter table public.tenant_site_config
    add constraint tenant_site_config_default_language_in_list check (
        default_language is null
        or (languages is not null and default_language = any (languages))
    );

-- Sprachen je Seite: eine Seite kann in einer Sprache fehlen (die dänische
-- „Om os" existiert, die deutsche noch nicht). NULL = „gilt in allen Sprachen
-- der Site" — das ist der Normalfall und braucht keinen Eintrag.
alter table public.site_pages
    add column if not exists languages text[];

-- == 2) Anzeigeeinstellungen (Lodgify: /settings/display) ====================
-- Zwei Schalter, die das Sucheingabe- und Preisverhalten der Gast-Seite steuern.
alter table public.tenant_site_config
    -- Gästezahl getrennt nach Erwachsene/Kinder/Kleinkinder/Tiere erfragen,
    -- statt einer einzigen Zahl.
    add column if not exists show_guest_breakdown boolean not null default true,
    -- Übernachtungspreis schon VOR der Datumswahl zeigen. Aus heißt: der Preis
    -- erscheint erst, wenn Anreise/Abreise gewählt sind.
    add column if not exists show_base_prices boolean not null default true;

-- == 3) Fortgeschritten (Lodgify: /settings/advanced) =======================
-- Code-Injection. Das ist bewusst ein Loch in der eigenen Seite, und der Kunde
-- öffnet es selbst — der Zweck ist Google-Site-Verification, ein
-- Analytics-Schnipsel, eine Schrift von einem eigenen Server.
--
-- Aufteilung und Schutz:
--   · head_html  → NUR <meta>, <link>, <title> (nh3-Allowlist im Schema). Kein
--                  <script>: dafür gibt es custom_js. Wäre <script> hier
--                  erlaubt, wäre dieses Feld der Weg, an der Checkout-Trennung
--                  unten vorbei ein Skript in die Zahlungsstrecke zu bekommen.
--   · head_css   → in ein <style>. CSS kann keinen Code ausführen.
--   · custom_js  → auf allen öffentlichen Seiten AUSSER der Zahlungsstrecke.
--   · checkout_js→ NUR auf der Bestätigungsseite nach der Zahlung. Genau dort
--                  gehört ein Conversion-Pixel hin, und nur dort.
--
-- Was hier NICHT schützt, und warum das so bleibt: eine CSP-Nonce. Die CSP der
-- Builder-App führt `script-src 'self' 'unsafe-inline'`, weil Next 15 im App
-- Router Inline-Bootstrap-Skripte einhängt. Sobald eine Nonce in der Direktive
-- steht, IGNORIERT der Browser `unsafe-inline` — und genau diese
-- Bootstrap-Skripte brächen. Eine Nonce daneben zu schreiben wäre also eine
-- Schutzbehauptung ohne Wirkung.
--
-- Der wirkliche Schutz liegt woanders und hält:
--   1. Wer schreiben darf, braucht MANAGE_SITE_CONFIG — dieselbe Schwelle wie
--      für die eigene Domain. Der Betrieb öffnet sein eigenes Fenster.
--      Der DB-Direktpfad ist für `authenticated` per 0337 zu.
--   2. In der Zahlungsstrecke läuft KEIN Kundencode (siehe Aufteilung oben).
--   3. Kartendaten liegen in Stripe-eigenen iframes auf Stripes Origin; Code
--      der Kundenseite kommt nicht an sie heran.
alter table public.tenant_site_config
    add column if not exists head_html text,
    add column if not exists head_css text,
    add column if not exists custom_js text,
    add column if not exists checkout_js text;

-- Cookie-Banner und Datenschutz-Zustimmung, jeweils mit der Seite, auf die der
-- Text verweist.
--
-- `on delete set null`: wird die verlinkte Seite gelöscht, verliert der Schalter
-- sein Ziel — er darf dann nicht auf eine gelöschte ID zeigen (Wurzel 1: der
-- Gegenzustand wird mitgepflegt). Der Banner bleibt an, zeigt aber keinen Link
-- mehr; das ist sichtbar und behebbar, im Gegensatz zu einem toten Verweis.
alter table public.tenant_site_config
    add column if not exists cookie_banner boolean not null default false,
    add column if not exists cookie_policy_page_id uuid
        references public.site_pages(id) on delete set null,
    add column if not exists privacy_consent boolean not null default false,
    add column if not exists privacy_policy_page_id uuid
        references public.site_pages(id) on delete set null;

-- Website offline nehmen: für Besucher und Suchmaschinen unerreichbar.
-- Getrennt von `site_pages.is_published`: das ist die Freigabe EINER Seite,
-- dies der Hauptschalter der ganzen Site. Ohne die Trennung müsste man beim
-- Offline-Nehmen jede Seite anfassen und beim Zurückschalten raten, welche
-- vorher veröffentlicht war.
alter table public.tenant_site_config
    add column if not exists is_offline boolean not null default false;

-- == 4) Farbrollen (Lodgify: /styles, sechs Rollen) =========================
-- Bisher gab es vier (primär, Hintergrund, Schrift, Fläche). Kopfzeile und
-- Fußzeile hatten keine eigene Farbe und übernahmen den Seitenhintergrund —
-- damit war ein dunkler Header auf hellem Grund unmöglich, der häufigste Wunsch
-- überhaupt.
alter table public.tenant_site_config
    add column if not exists brand_name_color text,
    add column if not exists header_background text,
    add column if not exists header_link_color text,
    add column if not exists link_color text,
    add column if not exists footer_background text;

-- Alle Farben sind #rrggbb oder NULL. Die Prüfung gehört in die DB und nicht nur
-- ins Pydantic-Schema: über den PostgREST-Direktpfad (service_role) käme sonst
-- ein „red" oder ein `javascript:`-Rest durch und landete in einem style-Attribut.
alter table public.tenant_site_config
    drop constraint if exists tenant_site_config_neue_farben_hex;
alter table public.tenant_site_config
    add constraint tenant_site_config_neue_farben_hex check (
        (brand_name_color   is null or brand_name_color   ~ '^#[0-9a-fA-F]{6}$')
        and (header_background  is null or header_background  ~ '^#[0-9a-fA-F]{6}$')
        and (header_link_color  is null or header_link_color  ~ '^#[0-9a-fA-F]{6}$')
        and (link_color         is null or link_color         ~ '^#[0-9a-fA-F]{6}$')
        and (footer_background  is null or footer_background  ~ '^#[0-9a-fA-F]{6}$')
    );

-- == 5) Logo-Bereich (Lodgify: /styles/logo) ================================
-- Der Firmenname in der Kopfzeile ist eigene Typografie, nicht die
-- Überschriftenschrift: er steht neben dem Logo und muss dazu passen, nicht zu
-- den Überschriften im Text. Der Slogan liegt bereits in `tagline`.
alter table public.tenant_site_config
    add column if not exists logo_name_font text,
    add column if not exists logo_name_size smallint,
    add column if not exists slogan_font text,
    -- Ziel des Logo-Klicks. Normalerweise die Startseite; ein Betrieb mit
    -- mehreren Sites zeigt damit auf die Hauptseite.
    add column if not exists logo_link_url text;

alter table public.tenant_site_config
    drop constraint if exists tenant_site_config_logo_name_size_bereich;
alter table public.tenant_site_config
    add constraint tenant_site_config_logo_name_size_bereich check (
        logo_name_size is null or logo_name_size between 8 and 48
    );

comment on column public.tenant_site_config.languages is
    'Sprachen der Kunden-Website (ISO-Codes). NULL = noch nicht gewählt.';
comment on column public.tenant_site_config.custom_js is
    'Kunden-JavaScript auf allen oeffentlichen Seiten AUSSER der Zahlungsstrecke.';
comment on column public.tenant_site_config.checkout_js is
    'Kunden-JavaScript NUR auf der Bestaetigungsseite nach der Zahlung.';
comment on column public.tenant_site_config.is_offline is
    'Hauptschalter: true = ganze Website fuer Besucher und Suchmaschinen zu.';
comment on column public.site_pages.languages is
    'Sprachen, in denen DIESE Seite existiert. NULL = alle Sprachen der Site.';
