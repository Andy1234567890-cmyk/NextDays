-- 0626 — Produktwissen für den Support-Chatbot (RAG mit pgvector)
--
-- WOFÜR: Der Support-Chat auf der Marketing-Seite soll Fragen zur Software
-- beantworten, BEVOR ein Ticket entsteht. Dafür braucht die KI belegtes
-- Produktwissen — die Hilfe-Artikel, den Funktionskatalog, die Preistexte.
--
-- WARUM EINE EIGENE TABELLE und nicht `inbox_knowledge_fact` (0260/0496):
-- Das ist Wissen einer ANDEREN Art mit einer anderen Sichtbarkeit.
-- `inbox_knowledge_fact` steht pro Mandant UND pro Objekt und enthält
-- Türcodes, WLAN-Passwörter und Anschriften — es ist für anon vollständig
-- gesperrt, und das muss so bleiben. Das Produktwissen hier ist das genaue
-- Gegenteil: mandantenLOS (es beschreibt myNextDays, nicht einen Betrieb) und
-- für jeden Besucher der Website bestimmt. Beides in eine Tabelle zu legen
-- hieße, eine Zeile mit `tenant_id IS NULL` als „öffentlich" zu deuten und
-- damit die restriktive Policy aufzuweichen, die dort Türcodes schützt.
-- Zwei Tabellen, zwei Rechtelagen, kein gemeinsamer Fehlerfall.
--
-- WARUM VEKTOREN und nicht die vorhandene Volltextsuche: Ein Besucher fragt
-- „kann ich meine Zimmer bei Booking und Airbnb gleichzeitig anbieten" — im
-- Artikel steht „Kanalmanager", „Portale", „Verfügbarkeit". Kein einziges
-- Wort der Frage kommt im Text vor; Volltext und Trigram finden nichts.
-- Die Suche muss auf BEDEUTUNG gehen, nicht auf Zeichen.
--
-- Modell: text-multilingual-embedding-002 (768 Dimensionen), live gegen
-- europe-west4 geprüft. Nicht text-embedding-005 (englischzentriert, die
-- Artikel liegen in 24 Sprachen vor) und nicht gemini-embedding-001 (3072
-- Dimensionen = vierfacher Speicher und Rechenaufwand für einen Vorteil, den
-- es bei dieser Wissensmenge nicht gibt).
--
-- SICHERHEIT (Wurzel 6): Diese Tabelle ist bewusst LESBAR für anon — sie
-- enthält ausschließlich Text, der ohnehin auf der Website steht. Aber NUR
-- lesend: `revoke insert, update, delete`. Wer schreiben dürfte, könnte dem
-- Chatbot beliebige Aussagen unterschieben, die er dann als belegtes
-- Produktwissen ausgibt (Prompt Injection über die Datenbank).

-- Nach `extensions`, nicht nach `public`: das ist die Supabase-Konvention
-- (dort liegen bereits drei weitere). Wichtiger noch — der Typ und seine
-- Operatoren sind dann über einen STABILEN Schemanamen erreichbar, den die
-- Funktion unten in ihren `search_path` aufnehmen kann.
create extension if not exists vector with schema extensions;

-- --------------------------------------------------------------------------
-- Die Wissensstücke
-- --------------------------------------------------------------------------
create table if not exists public.produktwissen (
    id uuid primary key default gen_random_uuid(),

    -- Woher das Stück stammt, damit die Antwort eine Quelle nennen kann und
    -- ein Neuaufbau gezielt ersetzen darf statt alles zu löschen.
    quelle text not null
        check (quelle in ('hilfe', 'funktion', 'preise', 'faq')),
    -- Stabile Kennung innerhalb der Quelle (Artikel-Slug, Funktions-Key).
    -- Zusammen mit `sprache` und `abschnitt` eindeutig — siehe unique unten.
    quelle_id text not null check (length(btrim(quelle_id)) between 1 and 200),
    -- Laufende Nummer des Abschnitts innerhalb eines Artikels. Ein Artikel
    -- wird in Stücke geschnitten; ohne Nummer wäre die Reihenfolge verloren.
    abschnitt integer not null default 0 check (abschnitt >= 0),

    sprache text not null check (length(sprache) between 2 and 5),

    titel text not null check (length(btrim(titel)) between 1 and 300),
    -- Der Text, der in den Prompt geht. Deckel bei 8000 Zeichen: das Modell
    -- verarbeitet 2048 Token je Eingabe, alles darüber würde stillschweigend
    -- abgeschnitten und ein Embedding erzeugen, das den Schluss des Textes
    -- nicht kennt (Wurzel 5 — kein stiller Teilerfolg).
    inhalt text not null check (length(btrim(inhalt)) between 1 and 8000),
    -- Wohin der Besucher klicken kann. Relativer Pfad, keine volle URL: die
    -- Marketing-Seite läuft unter mehreren Domänen und Sprachpräfixen.
    pfad text check (pfad is null or pfad ~ '^/'),

    -- 768 Dimensionen = text-multilingual-embedding-002. Ein Wechsel des
    -- Modells ändert die Dimension und macht ALLE vorhandenen Vektoren
    -- unvergleichbar — deshalb steht das Modell mit in der Zeile, damit ein
    -- Mischbestand auffällt statt still falsche Treffer zu liefern.
    einbettung extensions.vector(768),
    modell text not null default 'text-multilingual-embedding-002',

    -- Prüfsumme des Inhalts. Der Aufbaulauf berechnet sie und überspringt
    -- unveränderte Stücke — sonst kostet jeder Lauf 1000+ Embedding-Aufrufe
    -- für Texte, die sich nicht geändert haben.
    inhalt_hash text not null,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint produktwissen_eindeutig
        unique (quelle, quelle_id, sprache, abschnitt)
);

comment on table public.produktwissen is
    'Produktwissen über myNextDays für den Support-Chatbot. Mandantenlos und '
    'öffentlich lesbar — es steht ohnehin auf der Website. Schreiben nur '
    'serverseitig: wer hier schreibt, diktiert die Antworten des Chatbots.';
comment on column public.produktwissen.einbettung is
    'NULL heißt: Stück angelegt, Embedding noch nicht berechnet. Die Suche '
    'überspringt solche Zeilen, statt sie als unähnlich zu behandeln.';
comment on column public.produktwissen.inhalt_hash is
    'sha256 des Inhalts. Der Aufbaulauf spart damit die Embedding-Kosten für '
    'unveränderte Stücke.';

-- HNSW statt IVFFlat: IVFFlat braucht einen bereits gefüllten Bestand zum
-- Trainieren der Listen und liefert auf einer wachsenden Tabelle schlechte
-- Trefferquoten. HNSW baut inkrementell und ist bei dieser Größenordnung
-- (einige tausend Zeilen) ohnehin schneller.
-- vector_cosine_ops, weil die Vertex-Vektoren normalisiert sind und Kosinus
-- dort das übliche Maß ist.
create index if not exists produktwissen_einbettung_idx
    on public.produktwissen
    using hnsw (einbettung extensions.vector_cosine_ops);

-- Die Suche filtert IMMER auf Sprache, bevor sie Vektoren vergleicht.
create index if not exists produktwissen_sprache_idx
    on public.produktwissen (sprache, quelle);

-- --------------------------------------------------------------------------
-- updated_at pflegen
-- --------------------------------------------------------------------------
create or replace function public.produktwissen_touch()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

revoke execute on function public.produktwissen_touch() from anon, authenticated;

drop trigger if exists produktwissen_touch_tr on public.produktwissen;
create trigger produktwissen_touch_tr
    before update on public.produktwissen
    for each row execute function public.produktwissen_touch();

-- --------------------------------------------------------------------------
-- RLS + Rechte (Wurzel 6)
-- --------------------------------------------------------------------------
alter table public.produktwissen enable row level security;

-- Lesen darf jeder — der Inhalt steht öffentlich auf der Website.
drop policy if exists produktwissen_lesen on public.produktwissen;
create policy produktwissen_lesen on public.produktwissen
    for select
    using (true);

-- Schreiben NUR service_role. Ohne diesen Entzug könnte ein eingeloggter
-- Nutzer mit dem anon-Key per `curl` Wissensstücke einfügen und dem Chatbot
-- damit beliebige Aussagen in den Mund legen.
revoke insert, update, delete on public.produktwissen from anon, authenticated;
grant select on public.produktwissen to anon, authenticated;

-- --------------------------------------------------------------------------
-- Ähnlichkeitssuche als Funktion
-- --------------------------------------------------------------------------
-- Warum eine Funktion statt einer Abfrage im Backend: PostgREST kann den
-- `<=>`-Operator nicht ausdrücken, und der Vektor müsste sonst als Literal in
-- eine URL. Die Funktion nimmt ihn als Parameter.
--
-- `security definer` NICHT nötig — die Tabelle ist für alle lesbar. Der
-- Aufruf bleibt trotzdem auf service_role beschränkt, weil die Suche
-- Rechenzeit kostet und über die App laufen soll (dort greift das Ratelimit).
create or replace function public.produktwissen_suchen(
    p_einbettung extensions.vector(768),
    p_sprache text,
    p_grenze integer default 6,
    p_mindest_aehnlichkeit real default 0.35
)
returns table (
    id uuid,
    quelle text,
    quelle_id text,
    titel text,
    inhalt text,
    pfad text,
    aehnlichkeit real
)
language sql
stable
-- `extensions` MUSS im search_path stehen: dort liegt der Operator `<=>`.
-- Mit `set search_path = ''` allein bricht die Funktion beim Anlegen mit
-- „operator does not exist: vector <=> vector" — genau so am 10.09.2026
-- passiert. `public` bleibt draussen, die Tabelle ist qualifiziert.
set search_path = 'extensions'
as $$
    select w.id, w.quelle, w.quelle_id, w.titel, w.inhalt, w.pfad,
           (1 - (w.einbettung <=> p_einbettung))::real as aehnlichkeit
    from public.produktwissen w
    where w.sprache = p_sprache
      and w.einbettung is not null
      and (1 - (w.einbettung <=> p_einbettung)) >= p_mindest_aehnlichkeit
    order by w.einbettung <=> p_einbettung
    limit least(greatest(p_grenze, 1), 20);
$$;

revoke execute on function
    public.produktwissen_suchen(extensions.vector, text, integer, real)
    from anon, authenticated;

comment on function
    public.produktwissen_suchen(extensions.vector, text, integer, real) is
    'Ähnlichkeitssuche über das Produktwissen. Die Mindestähnlichkeit hält '
    'zusammenhanglose Treffer heraus: ohne sie liefert eine Vektorsuche IMMER '
    'die k nächsten Zeilen, auch wenn keine zur Frage passt — der Chatbot '
    'würde dann aus einem beliebigen Artikel antworten.';
