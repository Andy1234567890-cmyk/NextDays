-- 0484 — Ein Beitrag und eine Seite duerfen denselben Slug tragen.
--
-- DER FEHLER
-- ==========
-- `site_pages_tenant_slug_key` ist UNIQUE ueber `(tenant_id, slug)` — quer
-- ueber ALLE Seitentypen. Ein Blogbeitrag „Kontakt" liess sich damit nicht
-- anlegen, sobald es eine Seite „Kontakt" gab, und umgekehrt.
--
-- Live gemessen am 28.08.2026: der Versuch, einen Beitrag anzulegen, brach mit
-- „Es gibt bereits eine Seite mit diesem Slug." ab — einer Meldung, die auf
-- ein Problem zeigt, das der Kunde nicht hat. Es ist derselbe Fehler wie bei
-- den Pop-ups in 0440, nur eine Ebene hoeher: dort kollidierte der LEERE Slug
-- mit der Startseite, hier kollidieren zwei echte Adressen, die gar nicht im
-- selben Raum liegen.
--
-- WARUM ES KEINE KOLLISION IST
-- ============================
-- Beitraege und Seiten haben GETRENNTE Adressraeume, und zwar schon heute:
--
--     Seite    →  /<slug>              (builder/app/[slug]/page.tsx)
--     Beitrag  →  /blog/<slug>         (builder/app/blog/[slug]/page.tsx)
--
-- Der Renderer hat dafuer zwei eigene Routen, und der Dialog zeigt unter dem
-- Slug-Feld korrekt `/blog/<slug>` an. Nur die Datenbank kannte den
-- Unterschied nicht: EIN Eindeutigkeits-Topf fuer ZWEI Adressraeume.
--
-- Zwei Beitraege duerfen sich weiterhin nicht ins Gehege kommen, und zwei
-- Seiten auch nicht — nur eben jeweils unter sich.
--
-- WARUM ZWEI TEIL-INDIZES UND NICHT `(tenant_id, page_type, slug)`
-- ================================================================
-- Ein UNIQUE ueber den Typ waere zu grob: er wuerde auch einer normalen Seite
-- und einem ORDNER denselben Slug erlauben, obwohl beide unter `/<slug>`
-- liegen. Die Trennlinie verlaeuft nicht am Typ entlang, sondern an der
-- ADRESSE — und die kennt genau zwei Raeume: den Blog und alles andere.
--
-- KEIN DATENVERLUST
-- =================
-- Vor dem Einspielen gegen die Live-DB geprueft (28.08.2026): keine
-- Doppelung innerhalb der Beitraege, keine innerhalb der uebrigen Seiten. Der
-- Wechsel ist damit reine Lockerung — jede heute gueltige Zeile bleibt
-- gueltig.

-- Der alte, zu breite UNIQUE. `alter table ... drop constraint` und nicht
-- `drop index`: 0087 hat ihn als CONSTRAINT angelegt, und ein Index, der zu
-- einem Constraint gehoert, laesst sich nicht einzeln loeschen.
alter table public.site_pages
    drop constraint if exists site_pages_tenant_slug_key;
drop index if exists public.site_pages_tenant_slug_key;

-- Raum 1: der Blog. Zwei Beitraege desselben Betriebs teilen keinen Slug.
create unique index if not exists site_pages_tenant_slug_post_key
    on public.site_pages (tenant_id, slug)
    where page_type = 'post';

-- Raum 2: alles andere — normale Seiten, Ordner, Pop-ups, Systemseiten,
-- die Fehlerseite. Sie liegen alle unter `/<slug>` und teilen sich deshalb
-- weiterhin EINEN Topf.
create unique index if not exists site_pages_tenant_slug_seite_key
    on public.site_pages (tenant_id, slug)
    where page_type <> 'post';

comment on index public.site_pages_tenant_slug_post_key is
    'Slug-Eindeutigkeit INNERHALB des Blogs (0484). Beitraege liegen unter '
    '/blog/<slug> und teilen den Namensraum nicht mit den Seiten.';
comment on index public.site_pages_tenant_slug_seite_key is
    'Slug-Eindeutigkeit fuer alles ausser Beitraegen (0484) — normale Seiten, '
    'Ordner, Pop-ups, Systemseiten und die Fehlerseite liegen gemeinsam '
    'unter /<slug>.';
