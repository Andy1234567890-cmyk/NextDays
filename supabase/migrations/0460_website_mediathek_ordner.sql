-- 0460 — Mediathek: Ordner, Alt-Text, Bildmaße, Änderungszeit.
--
-- Stand vor dieser Migration: `site_media` trug id, tenant_id, path, url,
-- filename, mime, bytes, created_at — und sonst nichts. Kein Ordner, kein
-- Alt-Text, keine Maße. Ein Betrieb mit 300 Fotos hatte damit EINE flache
-- Kachelwand ohne Gliederung; Hostaways Media Manager führt Ordner über alle
-- Typen (docs/HOSTAWAY-BWP-LUECKEN.md, Abschnitt 8).
--
-- ============================================================================
-- ENTSCHEIDUNG: eigene TABELLE, nicht Pfad-Konvention.
-- ============================================================================
-- Die naheliegende Alternative wäre eine Textspalte `folder` an `site_media`
-- mit Werten wie 'Sommer/Strand' — kein Join, keine zweite Tabelle. Sie wurde
-- verworfen, und zwar aus vier Gründen, die alle im Betrieb auftreten:
--
-- 1. EIN LEERER ORDNER KANN NICHT EXISTIEREN. Bei der Pfad-Konvention ist ein
--    Ordner nur die Summe der Bilder, die ihn nennen. Wer „Winter 2027" anlegt
--    und noch nichts hochlädt, sieht ihn nach dem Neuladen nicht mehr. Genau
--    dieser Ablauf ist aber der normale: erst ordnen, dann füllen.
--
-- 2. UMBENENNEN WIRD ZUR STRING-CHIRURGIE. `Sommer` → `Hochsommer` heißt bei
--    der Pfad-Konvention: alle Zeilen finden, deren Wert mit 'Sommer/' beginnt
--    ODER gleich 'Sommer' ist, und den Präfix ersetzen. Bricht das nach der
--    Hälfte ab, existieren zwei Ordner, wo einer sein sollte — ein
--    Gegenzustand, der nicht mitgepflegt wurde (Wurzel 1). Mit einer Tabelle
--    ist Umbenennen ein UPDATE auf EINER Zeile; die Bilder merken es nicht.
--
-- 3. EINDEUTIGKEIT IST NICHT ERZWINGBAR. „Zwei Ordner gleichen Namens unter
--    demselben Elternteil" lässt sich in einer freien Textspalte nicht per
--    Constraint verhindern — nur im Anwendungscode, also genau dort, wo man es
--    beim nächsten Aufrufer vergisst (Wurzel 3). Unten stehen dafür zwei
--    partielle Unique-Indizes.
--
-- 4. DER GEGENZUSTAND BEIM LÖSCHEN IST NICHT BENENNBAR. Was passiert mit den
--    Bildern eines gelöschten Ordners? Bei der Pfad-Konvention: nichts
--    Definiertes, der Wert bleibt stehen und zeigt auf einen Ordner, den die
--    Oberfläche nicht mehr anbietet — das Bild ist unauffindbar, aber nicht
--    gelöscht. Mit einem Fremdschlüssel steht die Antwort im Schema:
--    `on delete set null`, die Bilder rutschen sichtbar in die Wurzel. Ein Bild
--    ist nie „einfach weg".
--
-- Was die Pfad-Konvention besser könnte — eine Abfrage weniger — wiegt das
-- nicht auf. Der Bestand wird ohnehin je Betrieb geladen und ist auf 500 Bilder
-- gedeckelt.

-- == site_media_folders =======================================================
create table if not exists public.site_media_folders (
    id          uuid primary key default gen_random_uuid(),
    tenant_id   uuid not null references public.tenants (id) on delete cascade,
    -- Selbstbezug für Unterordner. `on delete cascade`: ein gelöschter Ordner
    -- nimmt seine Unterordner mit — die Bilder NICHT (siehe folder_id unten).
    parent_id   uuid references public.site_media_folders (id) on delete cascade,
    name        text not null check (length(btrim(name)) between 1 and 80),
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

-- Eindeutigkeit je Ebene, ohne Rücksicht auf Groß-/Kleinschreibung: „Sommer"
-- und „sommer" nebeneinander wären für den Kunden zwei identische Ordner.
--
-- ZWEI partielle Indizes und nicht EIN `unique (tenant_id, parent_id, name)`:
-- in SQL ist NULL nie gleich NULL, ein zusammengesetzter Unique-Index lässt
-- also beliebig viele Wurzel-Ordner gleichen Namens durch. Genau die Ebene, auf
-- der die meisten Ordner liegen, wäre ungeschützt.
create unique index if not exists site_media_folders_name_wurzel
    on public.site_media_folders (tenant_id, lower(btrim(name)))
    where parent_id is null;

create unique index if not exists site_media_folders_name_unter
    on public.site_media_folders (tenant_id, parent_id, lower(btrim(name)))
    where parent_id is not null;

create index if not exists site_media_folders_tenant_idx
    on public.site_media_folders (tenant_id, parent_id);

drop trigger if exists set_updated_at_site_media_folders
    on public.site_media_folders;
create trigger set_updated_at_site_media_folders
    before update on public.site_media_folders
    for each row execute function public.set_updated_at();

comment on table public.site_media_folders is
    'Ordner der Website-Mediathek je Betrieb. Eigene Tabelle statt Pfad-Spalte, '
    'damit leere Ordner existieren, Umbenennen EINE Zeile ist und die '
    'Eindeutigkeit je Ebene erzwingbar bleibt (0460).';

-- Die Tiefe (max. 3 Ebenen, wie bei Hostaways Seitenbaum) wird im Dienst
-- geprüft und NICHT hier: ein rekursiver Check-Constraint bräuchte eine
-- SECURITY-DEFINER-Funktion je INSERT, und die Grenze ist eine
-- Produktentscheidung, keine Integritätsregel. Der Zyklus-Schutz beim
-- Verschieben liegt aus demselben Grund im Dienst.

-- == RLS + Direktpfad zudrehen (Wurzel 6) =====================================
-- Dieselbe Haltung wie bei `site_media` (0422/0424): der FastAPI-Layer wird
-- umgangen, sobald jemand mit gültigem JWT und dem öffentlichen anon-Key direkt
-- gegen PostgREST spricht. Lesen darf der eigene Mandant, SCHREIBEN nur der
-- Server.
--
-- Prüffrage (Wurzel 6): Was kann ein eingeloggter `cleaner` mit dem anon-Key
-- per `curl /rest/v1/site_media_folders`?
--   • SELECT — nein. Das Tabellen-GRANT wird unten nie erteilt; eine frisch
--     angelegte Tabelle hat für anon/authenticated ohnehin nur die Rechte, die
--     der Supabase-Default-Grant vergibt, und der wird hier explizit entzogen.
--   • INSERT/UPDATE/DELETE — nein, doppelt: revoke UND restriktive Policy.
alter table public.site_media_folders enable row level security;

drop policy if exists site_media_folders_tenant on public.site_media_folders;
create policy site_media_folders_tenant on public.site_media_folders
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

drop policy if exists site_media_folders_write_restrict on public.site_media_folders;
create policy site_media_folders_write_restrict on public.site_media_folders
    as restrictive
    for all
    to anon, authenticated
    using (false)
    with check (false);

comment on policy site_media_folders_write_restrict on public.site_media_folders is
    'Schreiben ausschließlich über die API (service_role). Restriktiv, damit ein '
    'später nachgezogenes Tabellen-GRANT den Direktpfad nicht öffnet (Wurzel 6).';

revoke all on public.site_media_folders from anon, authenticated;

-- BEWUSST KEIN Realtime — dieselbe Begründung wie bei `site_media` in 0423:
-- ohne `select`-Grant für `authenticated` wäre ein Abo eine stumme Attrappe.
-- Der Ordnerbaum wird beim Öffnen der Mediathek geladen und aus der Antwort der
-- eigenen Aktion fortgeschrieben.

-- == site_media: die fehlenden Spalten ========================================
alter table public.site_media
    -- `set null` und NICHT `cascade`: ein Bild ist nie „einfach weg", weil
    -- jemand einen Ordner gelöscht hat. Es rutscht sichtbar in die Wurzel
    -- (Wurzel 1 — der Gegenzustand ist benannt, nicht dem Zufall überlassen).
    add column if not exists folder_id uuid
        references public.site_media_folders (id) on delete set null,
    -- Alt-Text: Pflicht für Barrierefreiheit (WCAG 1.1.1) UND für die
    -- Suchmaschine. Er gehört an das BILD und nicht an den Block: dasselbe Foto
    -- zeigt in jedem Block dasselbe, und ein Text je Verwendungsstelle wäre
    -- dreimal gepflegt und zweimal veraltet.
    add column if not exists alt_text text
        check (alt_text is null or length(alt_text) <= 300),
    -- Maße. Aus den Kopfbytes gelesen, nicht vom Client behauptet
    -- (`medien.bild_masse`). Nullable, weil Bestandszeilen sie nicht haben und
    -- ein erfundener Wert schlimmer wäre als keiner (Wurzel 4).
    add column if not exists width integer
        check (width is null or width > 0),
    add column if not exists height integer
        check (height is null or height > 0),
    -- 0424 entfernte den `set_updated_at`-Trigger mit der Begründung, ein Bild
    -- werde „hochgeladen und gelöscht, nicht bearbeitet". Das gilt ab hier
    -- nicht mehr: Umbenennen, Verschieben, Alt-Text und Zuschneiden sind
    -- UPDATEs. Also erst die Spalte, dann der Trigger — in dieser Reihenfolge,
    -- sonst scheitert jedes UPDATE mit
    --   record "new" has no field "updated_at"
    add column if not exists updated_at timestamptz not null default now();

create index if not exists site_media_folder_idx
    on public.site_media (tenant_id, folder_id, created_at desc);

-- Suche nach Dateiname: ohne Index ein Sequential Scan je Tastendruck. `gin` +
-- `pg_trgm` deckt `ilike '%teil%'` ab, wofür ein B-Tree nichts taugt.
create extension if not exists pg_trgm;
create index if not exists site_media_filename_trgm
    on public.site_media using gin (filename gin_trgm_ops);

drop trigger if exists set_updated_at_site_media on public.site_media;
create trigger set_updated_at_site_media
    before update on public.site_media
    for each row execute function public.set_updated_at();

comment on column public.site_media.folder_id is
    'Ordner der Mediathek. NULL = Wurzel. on delete set null: ein gelöschter '
    'Ordner nimmt die Bilder NICHT mit (0460).';
comment on column public.site_media.alt_text is
    'Alternativtext des Bildes (WCAG 1.1.1, SEO). Am Bild und nicht am Block, '
    'damit er nicht je Verwendungsstelle gepflegt werden muss (0460).';
comment on column public.site_media.width is
    'Bildbreite in Pixeln, aus den Kopfbytes gelesen. NULL bei Bestandszeilen '
    'und bei Formaten ohne lesbaren Kopf — nie geraten (0460).';
