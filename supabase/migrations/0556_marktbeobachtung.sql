-- Marktbeobachtung: aggregierte Konkurrenzpreise je Gebiet und Tag.
--
-- WARUM AGGREGIERT UND NICHT JE OBJEKT
-- ====================================
-- Gespeichert wird ausschliesslich der MEDIAN je Rasterzelle und Aufenthaltstag,
-- nie ein Einzelinserat und nie ein fremder Objektname. Zwei Gruende:
--   * Rechtlich: eine Sammlung benannter Fremdinserate waere eine Wettbewerber-
--     Datenbank im Produkt (EU-Datenbankrichtlinie 96/9/EG, DSGVO bei
--     Gastgeberdaten). Ein Median ueber >= _MIN_OBJEKTE Objekte ist eine
--     abgeleitete Kennzahl, kein Datenbankauszug.
--   * Fachlich: fuer die Preisfindung braucht der Betrieb das Preisniveau
--     seiner Umgebung, nicht den Namen des Nachbarn.
--
-- WARUM EIN RASTER UND KEIN UMKREIS JE OBJEKT
-- ===========================================
-- Ein Abruf je Objekt und Tag waere bei 18 Objekten x 400 Tagen nicht
-- durchfuehrbar. Das Raster buendelt: ein Abruf deckt alle Objekte einer Zelle
-- ab. Zellengroesse in Grad, damit sie ohne PostGIS berechenbar bleibt.

create table if not exists public.markt_beobachtung (
  id            uuid primary key default gen_random_uuid(),
  -- Rasterzelle: auf _ZELLE_GRAD gerundete Koordinate der Zellmitte.
  zelle_lat     numeric(9,5) not null,
  zelle_lng     numeric(9,5) not null,
  -- Aufenthaltstag, fuer den der Preis gilt (nicht der Abrufzeitpunkt).
  tag           date not null,
  -- Objekttyp, damit sich Ferienhaus nicht mit B&B-Zimmer vergleicht. Ohne
  -- diese Trennung sinkt der Median in der Hochsaison, weil die guten Haeuser
  -- ausgebucht sind und nur Zimmer uebrig bleiben (live gemessen 04.09.2026:
  -- Juli-Median 671 DKK ungefiltert gegen 1304 DKK mit Typfilter).
  objekt_art    text not null default 'entire_home',
  -- Der Median. Waehrung getrennt gefuehrt (Wurzel 4: kein EUR-Hardcode).
  median_preis  numeric(12,2) not null,
  waehrung      text not null,
  -- Belastbarkeit: wie viele Objekte trugen den Median, und wie streut er.
  anzahl        integer not null,
  p25_preis     numeric(12,2),
  p75_preis     numeric(12,2),
  -- UNSERE Uhr, klar als solche benannt (Wurzel 5b): wann WIR abgerufen haben.
  abgerufen_am  timestamptz not null default now(),
  quelle        text not null,
  constraint markt_beobachtung_anzahl_positiv check (anzahl > 0),
  constraint markt_beobachtung_preis_positiv check (median_preis > 0)
);

-- Ein Wert je Zelle/Tag/Art/Quelle; ein erneuter Abruf aktualisiert ihn
-- (Wurzel 2: der taegliche Lauf darf beliebig oft laufen).
create unique index if not exists markt_beobachtung_eindeutig
  on public.markt_beobachtung (zelle_lat, zelle_lng, tag, objekt_art, quelle);

create index if not exists markt_beobachtung_tag
  on public.markt_beobachtung (tag);

-- Wurzel 6: Marktdaten sind betriebsuebergreifend und gehoeren keinem Tenant.
-- Sie duerfen von JEDEM angemeldeten Betrieb GELESEN werden (das ist der
-- Produktnutzen), aber ausschliesslich vom Server geschrieben.
alter table public.markt_beobachtung enable row level security;

drop policy if exists markt_beobachtung_lesen on public.markt_beobachtung;
create policy markt_beobachtung_lesen
  on public.markt_beobachtung for select
  to authenticated
  using (true);

revoke insert, update, delete on public.markt_beobachtung from anon, authenticated;
revoke all on public.markt_beobachtung from anon;

comment on table public.markt_beobachtung is
  'Aggregierte Marktpreise je Rasterzelle und Aufenthaltstag. Nur Mediane ueber '
  'mehrere Objekte, nie Einzelinserate oder Fremdnamen. Schreibt nur der Server.';
