-- 0129_dossier_drop_duplicate_capacity.sql — Korrektur zu 0127.
--
-- 0127 hatte properties.capacity_persons + capacity_sqm angelegt. Das DUPLIZIERT
-- bestehende Felder: die Personen-Kapazität ist properties.max_guests, die Fläche
-- liegt in type_attributes.size_m2 (beide werden im Objekt-Übersichts-Tab
-- gepflegt). Die Kartei zeigt diese Werte read-only aus der bestehenden Quelle,
-- statt eine zweite Wahrheit zu halten. Darum die beiden Spalten wieder entfernen.
--
-- house_name, internal_house_no, bfe_number, boligtype bleiben (haben kein
-- Bestandsfeld). Die Spalten sind erst frisch angelegt und garantiert leer.

alter table public.properties
  drop column if exists capacity_persons,
  drop column if exists capacity_sqm;
