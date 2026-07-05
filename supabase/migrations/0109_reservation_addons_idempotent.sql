-- 0109_reservation_addons_idempotent.sql — Idempotenz für Gast-Addon-Käufe
--
-- BUG (Loop-Fund): purchase_addons fügt reservation_addons ohne jede Dedup ein.
-- Ein Doppelklick im Gast-Portal oder ein Client-Retry nach Timeout legt für
-- dieselbe (reservation_id, addon_id) mehrere Zeilen an → der Gast wird doppelt
-- berechnet. Es gab keinen Unique-Constraint.
--
-- FIX: partieller Unique-Index auf (reservation_id, addon_id) für AKTIVE Käufe
-- (status <> 'cancelled'). Stornierte Käufe bleiben ausgenommen, damit ein Addon
-- nach Storno erneut gekauft werden kann. Der Code stellt auf Upsert um
-- (on_conflict → Menge/Preis aktualisieren statt Duplikat).
-- Live verifiziert: 0 Bestands-Duplikate (Index gefahrlos anlegbar).

create unique index if not exists reservation_addons_active_uidx
    on public.reservation_addons (reservation_id, addon_id)
    where status <> 'cancelled';
