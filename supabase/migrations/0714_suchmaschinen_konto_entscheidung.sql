-- „Objekte in Suchmaschinen aufnehmen" wird zur Entscheidung des KONTOS
-- (Airbnb-Verhalten) — statt aus dem Objektbestand abgeleitet zu werden.
--
-- BEFUND (17.09.2026). Der Schalter hatte keinen eigenen Speicher: `get()` las
-- „an", wenn ALLE Objekte des Betriebs `search_engine_indexing = true` tragen.
-- `properties.search_engine_indexing` steht per Default aber auf FALSE, und
-- KEIN Anlage-Pfad setzt ihn. Daraus folgen zwei Dinge, die bei Airbnb nicht
-- passieren:
--
--   1. Ein Betrieb schaltet den Schalter an (Bulk auf alle Objekte), legt
--      danach EIN neues Objekt an — das kommt mit `false` herein, und der
--      Schalter springt von selbst auf „aus". Seine bereits indexierten
--      Objekte bleiben dabei indexiert: Anzeige und Wirklichkeit fallen
--      auseinander. Das neue Objekt ist für Google unsichtbar, ohne dass
--      jemand etwas abgeschaltet hätte (Wurzel 1 — die Aktion „Objekt
--      anlegen" pflegte den Gegenzustand nicht mit).
--   2. Ein Betrieb ohne Objekte sieht „aus", obwohl er nie etwas entschieden
--      hat.
--
-- Live noch nicht eingetreten, aber sicher: alle fünf Betriebe stehen heute
-- einheitlich (drei ganz an, zwei ganz aus). Der erste, der nach dem
-- Einschalten ein Objekt anlegt, hat den Fall.
--
-- LÖSUNG. Die Entscheidung gehört dem Konto und wird dort gespeichert; die
-- Objektspalte bleibt ihre Projektion (das Frontend liest sie je Inserat für
-- den robots-Meta-Tag, die Sitemap filtert darauf). Ein neues Objekt erbt die
-- Entscheidung des Betriebs.

-- ---------------------------------------------------------------------------
-- Teil 1 — die Entscheidung am Betrieb
-- ---------------------------------------------------------------------------
-- Default TRUE, anders als die Objektspalte in 0194: dort war „datenschutz-
-- freundlich per Default aus" die Begründung. Für einen MARKTPLATZ ist das die
-- falsche Vorgabe — ein Inserat, das Google nicht findet, verfehlt seinen
-- Zweck, und Airbnb liefert diesen Schalter eingeschaltet aus. Wer nicht
-- gefunden werden will, schaltet ihn ab; das bleibt eine bewusste Handlung.
alter table public.tenants
    add column if not exists search_engine_indexing boolean not null default true;

comment on column public.tenants.search_engine_indexing is
    'Entscheidung des Betriebs: sollen seine Objektseiten in Suchmaschinen '
    'erscheinen (Airbnb „Objekte in Suchmaschinen aufnehmen")? Quelle der '
    'Wahrheit für den Konto-Schalter; properties.search_engine_indexing ist '
    'ihre Projektion je Objekt.';

-- Bestand aus dem heutigen Zustand übernehmen, NICHT auf den neuen Default
-- setzen: ein Betrieb, dessen Objekte heute auf noindex stehen, darf durch
-- diese Migration nicht plötzlich in Google auftauchen. Maßgeblich ist genau
-- das, was der Schalter dem Betrieb bisher anzeigte — „an" nur, wenn er
-- Objekte hat und alle indexierbar sind.
update public.tenants t
   set search_engine_indexing = coalesce(
       (
           select bool_and(p.search_engine_indexing)
           from public.properties p
           where p.tenant_id = t.id
       ),
       -- Kein Objekt: die Vorgabe gilt, es gibt nichts zu schützen.
       true
   );

-- ---------------------------------------------------------------------------
-- Teil 2 — ein neues Objekt erbt die Entscheidung
-- ---------------------------------------------------------------------------
-- Als Trigger und nicht im Service, weil Objekte auf mehreren Wegen entstehen
-- (Anlage, Duplizieren, Import, Seed). Jeder Weg einzeln müsste daran denken —
-- und genau das ist die Sorte Gegenzustand, die vergessen wird (Wurzel 1).
--
-- Der Trigger überschreibt auch ein ausdrückliches `false`: einen Schalter je
-- Objekt gibt es in keiner Oberfläche, die Entscheidung fällt ausschliesslich
-- am Konto. Käme später ein Objekt-Schalter dazu, muss diese Stelle mit ihm
-- zusammen geändert werden.
create or replace function public.properties_suchmaschinen_erben()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    select t.search_engine_indexing
      into new.search_engine_indexing
      from public.tenants t
     where t.id = new.tenant_id;
    -- Kein Betrieb gefunden (dürfte nicht vorkommen): nichts erfinden, der
    -- Spalten-Default gilt weiter.
    if new.search_engine_indexing is null then
        new.search_engine_indexing := false;
    end if;
    return new;
end;
$$;

comment on function public.properties_suchmaschinen_erben() is
    'Ein neues Objekt übernimmt die Suchmaschinen-Entscheidung seines Betriebs '
    '(tenants.search_engine_indexing). Ohne das kam jedes neue Objekt auf '
    'noindex herein und der Konto-Schalter sprang von selbst auf „aus".';

revoke execute on function public.properties_suchmaschinen_erben()
    from anon, authenticated;

drop trigger if exists properties_suchmaschinen_erben on public.properties;
create trigger properties_suchmaschinen_erben
    before insert on public.properties
    for each row execute function public.properties_suchmaschinen_erben();
