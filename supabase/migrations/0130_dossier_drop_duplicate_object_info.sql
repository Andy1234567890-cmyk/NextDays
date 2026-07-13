-- 0130_dossier_drop_duplicate_object_info.sql — Korrektur zu 0127.
--
-- Zwei von 0127 (Kartei) angelegte properties-Spalten DUPLIZIEREN bestehende,
-- im Objekt bereits gepflegte Felder und werden entfernt:
--   house_name        → properties.title (Feld „Name" im Übersichts-Tab)
--   internal_house_no → properties.house_number (Adresse im Standort-Tab)
--
-- Die Kartei zeigt diese Werte read-only aus der bestehenden Quelle. Beide
-- Spalten sind frisch aus 0127 und leer (live geprüft) — kein Datenverlust.
--
-- boligtype wird NICHT angefasst: es ist eine Alt-Spalte aus 0009 (nicht von der
-- Kartei) und wird hier absichtlich unberührt gelassen.

alter table public.properties
  drop column if exists house_name,
  drop column if exists internal_house_no;
