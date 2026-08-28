-- 0443 — Entwurfs-Zustand je Seite
--
-- Hostaway trennt zwei Dinge, die bei uns eines waren:
--
--   `is_published`  — steht die Seite JETZT auf der Live-Website?
--   Entwurf         — soll sie beim naechsten Veroeffentlichen UEBERSPRUNGEN
--                     werden?
--
-- Ohne die zweite Angabe gibt es keinen Weg, an einer Seite zu arbeiten,
-- waehrend man den Rest der Website veroeffentlicht: der Knopf
-- „Veroeffentlichen" nimmt alles mit, was noch nicht live ist — also auch die
-- halbfertige Seite. Genau dafuer hat Hostaway `Set as a draft` und
-- `Stage draft to publish`.
--
-- WAS EIN ENTWURF NICHT IST: eine zweite Fassung derselben Seite. Wer eine
-- veroeffentlichte Seite umbaut, aendert sie — der Gast sieht die Aenderung
-- beim naechsten Aufruf. Eine getrennte Arbeitsfassung waere ein zweiter
-- Datensatz mit eigenen Bloecken, eigener SEO und einem Zusammenfuehren; das
-- ist ein Versionssystem und nicht das, was hier gebraucht wird.
--
-- WELCHE SEITEN KEIN ENTWURF SEIN KOENNEN (Hostaway zieht dieselbe Grenze):
-- die Startseite, ein externer Menuepunkt und ein Ordner. Die Startseite waere
-- eine Website ohne Eingang; die beiden anderen haben gar keinen Inhalt, den
-- man herrichten koennte.

alter table public.site_pages
    add column if not exists is_draft boolean not null default false;

alter table public.site_pages
    drop constraint if exists site_pages_entwurf_nicht_home;
alter table public.site_pages
    add constraint site_pages_entwurf_nicht_home check (
        not is_draft or (is_home = false and page_type not in ('external', 'folder'))
    );

-- Ein Entwurf steht nicht live. Beides gleichzeitig waere ein Widerspruch, den
-- niemand aufloesen koennte: die Seite ist erreichbar UND soll uebersprungen
-- werden.
alter table public.site_pages
    drop constraint if exists site_pages_entwurf_nicht_veroeffentlicht;
alter table public.site_pages
    add constraint site_pages_entwurf_nicht_veroeffentlicht check (
        not (is_draft and is_published)
    );

-- Der Lesepfad des Veroeffentlichen-Knopfs: „was ist noch nicht live und kein
-- Entwurf".
create index if not exists site_pages_offen_idx
    on public.site_pages (tenant_id)
    where is_published = false and is_draft = false;

comment on column public.site_pages.is_draft is
    'true = beim Veroeffentlichen der Website UEBERSPRINGEN. Nicht dasselbe '
    'wie `is_published = false`: das heisst nur „steht gerade nicht live". '
    'Startseite, externe Menuepunkte und Ordner koennen kein Entwurf sein.';
