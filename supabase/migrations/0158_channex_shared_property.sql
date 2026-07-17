-- 0158_channex_shared_property.sql — mehrere Zimmer-Objekte teilen EINE Channex-Property
--
-- Hotel-Modell: 1 properties-Zeile = 1 buchbare Einheit (Zimmer) bleibt
-- unverändert. Auf der Channex-Seite ist ein Hotel aber EINE Property mit
-- n Room-Types (Channex-ARI erlaubt nur EINE property_id je Request; die
-- PMS-Zertifizierung verlangt Full Sync in 2 Calls und Restriktions-Updates
-- über mehrere Room-Types in 1 Call). Dafür dürfen mehrere channex_property_map-
-- Zeilen (je Zimmer eine) auf DIESELBE channex_property_id zeigen — der bisherige
-- Unique-Index verhinderte genau das. Die Eindeutigkeit je lokalem Objekt
-- (property_uidx, partial auf deleted_at is null) bleibt bestehen.

drop index if exists public.channex_property_map_channex_uidx;
create index if not exists channex_property_map_channex_idx
    on public.channex_property_map(channex_property_id);
