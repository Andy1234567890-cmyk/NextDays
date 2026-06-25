-- 0077_realtime_remaining_ui_tables.sql — restliche UI-Tabellen in Realtime
--
-- Projekt-Grundsatz: ALLES, was eine UI speist, läuft über Supabase-Realtime
-- (WebSocket), kein Polling. Diese beiden Tabellen fehlten noch in der
-- Publication:
--   * property_photos — speist die Foto-/Galerie-UI (Objekt → Fotos)
--   * owner_property_assignments — steuert die Owner-Portal-Sicht (welche Objekte
--     ein Eigentümer sieht)
--
-- Bewusst NICHT aufgenommen (rein technisch/intern, kein Live-UI-Bedarf):
-- ari_outbox (Channex-Sync-Outbox), channex_tax_map (statisches Mapping),
-- dp_pickup_snapshots (DP-Lernkurve), fx_rates (Kurs-Cache, täglich).

alter publication supabase_realtime add table public.property_photos;
alter publication supabase_realtime add table public.owner_property_assignments;
