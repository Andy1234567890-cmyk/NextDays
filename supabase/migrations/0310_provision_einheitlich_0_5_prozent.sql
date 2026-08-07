-- 0310_provision_einheitlich_0_5_prozent.sql — Provisionssatz vereinheitlicht
--
-- Preisliste Abschnitt 2 (Stand 07.08.2026): die externe OTA-Provision beträgt
-- einheitlich 0,5 % vom Buchungsumsatz. Die frühere Objektzahl-Staffel
-- (1 % bis 100 Objekte, 0,5 % ab 101) aus 0118 ist ABGESCHAFFT.
--
-- Diese Migration ändert KEINE Daten: bereits erfasste Ledger-Zeilen tragen
-- ihren Satz als Snapshot in `rate` und bleiben unangetastet — eine bereits
-- entstandene (oder gar fakturierte) Provision nachträglich umzurechnen würde
-- gestellte Rechnungen verfälschen. Neue Zeilen bekommen 0,005 aus dem Service
-- (subscriptions.COMMISSION_RATE_STANDARD, die EINE Quelle des Satzes).
--
-- Korrigiert werden nur die Tabellen-/Spalten-Kommentare, die die alte Staffel
-- als geltende Regel beschreiben (0118, 0182). Ein Kommentar, der einen
-- falschen Preis behauptet, ist die nächste Fehlerquelle beim Nachlesen.

comment on table public.commission_ledger is
  'Provisions-Ledger für externe OTA-Buchungen (0,5 %). Nachgelagerte '
  'Monatsabrechnung als Stripe-Invoice-Item aufs Tenant-Abo. NICHT die '
  'Portal-Provision (die läuft sofort über payments.application_fee).';

comment on column public.commission_ledger.rate is
  'Satz als Faktor zum Buchungszeitpunkt (Snapshot): 0.005 = 0,5 %%. '
  'Altbestand kann 0.01 (1 %%) tragen — bis 07.08.2026 galt eine Staffel '
  'nach Objektzahl. Eingefroren, damit gestellte Rechnungen stimmen.';

comment on table public.platform_fees is
  'Plattform-Provision (8 %, platform_fee_bps) je Marktplatz-Buchung — '
  'auditierbarer Spiegel der sofort einbehaltenen Stripe application_fee / '
  'PayPal platform_fee. NICHT commission_ledger (OTA-0,5 %-Provision). Nur '
  'service_role liest/schreibt (Finanzdaten, Wurzel 6).';
