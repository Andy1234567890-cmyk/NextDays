-- Airbnb-Importtitel aufteilen: Gast-Titel bleibt, interner Name geht in
-- `type_attributes.internal_name`.
--
-- Airbnbs Listen-Antwort (`mapping_details` →
-- `data.listing_id_dictionary.values[].title`) liefert keinen reinen Titel,
-- sondern den Anzeigenamen aus BEIDEN Titeln, getrennt durch einen Mittelpunkt:
--
--     "020 Lille Lægehus (1966) · FeWo Lille Lægehus"
--      └─ interner Name ────────┘   └─ Gast-Titel ─┘
--
-- Der Import übernahm diesen String unverändert als `properties.title`. Damit
-- stand die INTERNE Bezeichnung im Gast-Titel — dem Feld, das der Gast im
-- Marktplatz und auf den Portalen sieht. Bei vier der 18 Objekte war das ein
-- TÜRCODE: „005 Doravej (kode 0249)", „011 Mosbjergvej 439 (kode 7811)",
-- „012 Oddenvej 3 (kode 1753)", „022 Tolstrupvej 18b (2010)".
--
-- Dass der VORDERE Teil der interne Name ist, ist nicht geraten: die
-- Detail-Antwort desselben Listings führt beide Werte getrennt
-- (`listing_nickname` = "020 Lille Lægehus (1966)", `descriptions.name` =
-- "FeWo Lille Lægehus").
--
-- Abgrenzung: NUR Zeilen mit `airbnb_listing_id` werden angefasst. Es gibt
-- legitime Titel mit Mittelpunkt, die kein Airbnb-Import sind — die sieben
-- Demo-Hotelzimmer („Doppelzimmer 201 · Seeseite", „Suite 401 · Leuchtturm").
-- Dort ist der Mittelpunkt Teil des echten Namens und bleibt stehen.
--
-- Nur am ERSTEN Mittelpunkt geteilt (`split_part` würde bei mehreren den Rest
-- abschneiden), und ein bereits gepflegter `internal_name` bleibt unberührt.

update public.properties as p
set
  title = btrim(substring(p.title from position('·' in p.title) + 1)),
  type_attributes = coalesce(p.type_attributes, '{}'::jsonb)
    || jsonb_build_object(
         'internal_name',
         btrim(substring(p.title from 1 for position('·' in p.title) - 1))
       )
where p.airbnb_listing_id is not null
  and position('·' in p.title) > 1
  -- Auf beiden Seiten muss Text stehen, sonst entstünde ein leerer Titel.
  and btrim(substring(p.title from 1 for position('·' in p.title) - 1)) <> ''
  and btrim(substring(p.title from position('·' in p.title) + 1)) <> ''
  -- Wurzel 1: einen selbst gepflegten internen Namen nicht überschreiben.
  and coalesce(p.type_attributes->>'internal_name', '') = '';
