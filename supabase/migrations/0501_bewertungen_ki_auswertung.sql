-- 0501 — KI-Auswertung der Bewertungstexte
--
-- Bis hierher war das Bewertungsmodul eine KI-freie Zone: es zeigt WELCHE Note
-- ein Objekt hat, aber nie WARUM. Das Dashboard sortiert das schwächste Objekt
-- nach vorn und schweigt zur Ursache — genau die Frage, die der Betrieb hat.
--
-- Warum die Deutung GESPEICHERT wird und nicht bei jeder Ansicht neu entsteht:
-- ein Bewertungstext ändert sich nach dem Eingang nie mehr. Ihn bei jedem
-- Seitenaufruf erneut durch Gemini zu schicken, kostet bei 400 Bewertungen und
-- zehn Aufrufen am Tag 4 000 Anfragen für ein Ergebnis, das sich nicht ändert.
-- Ein Aufruf JE NEUER BEWERTUNG beim Import, das Ergebnis bleibt liegen.
--
-- Warum ein GESCHLOSSENER Themen-Katalog und keine freie Extraktion:
-- freie Themen sind nicht vergleichbar. Schreibt das Modell einmal "Lärm",
-- einmal "Lärmbelästigung", einmal "laute Nachbarn", zählt jede Auswertung
-- drei verschiedene Dinge und die Rangliste ist wertlos. Der Katalog steht
-- deshalb im Prompt und wird hier per CHECK erzwungen — ein erfundenes Thema
-- ist ein Fehler, kein Sonderfall (Wurzel 4: kein plausibler Ersatzwert).
--
-- Die sieben Themen sind die Schnittmenge dessen, was Airbnb und Booking.com
-- selbst als Kategorien führen, plus 'laerm' und 'preis' — beides taucht in
-- Freitexten laufend auf, ist aber bei keinem Portal eine eigene Note.
--
-- Drei Tabellen tragen Bewertungstexte, alle drei bekommen dieselben Spalten:
--   public.reviews             — Marktplatz-Bewertung des Gastes (myBestDays)
--   public.channex_review      — gespiegelte Portal-Bewertung (Airbnb/Booking)
--   public.guest_reviews_by_host — Betrieb bewertet Gast (Gegenrichtung)
--
-- Die dritte ist bewusst dabei: auch die eigenen Texte an Gäste sollen sich
-- auswerten lassen ("worüber beschweren WIR uns eigentlich?").

-- =========================================================================
-- 1. Der Themen-Katalog als Domain — EINE Definition für alle drei Tabellen
-- =========================================================================
-- Als Domain und nicht als drei CHECK-Klauseln: ein achtes Thema wird dann an
-- EINER Stelle ergänzt. Drei Kopien wären drei Stellen, von denen die dritte
-- beim nächsten Mal vergessen wird.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'ki_bewertungsthema') then
    create domain public.ki_bewertungsthema as text
      check (value in (
        'sauberkeit',
        'lage',
        'ausstattung',
        'kommunikation',
        'anreise',
        'laerm',
        'preis'
      ));
  end if;
end $$;

comment on domain public.ki_bewertungsthema is
  'Geschlossener Themen-Katalog der KI-Bewertungsauswertung. Freie Themen '
  'waeren nicht vergleichbar (Laerm/Laermbelaestigung/laute Nachbarn = drei '
  'Zeilen in jeder Rangliste). Erweiterung nur hier UND im Prompt.';

-- =========================================================================
-- 2. Die vier Spalten, dreimal
-- =========================================================================
-- ki_stimmung   — Gesamteindruck des Textes, drei Stufen. Nicht die NOTE:
--                 ein Gast kann 5 Sterne geben und im Text meckern, und
--                 genau dieser Fall ist der interessante.
-- ki_themen     — worum es geht, mit Richtung je Thema:
--                 [{"thema":"sauberkeit","richtung":"negativ"}, ...]
-- ki_kernaussage— EIN Satz, der den Text zusammenfasst. Fuer die Liste, damit
--                 man nicht 40 Volltexte lesen muss.
-- ki_bewertet_at— WANN wir ausgewertet haben. Nicht der Zeitpunkt der
--                 Bewertung (Wurzel 5b) — er sagt nur, ob der Lauf schon
--                 dran war. Ohne ihn liesse sich "noch nicht ausgewertet"
--                 nicht von "ausgewertet, nichts gefunden" unterscheiden.

alter table public.reviews
  add column if not exists ki_stimmung     text
    check (ki_stimmung in ('positiv', 'neutral', 'negativ')),
  add column if not exists ki_themen       jsonb not null default '[]'::jsonb,
  add column if not exists ki_kernaussage  text,
  add column if not exists ki_bewertet_at  timestamptz;

alter table public.channex_review
  add column if not exists ki_stimmung     text
    check (ki_stimmung in ('positiv', 'neutral', 'negativ')),
  add column if not exists ki_themen       jsonb not null default '[]'::jsonb,
  add column if not exists ki_kernaussage  text,
  add column if not exists ki_bewertet_at  timestamptz;

alter table public.guest_reviews_by_host
  add column if not exists ki_stimmung     text
    check (ki_stimmung in ('positiv', 'neutral', 'negativ')),
  add column if not exists ki_themen       jsonb not null default '[]'::jsonb,
  add column if not exists ki_kernaussage  text,
  add column if not exists ki_bewertet_at  timestamptz;

-- =========================================================================
-- 3. Struktur des jsonb erzwingen
-- =========================================================================
-- Ein jsonb ohne Pruefung nimmt alles an. Schreibt das Modell einmal
-- {"thema": "kueche"} hinein, faellt es erst Wochen spaeter beim Auswerten
-- auf — als Thema, das in keiner Rangliste auftaucht und das niemand sucht.
-- Die Funktion prueft Form UND Katalog beim Schreiben (Wurzel 5: laut
-- scheitern statt still danebenliegen).
create or replace function public.ki_themen_gueltig(themen jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(themen) = 'array'
     and not exists (
       select 1
       from jsonb_array_elements(themen) as e
       where jsonb_typeof(e) <> 'object'
          or e->>'thema' is null
          or e->>'thema' not in (
               'sauberkeit', 'lage', 'ausstattung',
               'kommunikation', 'anreise', 'laerm', 'preis'
             )
          or coalesce(e->>'richtung', '') not in ('positiv', 'neutral', 'negativ')
     );
$$;

comment on function public.ki_themen_gueltig(jsonb) is
  'Prueft Form und Katalog von ki_themen. Erfundene Themen werden beim '
  'Schreiben abgewiesen, nicht Wochen spaeter beim Auswerten bemerkt.';

alter table public.reviews
  drop constraint if exists reviews_ki_themen_check;
alter table public.reviews
  add constraint reviews_ki_themen_check
  check (public.ki_themen_gueltig(ki_themen));

alter table public.channex_review
  drop constraint if exists channex_review_ki_themen_check;
alter table public.channex_review
  add constraint channex_review_ki_themen_check
  check (public.ki_themen_gueltig(ki_themen));

alter table public.guest_reviews_by_host
  drop constraint if exists guest_reviews_by_host_ki_themen_check;
alter table public.guest_reviews_by_host
  add constraint guest_reviews_by_host_ki_themen_check
  check (public.ki_themen_gueltig(ki_themen));

-- =========================================================================
-- 4. Indizes — genau die zwei Zugriffe, die es gibt
-- =========================================================================
-- (a) "Was ist noch nicht ausgewertet?" — der Nachlauf-Tick. Partiell, weil
--     nach dem ersten vollen Durchlauf fast alle Zeilen ausgewertet sind und
--     ein voller Index dann 400 Zeilen fuer 3 Treffer durchsucht.
create index if not exists reviews_ki_offen_idx
  on public.reviews (created_at)
  where ki_bewertet_at is null and text is not null;

create index if not exists channex_review_ki_offen_idx
  on public.channex_review (tenant_id, received_at)
  where ki_bewertet_at is null and content is not null;

create index if not exists guest_reviews_by_host_ki_offen_idx
  on public.guest_reviews_by_host (tenant_id, created_at)
  where ki_bewertet_at is null and text is not null;

-- (b) "Zeig mir die negativen" — der Filter im Cockpit.
create index if not exists channex_review_ki_stimmung_idx
  on public.channex_review (tenant_id, ki_stimmung, received_at desc)
  where ki_stimmung is not null;

-- (c) Themen-Rangliste je Objekt. GIN auf dem Array, weil die Abfrage
--     "welche Bewertungen nennen Thema X" lautet, nicht "welches Thema hat
--     Bewertung Y".
create index if not exists channex_review_ki_themen_gin
  on public.channex_review using gin (ki_themen jsonb_path_ops);

create index if not exists reviews_ki_themen_gin
  on public.reviews using gin (ki_themen jsonb_path_ops);

-- =========================================================================
-- 5. Grants (Wurzel 6)
-- =========================================================================
-- Die drei Tabellen haben ihre Rechte bereits gesetzt (0006/0186/0262); neue
-- Spalten erben das Tabellen-GRANT. Ein spaltenweiser Entzug waere hier
-- wirkungslos, solange das Tabellen-GRANT besteht — und er ist auch nicht
-- gewollt: die Deutung ist genauso sichtbar wie der Text, den sie deutet.
--
-- Was NICHT passieren darf: dass ein Client sie SCHREIBT. Eine vom Client
-- gesetzte Stimmung waere eine Behauptung ueber eine Auswertung, die nie
-- stattgefunden hat. Fuer channex_review und guest_reviews_by_host ist das
-- bereits geregelt (beide entziehen insert/update/delete komplett).
-- public.reviews dagegen erlaubt dem Gast das Anlegen SEINER Bewertung — der
-- Server setzt die KI-Spalten spaeter selbst, der Gast darf sie nicht
-- mitschicken.
revoke update (ki_stimmung, ki_themen, ki_kernaussage, ki_bewertet_at)
  on public.reviews from anon, authenticated;
revoke insert (ki_stimmung, ki_themen, ki_kernaussage, ki_bewertet_at)
  on public.reviews from anon, authenticated;

-- =========================================================================
-- 6. Neue KI-Funktionsnamen fuer die Nutzungserfassung
-- =========================================================================
-- Derselbe Zwang wie 0492/0500: fehlt der Name im CHECK, steigt
-- `ki_nutzung._schreiben` STILL aus und der Tagesdeckel wird zur Attrappe.
--
-- Zwei Namen, weil sie sich unterschiedlich verhalten:
--   'bewertung_deuten'   — ein Aufruf je neuer Bewertung, klein und haeufig
--   'bewertung_bilanz'   — die Zusammenfassung ueber viele Bewertungen eines
--                          Objekts, selten und gross
alter table public.site_ai_usage
  drop constraint if exists site_ai_usage_funktion_check;

alter table public.site_ai_usage
  add constraint site_ai_usage_funktion_check check (
    funktion in (
      'umschreiben',
      'seo',
      'alt_text',
      'abschnitt',
      'blogbeitrag',
      'profil_vorschlag',
      'seite_uebersetzen',
      'gast_antwort',
      'wissen_import',
      'wissen_lernen',
      -- Stimmung + Themen EINER Bewertung (beim Import).
      'bewertung_deuten',
      -- Verbesserungs-Zusammenfassung ueber viele Bewertungen eines Objekts.
      'bewertung_bilanz'
    )
  );
