-- 0298 — Freitexte am Objekt für Gastnachrichten (`property_guest_portal`)
--
-- DER ANLASS (06.08.2026): Der Betrieb bringt 65 Platzhalter aus Lodgify mit.
-- 56 davon lassen sich aus vorhandenen Daten bedienen (Buchung, Objekt, Gast,
-- Bankprofil). Acht sind FREITEXTE, die es bei uns nirgends gab — es sind
-- genau die, in denen die eigentliche Gastkommunikation steckt:
-- Anreisebeschreibung, Hausregeln, Türanleitung.
--
-- WARUM `property_guest_portal` UND NICHT `properties`: Diese Texte gehen an
-- den GAST und stehen neben `door_code` und `wifi_password` (0296), die
-- dieselbe Schutzregel brauchen. `properties` ist der Vertriebs-/Inserats-Teil
-- (Titel, Beschreibung, Ausstattung) und wird an die Portale gesendet — eine
-- Türanleitung gehört dort nicht hin. Zudem gelten hier bereits die
-- RLS-Policies inklusive Owner-/Staff-Scope.
--
-- WARUM ACHT EINZELNE SPALTEN UND KEIN JSONB: Jeder dieser Texte wird von einem
-- EIGENEN Platzhalter angesprochen ({{CheckinInstructions}},
-- {{HouseDirections}} …). In einem JSONB-Klumpen wäre ein Tippfehler im
-- Schlüssel nicht prüfbar, und der Vorlagen-Editor könnte nicht anzeigen,
-- welcher Text am Objekt fehlt. Acht Spalten sind hier die ehrlichere Struktur.
--
-- LODGIFY-NAMEN, DIE DASSELBE MEINEN: `RentalDirections` und `HouseDirections`
-- sind beides die Anreisebeschreibung — EINE Spalte, beide Alt-Namen zeigen
-- über die Übersetzungstabelle darauf. Zwei Spalten anzulegen hieße, denselben
-- Text zweimal pflegen zu müssen und irgendwann zwei Versionen zu haben.

alter table public.property_guest_portal
  -- Wie der Gast ins Haus kommt (Ablauf), NICHT der Code selbst — der steht in
  -- `door_code` mit eigenen Sichtbarkeitsregeln.
  add column if not exists checkin_instructions  text,
  add column if not exists checkout_instructions text,
  -- Bedienung von Schloss/Schlüsselbox („zweimal drehen, dann klingelt es").
  add column if not exists door_instructions     text,
  -- Anfahrt: letzte Kilometer, Parken, was das Navi falsch macht.
  add column if not exists directions            text,
  -- Hausregeln (Rauchen, Haustiere, Ruhezeiten).
  add column if not exists house_rules           text,
  -- Hinweise zu Preisen/Nebenkosten, die der Gast vorab wissen soll.
  add column if not exists rates_notes           text,
  -- Mietvertrag/AGB als Text oder Link.
  add column if not exists rental_agreement      text,
  -- Empfehlungen vor Ort (Restaurants, Rabatte, Ausflüge).
  add column if not exists local_guide           text;

comment on column public.property_guest_portal.checkin_instructions is
  'Ablauf der Anreise fuer den Gast ({{CheckinInstructions}}). Der Tuercode '
  'selbst steht in door_code — der hat eigene Sichtbarkeitsregeln.';

comment on column public.property_guest_portal.directions is
  'Anfahrtsbeschreibung ({{HouseDirections}} und {{RentalDirections}} — '
  'Lodgify kennt zwei Namen fuer denselben Text, wir fuehren ihn einmal).';
