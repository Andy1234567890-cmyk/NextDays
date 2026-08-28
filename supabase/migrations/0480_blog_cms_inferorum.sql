-- 0480 — Das Blog-CMS auf den Stand des Agentur-CMS
--
-- Vorbild ist das eigene, fertige Blog-CMS aus `Andy54411/inferorum-gemae-website`
-- (`collection_items` der Sammlung „blog"). Es kennt am Beitrag sechs Dinge, die
-- unser `site_pages`-Beitrag (0438/0457) nicht hat. Jedes einzeln begründet:
--
-- 1. `content_html` — DER TEXT DES BEITRAGS
--    Bei Inferorum ist der Inhalt EIN Rich-Text-Feld, das im selben Dialog
--    geschrieben wird wie Titel und Anriss. Bei uns waren es bisher Abschnitte
--    auf einem anderen Bildschirm; wer einen Beitrag schreiben wollte, verließ
--    dafür die Liste. Entscheidung vom 28.08.2026: der Text gehört in den
--    Dialog.
--    Gespeichert wird HTML und nicht TipTap-JSON: unsere Seiten werden
--    SERVERSEITIG gerendert und müssen ohne JavaScript stehen. JSON müsste dafür
--    im Renderer erst zu HTML werden — ein zweiter Weg mit einem zweiten
--    Erweiterungssatz, der auseinanderläuft (bei Inferorum ist genau das
--    passiert: der Editor kennt 18 Erweiterungen, die Vorschau 3).
--    Gesäubert wird beim SPEICHERN mit `nh3` gegen dieselbe Allowlist wie der
--    Rich-Text-Abschnitt (`site_config/basis._RICH_TEXT_TAGS`) — Wurzel 8.
--
-- 2. `view_count` — DIE AUFRUFE
--    Spalte „Aufrufe" in der Tabelle. Erhöht wird sie über die Funktion unten
--    und NICHT per Lesen-Rechnen-Schreiben im Anwendungscode: zwei gleichzeitige
--    Besucher lesen sonst beide 41, schreiben beide 42, und ein Aufruf ist
--    verloren (Wurzel 2). Inferorum macht genau diesen Fehler.
--
-- 3. `post_sort` — DIE HANDSORTIERUNG
--    Der Ziehgriff links an der Zeile. Eigene Spalte und nicht `nav_order`:
--    `nav_order` ist die Reihenfolge im MENÜ und gilt für Seiten. Ein Beitrag
--    steht in keinem Menü.
--
-- 4. `parent_post_id` — BUCH UND KAPITEL
--    Ein Beitrag kann einem anderen zugeordnet sein; die Tabelle rückt ihn dann
--    eingerückt darunter ein, und die Beitragsseite listet seine Kapitel.
--    Eigene Spalte und NICHT `parent_id`: das ist der ORDNER der Seitenliste
--    (genau eine Ebene, 0433). Ein Kapitel liegt in keinem Ordner.
--    `on delete set null`: wer das Buch löscht, löscht nicht die Kapitel — sie
--    werden wieder eigenständig. Ein `cascade` würde neun Kapitel mitnehmen,
--    weil jemand den Rahmenbeitrag entfernt.
--
-- 5. `author_user_id` — DER AUTOR ALS KONTO
--    Bisher war `author` ein Freitext-Name. Damit gibt es kein Foto, keine
--    Profile und keine Autorenkarte. Der Verweis zeigt auf ein Konto des
--    Betriebs; `author` bleibt als Rückfall stehen (Altbestand und Gastautoren,
--    die kein Konto haben). `on delete set null`: ein gelöschtes Konto nimmt
--    nicht die Beiträge mit.
--
-- 6. `is_archived` — DER DRITTE ZUSTAND
--    Inferorum kennt Entwurf · Veröffentlicht · Archiviert. Uns fehlte der
--    dritte. Er ist nicht dasselbe wie „nicht veröffentlicht": archiviert heißt
--    „war mal draußen, kommt nicht wieder" und verschwindet aus der Liste,
--    ohne dass jemand den Beitrag löschen muss.

alter table public.site_pages
    add column if not exists content_html text,
    add column if not exists view_count integer not null default 0,
    add column if not exists post_sort integer,
    add column if not exists parent_post_id uuid
        references public.site_pages (id) on delete set null,
    add column if not exists author_user_id uuid
        references public.users (id) on delete set null,
    add column if not exists is_archived boolean not null default false;

comment on column public.site_pages.content_html is
    'Der Text eines Blogbeitrags als gesaeubertes HTML (0480). Nur an '
    'page_type=post. Gesaeubert beim Speichern mit nh3 gegen '
    'site_config.basis._RICH_TEXT_TAGS.';
comment on column public.site_pages.view_count is
    'Aufrufe der oeffentlichen Beitragsseite. Erhoeht AUSSCHLIESSLICH ueber '
    'public.bump_page_view (0480) — nie per Lesen-Rechnen-Schreiben.';
comment on column public.site_pages.post_sort is
    'Handsortierung der Beitragsliste (Ziehgriff). NICHT nav_order: das ist '
    'die Menue-Reihenfolge von Seiten (0480).';
comment on column public.site_pages.parent_post_id is
    'Dieser Beitrag ist ein Kapitel des verwiesenen Beitrags (0480). NICHT '
    'parent_id: das ist der Ordner der Seitenliste (0433).';
comment on column public.site_pages.author_user_id is
    'Der Autor als Konto des Betriebs (0480). Faellt er weg, bleibt der '
    'Freitext in author stehen.';

-- Die neuen Felder gehoeren zu einem Beitrag und zu nichts anderem — dieselbe
-- Regel wie 0438 fuer published_at/author/excerpt/tags. Ohne sie stuende an
-- einer normalen Seite ein Beitragstext, der nie gelesen wird.
alter table public.site_pages
    drop constraint if exists site_pages_post_felder_nur_bei_post;
alter table public.site_pages
    add constraint site_pages_post_felder_nur_bei_post check (
        page_type = 'post'
        or (published_at is null and author is null
            and cover_image_url is null and excerpt is null and tags is null
            and content_html is null and post_sort is null
            and parent_post_id is null and author_user_id is null
            and is_archived = false)
    );

-- Ein Beitrag kann nicht sein eigenes Kapitel sein. Als CHECK und nicht im
-- Service: die Bedingung liest genau EINE Spalte derselben Zeile, und dafuer
-- ist ein CHECK der richtige Ort (kein Trigger — siehe 23.08.2026, 0418→0424).
alter table public.site_pages
    drop constraint if exists site_pages_kein_selbst_kapitel;
alter table public.site_pages
    add constraint site_pages_kein_selbst_kapitel check (
        parent_post_id is null or parent_post_id <> id
    );

-- Die Handsortierung der Liste: „die Beitraege dieses Betriebs in ihrer
-- Reihenfolge".
create index if not exists site_pages_post_sort_idx
    on public.site_pages (tenant_id, post_sort)
    where page_type = 'post';

-- Die Kapitel eines Buchs.
create index if not exists site_pages_parent_post_idx
    on public.site_pages (parent_post_id)
    where parent_post_id is not null;

-- Ein Aufruf, eine Anweisung (Wurzel 2). `set search_path = ''` +
-- schema-qualifiziert + Ausfuehrungsrecht nur fuer den Dienst (Wurzel 6).
create or replace function public.bump_page_view(p_page_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
    update public.site_pages
       set view_count = view_count + 1
     where id = p_page_id
       and page_type = 'post';
$$;

revoke execute on function public.bump_page_view(uuid) from public, anon, authenticated;
grant execute on function public.bump_page_view(uuid) to service_role;

-- Die Reihenfolge in EINER Anweisung statt N Einzel-Updates: eine Liste mit 200
-- Beitraegen waere sonst je Verschiebung 200 Netzwerkrunden, von denen jede fuer
-- sich scheitern kann — ein Abbruch in der Mitte liesse die Liste halb sortiert
-- zurueck. Der Scope (tenant) steht IN der Anweisung (Wurzel 3).
create or replace function public.set_post_order(
    p_tenant_id uuid,
    p_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_anzahl integer;
begin
    update public.site_pages as p
       set post_sort = liste.position - 1
      from unnest(p_ids) with ordinality as liste(id, position)
     where p.id = liste.id
       and p.tenant_id = p_tenant_id
       and p.page_type = 'post';
    get diagnostics v_anzahl = row_count;
    return v_anzahl;
end;
$$;

revoke execute on function public.set_post_order(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.set_post_order(uuid, uuid[]) to service_role;
