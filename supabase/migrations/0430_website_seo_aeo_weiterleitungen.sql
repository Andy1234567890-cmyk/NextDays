-- 0430 — Website-Baukasten: SEO/AEO site-weit, SEO je Seite, URL-Weiterleitungen
--
-- Abgelesen an Hostaway „Booking Website Pro" (Support-Doku, 24.08.2026):
-- SEO/AEO-Bereich mit Zusatz-Einstellungen (site-weites noindex, Meta-Titel,
-- Meta-Beschreibung, Keywords), Seiten-SEO mit eigener Hierarchie („die
-- Seiten-Einstellung schlägt die Site-Einstellung"), Schema-Markup,
-- Core-Web-Vitals-Schalter (Lazy-Loading, System-Schriften zuerst),
-- Google-Tag-Einbindung und URL-Weiterleitungen mit 301/302.
--
-- WAS WIR VORHER HATTEN: nur `site_pages.seo_title/seo_description/og_image_url`
-- (0087). Es gab also SEO je Seite, aber
--   · keinen site-weiten Rückfall → jede neue Seite startete ohne Meta-Angaben,
--   · kein `noindex` → eine Baustellen-Site war nicht aus dem Index zu halten,
--   · keine sitemap.xml, keine robots.txt, kein JSON-LD (Renderer erzeugt sie
--     ab jetzt aus diesen Feldern; kein Zustand nötig),
--   · keine Weiterleitungen → jeder Domain-Umzug verlor die Platzierung.
--
-- Wurzel 4: alle Text-Spalten NULL-fähig ohne Default. NULL heißt „nie gesetzt";
-- ein erfundener Meta-Titel wäre eine Kundenaussage, die niemand getroffen hat.
-- Die BOOLEANS haben keinen dritten Zustand, deshalb NOT NULL DEFAULT:
--   · `noindex` = false — nicht indexieren ist der Eingriff, nicht der Normalfall.
--   · `lazy_loading` = true — Google wertet Core Web Vitals; wer das abschaltet,
--     tut es absichtlich. Der Schalter existiert, weil Lazy-Loading bei
--     Inhalten über der Falz die LCP VERSCHLECHTERT.
--   · `system_fonts_first` = TRUE, und das ist keine Vorliebe: der Renderer
--     lädt seine Schriften heute schon mit `display=swap` (fonts-catalog.ts),
--     also ist genau dieses Verhalten der Ist-Zustand JEDER bestehenden
--     Kundenseite. Ein Default `false` hätte den Schalter zwar „zurückhaltend"
--     gemacht, aber beim ersten Deploy das Verhalten aller Live-Seiten
--     umgestellt: der Text wäre bis zu drei Sekunden unsichtbar (FOIT) statt in
--     der Systemschrift lesbar. Ein neues Feld darf keinen bestehenden Zustand
--     still ändern (Wurzel 1) — der Default ist deshalb das, was heute gilt.
--   · `schema_*` = true — anders als head_html ist das KEIN Kundencode: der
--     Renderer baut das JSON-LD aus geprüften eigenen Feldern (Firmenprofil,
--     Objektdaten). Es kann nichts ausführen und nichts leaken; ein Standard
--     „aus" hieße nur, dass 99 % der Kunden ohne strukturierte Daten laufen.
--
-- Wurzel 6: `tenant_site_config` trägt `revoke insert, update, delete` (0337)
-- plus restriktive Tenant-Policy — der Schreibpfad ist auch für die neuen
-- Spalten dicht. `site_redirects` ist NEU und bekommt beides von Hand: eine
-- Weiterleitung ist eine Umlenkung fremden Gast-Verkehrs, also ein Ziel für
-- Manipulation (Phishing über die Kundendomain). Nur der Server darf schreiben.

-- == 1) SEO/AEO site-weit ===================================================
-- Der Rückfall für jede Seite ohne eigene Angabe. Die Hierarchie steckt NICHT
-- in der DB, sondern im Resolver: `coalesce(page.seo_title, site.seo_title)`.
-- Sie hier per Trigger zu materialisieren wäre ein Gegenzustand mehr (Wurzel 1)
-- — ändert der Betrieb den Site-Titel, müssten alle Seiten nachgezogen werden.
alter table public.tenant_site_config
    add column if not exists seo_title text,
    add column if not exists seo_description text,
    add column if not exists seo_keywords text,
    add column if not exists noindex boolean not null default false;

comment on column public.tenant_site_config.seo_title is
    'Site-weiter Meta-Titel. Rückfall für Seiten ohne eigenen seo_title.';
comment on column public.tenant_site_config.seo_description is
    'Site-weite Meta-Beschreibung. Rückfall für Seiten ohne eigene.';
comment on column public.tenant_site_config.seo_keywords is
    'Kommagetrennte Keywords. Große Suchmaschinen werten sie nicht mehr; '
    'das Feld existiert für kleinere Verzeichnisse und Altbestand.';
comment on column public.tenant_site_config.noindex is
    'true = die GANZE Website aus dem Suchindex halten (robots.txt disallow + '
    'meta robots noindex auf jeder Seite). Für Sites im Aufbau.';

-- == 2) Google-Tag ==========================================================
-- EIN Feld für alle vier Google-Kennungen (Analytics G-, Altbestand UA-, Ads
-- AW-, Campaign-Manager DC-), weil das gtag.js-Snippet für alle dasselbe ist.
-- Der Check ist absichtlich streng: der Wert landet als Skript-Parameter in
-- jeder Kundenseite. Ein ungeprüfter String an dieser Stelle ist eine
-- Einbahnstraße in fremdes JavaScript (Wurzel 8).
alter table public.tenant_site_config
    add column if not exists gtag_id text;

alter table public.tenant_site_config
    drop constraint if exists tenant_site_config_gtag_id_format;
alter table public.tenant_site_config
    add constraint tenant_site_config_gtag_id_format check (
        gtag_id is null or gtag_id ~ '^(G|UA|AW|DC)-[A-Za-z0-9-]{4,24}$'
    );

comment on column public.tenant_site_config.gtag_id is
    'Google-Tag-Kennung (G-/UA-/AW-/DC-). Format erzwungen, weil der Wert in '
    'ein <script src> jeder Gast-Seite geschrieben wird.';

-- == 3) Strukturierte Daten (JSON-LD) =======================================
-- Vier Schalter statt eines: die Typen haben verschiedene Quellen und
-- verschiedene Risiken einer Falschaussage.
--   · organization  → Firmenprofil des Betriebs (Name, Anschrift, Telefon)
--   · breadcrumbs   → Seitenpfad, immer korrekt
--   · lodging       → je Objektseite: LodgingBusiness + Offer mit echtem Preis
--   · faq           → nur aus einem FAQ-Block der Seite
-- Wer keine Anschrift gepflegt hat, bekommt kein Organization-Schema — der
-- Renderer lässt es weg statt „Adresse unbekannt" auszuliefern (Wurzel 4).
alter table public.tenant_site_config
    add column if not exists schema_organization boolean not null default true,
    add column if not exists schema_breadcrumbs boolean not null default true,
    add column if not exists schema_lodging boolean not null default true,
    add column if not exists schema_faq boolean not null default true;

comment on column public.tenant_site_config.schema_organization is
    'JSON-LD Organization/LocalBusiness aus dem Firmenprofil ausliefern.';
comment on column public.tenant_site_config.schema_breadcrumbs is
    'JSON-LD BreadcrumbList aus dem Seitenpfad ausliefern.';
comment on column public.tenant_site_config.schema_lodging is
    'JSON-LD LodgingBusiness + Offer je Objektseite ausliefern.';
comment on column public.tenant_site_config.schema_faq is
    'JSON-LD FAQPage ausliefern, wenn die Seite einen FAQ-Block trägt.';

-- == 4) Core Web Vitals =====================================================
alter table public.tenant_site_config
    add column if not exists lazy_loading boolean not null default true,
    add column if not exists system_fonts_first boolean not null default true;

comment on column public.tenant_site_config.lazy_loading is
    'Bilder/Blöcke erst beim Scrollen laden (LCP/CLS). Abschaltbar, weil '
    'Lazy-Loading über der Falz die LCP verschlechtert.';
comment on column public.tenant_site_config.system_fonts_first is
    'System-Schrift zeigen, während die Marken-Schrift lädt (font-display: '
    'swap). Beschleunigt das erste Lesen, lässt die Seite aber blinken. '
    'AUS bedeutet font-display: block — der Text erscheint erst mit der '
    'Marken-Schrift. Default true, weil das der bisherige Zustand ist.';

-- == 5) SEO je Seite ========================================================
-- Ergänzt 0087. `head_html` je Seite ist die Stelle, an der Hostaway das
-- Schema-Markup einer EINZELNEN Seite erwartet („nur dort, wo der Inhalt
-- steht") — site-weites head_html gibt es schon (0426).
--
-- Wurzel 8: der Inhalt wird beim SPEICHERN allowlist-gefiltert (nh3), nicht
-- beim Rendern. Derselbe Weg wie head_html der Site.
alter table public.site_pages
    add column if not exists seo_keywords text,
    add column if not exists canonical_url text,
    add column if not exists head_html text,
    add column if not exists noindex boolean not null default false;

comment on column public.site_pages.seo_keywords is
    'Kommagetrennte Keywords dieser Seite. Rückfall: tenant_site_config.';
comment on column public.site_pages.canonical_url is
    'Abweichende kanonische Adresse dieser Seite. NULL = die Seite selbst ist '
    'das Original (der Renderer setzt dann ihre eigene Adresse).';
comment on column public.site_pages.head_html is
    'Kopf-HTML NUR dieser Seite (z. B. seitenspezifisches JSON-LD). '
    'Allowlist-gefiltert beim Speichern.';
comment on column public.site_pages.noindex is
    'true = diese Seite aus dem Suchindex halten. Entwürfe sind unabhängig '
    'davon nie indexierbar, weil sie gar nicht ausgeliefert werden.';

-- == 6) URL-Weiterleitungen =================================================
-- Eigene Tabelle und keine JSON-Spalte an der Config: eine Weiterleitung hat
-- eigene Eigenschaften (Typ, aktiv/inaktiv), wird einzeln gepflegt, muss
-- eindeutig sein und wird pro Request GESUCHT. Ein JSON-Array müsste bei jedem
-- 404 vollständig geladen und in Python durchsucht werden.
--
-- KEINE Wildcards/Variablen in v1 (Hostaway hat `*`, `**` und `{name}`): dafür
-- braucht der Renderer eine Regel-Auswertung pro 404 mit Reihenfolge-Semantik.
-- Ohne die ist ein `**`-Eintrag eine stille Falle, die jeden Pfad umlenkt.
-- Der exakte Pfad-Treffer deckt den Hauptfall (Domain-/Plattform-Umzug) ab;
-- das Muster-Matching kommt als eigene Etappe mit eigenen Tests.
create table if not exists public.site_redirects (
    id            uuid primary key default gen_random_uuid(),
    tenant_id     uuid not null references public.tenants (id) on delete cascade,
    -- Pfad OHNE Domain und OHNE Query, immer mit / beginnend. Der Renderer
    -- vergleicht normalisiert (klein, ohne Schluss-/), damit /Alt/ und /alt
    -- denselben Eintrag treffen.
    source_path   text not null,
    -- Ziel: Pfad derselben Site (/neu) ODER absolute http(s)-Adresse. Die
    -- Schema-Prüfung sitzt im Backend-Validator (Wurzel 8) — hier nur die
    -- Länge, damit ein Angreifer die Zeile nicht als Speicher missbraucht.
    target        text not null,
    redirect_type smallint not null default 301,
    is_active     boolean not null default true,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now(),
    constraint site_redirects_source_path_form check (
        length(source_path) between 1 and 500 and source_path like '/%'
    ),
    constraint site_redirects_target_form check (
        length(target) between 1 and 2000
    ),
    constraint site_redirects_type check (redirect_type in (301, 302))
);

-- Wurzel 2: der Backstop gegen Doppelklick und Retry. Ohne ihn legt ein zweiter
-- Klick auf „Anlegen" eine zweite Zeile mit demselben Quellpfad an, und welche
-- davon greift, entscheidet die Sortierung — also der Zufall.
-- Normalisiert (lower), weil /Alt und /alt dieselbe Weiterleitung sind.
create unique index if not exists site_redirects_tenant_source_uniq
    on public.site_redirects (tenant_id, lower(source_path));

-- Der Lesepfad des Renderers: „gibt es für diesen Host+Pfad eine aktive
-- Weiterleitung?" — bei jedem 404 einer Kundenseite.
create index if not exists site_redirects_lookup_idx
    on public.site_redirects (tenant_id, is_active);

comment on table public.site_redirects is
    'URL-Weiterleitungen einer Kunden-Website (301/302). Greifen nur, wenn '
    'unter dem Quellpfad KEINE Seite existiert — eine vorhandene Seite hat '
    'immer Vorrang, sonst wäre eine Seite per Weiterleitung unerreichbar.';

-- Wurzel 6 — der eigentliche Schutz. Eine Weiterleitung lenkt Gast-Verkehr der
-- Kundendomain um; wer sie schreiben kann, kann die Domain des Betriebs auf
-- eine Phishing-Seite zeigen lassen. Der FastAPI-Layer allein reicht dafür
-- nicht: ein eingeloggter cleaner mit dem anon-Key spricht PostgREST direkt an.
alter table public.site_redirects enable row level security;

drop policy if exists site_redirects_tenant on public.site_redirects;
create policy site_redirects_tenant on public.site_redirects
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- `select` bleibt offen (Realtime-Abo der Weiterleitungs-Liste hängt daran,
-- RLS entscheidet über die Zeilen), der Schreibpfad ist zu.
revoke insert, update, delete on public.site_redirects from anon, authenticated;
grant select on public.site_redirects to authenticated;

-- Der Riegel gehört zur Tabelle, nicht zum Zufall, dass gerade kein Grant
-- besteht: zieht später jemand ein `grant insert` nach, bleibt der Direktpfad
-- trotzdem zu.
--
-- DREI Policies je Schreibrichtung und NICHT eine `as restrictive for all`
-- mit `using (false)`, wie sie 0424 für `site_media` setzt. Der Unterschied
-- entscheidet hier alles: eine restriktive for-all-Policy gilt auch für
-- `select` und hätte den Lesepfad mitgesperrt — samt Realtime-Abo der Liste.
-- Bei `site_media` fällt das nicht auf, weil dort auch `select` entzogen ist.
-- `using` deckt update/delete, `with check` deckt insert/update.
drop policy if exists site_redirects_no_insert on public.site_redirects;
create policy site_redirects_no_insert on public.site_redirects
    as restrictive for insert to anon, authenticated with check (false);

drop policy if exists site_redirects_no_update on public.site_redirects;
create policy site_redirects_no_update on public.site_redirects
    as restrictive for update to anon, authenticated
    using (false) with check (false);

drop policy if exists site_redirects_no_delete on public.site_redirects;
create policy site_redirects_no_delete on public.site_redirects
    as restrictive for delete to anon, authenticated using (false);

comment on policy site_redirects_no_insert on public.site_redirects is
    'Schreiben ausschließlich über die API (service_role). Restriktiv, damit ein '
    'später nachgezogenes Tabellen-GRANT den Direktpfad nicht öffnet.';

-- `updated_at` wird von der Spalte behauptet, also muss sie auch stimmen.
drop trigger if exists set_updated_at on public.site_redirects;
create trigger set_updated_at before update on public.site_redirects
    for each row execute function public.set_updated_at();

-- Realtime: die Liste im Dashboard abonniert diese Tabelle. Ohne Mitgliedschaft
-- in der Publikation wäre das Abo eine stumme Attrappe.
do $$
begin
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'site_redirects'
    ) then
        alter publication supabase_realtime add table public.site_redirects;
    end if;
end
$$;
