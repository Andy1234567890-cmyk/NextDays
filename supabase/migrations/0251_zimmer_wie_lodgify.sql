-- 0251 — Zimmer sind wieder nur Zimmer (Rueckbau von 0247 und 0248)
--
-- Entscheidung vom 01.08.2026, nach Abgleich mit der echten Lodgify-Oberflaeche
-- (/rental/{id}/overview, dasselbe Konto, live durchgeklickt):
--
--   * Zimmer  = ZWEI Gruppen (privat/gemeinschaftlich) mit einem Zaehler je
--               Zimmertyp. Kein Detail, kein Eigenname, keine en-suite-Angabe,
--               keine Ausstattung pro Zimmer.
--   * Betten  = objektweiter Zaehler in einem EIGENEN Editor
--               (Babybett, Kinderbett, Doppelbett … je "- 0 +").
--   * Fotos   = flache Liste, KEIN Reiter "nach Zimmern".
--
-- 0247 (Betten ans Zimmer) und 0248 (Foto ans Zimmer) hatten das anders
-- angenommen — belegt war das nur aus Lodgify-Hilfeartikeln, nicht aus der
-- Oberflaeche. Diese Migration nimmt beides zurueck.
--
-- Wurzel 1 (Gegenzustand): die Betten der Zimmer gehen NICHT verloren, sie
-- werden je Objekt aufsummiert und landen wieder in
-- properties.type_attributes.beds — dem Feld, aus dem 0247 sie geholt hat.
-- Fotos behalten ihr Bild, sie verlieren nur die Zuordnung.

begin;

-- === Betten zurueck ans Objekt ==============================================
-- Summe ueber alle Zimmer je Bett-Slug. Vorhandene type_attributes.beds werden
-- ueberschrieben: seit 0247 ist das Zimmer die Quelle, der Objekt-Wert ist der
-- eingefrorene Stand von damals. Objekte ohne Zimmer-Betten bleiben unberuehrt.
with je_slug as (
  select
    r.property_id,
    bett.key                              as slug,
    sum((bett.value #>> '{}')::int)       as anzahl
  from public.property_rooms r
  cross join lateral jsonb_each(r.betten) as bett(key, value)
  where jsonb_typeof(r.betten) = 'object'
    and jsonb_typeof(bett.value) = 'number'
    and (bett.value #>> '{}')::int > 0
  group by r.property_id, bett.key
),
summe as (
  select property_id, jsonb_object_agg(slug, anzahl) as betten
  from je_slug
  group by property_id
)
update public.properties p
set type_attributes = coalesce(p.type_attributes, '{}'::jsonb)
                      || jsonb_build_object('beds', summe.betten)
from summe
where summe.property_id = p.id;

-- === Fotos: Zimmer-Zuordnung entfaellt (0248) ===============================
drop index if exists public.property_photos_room_idx;

alter table public.property_photos
  drop column if exists room_id;

-- === Zimmer: nur noch Typ, Gruppe, Reihenfolge ==============================
-- Die abhaengigen Constraints und Indexe (en-suite-Kopplung, betten-ist-Objekt)
-- fallen mit ihren Spalten weg.
alter table public.property_rooms
  drop column if exists betten,
  drop column if exists ausstattung,
  drop column if exists name,
  drop column if exists en_suite_schlafzimmer_id,
  drop column if exists en_suite;

comment on table public.property_rooms is
  'Zimmer eines Objekts als gezaehlte Einheiten: Typ (raum_typ) und Gruppe '
  '(privat/gemeinschaftlich). Eine Zeile = ein Zimmer. Betten und Ausstattung '
  'haengen am OBJEKT (properties.type_attributes.beds bzw. room_amenities), '
  'nicht am Zimmer — siehe 0251.';

commit;
