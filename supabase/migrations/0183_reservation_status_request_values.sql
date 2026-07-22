-- 0183_reservation_status_request_values.sql — Airbnb-Anfrage-Modell (Teil 1/2)
--
-- NUR die neuen reservation_status-Enum-Werte. BEWUSST in EIGENER Migration
-- VOR ihrer Nutzung (0184): `ALTER TYPE ... ADD VALUE` und die Verwendung des
-- neuen Werts dürfen NICHT in derselben Transaktion liegen (Postgres 55P04) —
-- der Migrations-Runner (apply-migrations.sh) fährt jede Datei in EINER
-- Transaktion, also muss der Wert in einer früheren, committeten Migration
-- entstehen. 0184 nutzt sie dann (EXCLUDE-Constraint, Service).
--
-- 'requested' = Gast-Anfrage, wartet auf Host-Entscheidung (Airbnb Request to Book)
-- 'declined'   = Host hat abgelehnt (getrennt von 'cancelled' für Timeline/Statistik)
-- 'expired'    = 24-h-Frist ohne Host-Entscheidung verstrichen (Auto-Ablauf)
alter type public.reservation_status add value if not exists 'requested';
alter type public.reservation_status add value if not exists 'declined';
alter type public.reservation_status add value if not exists 'expired';
