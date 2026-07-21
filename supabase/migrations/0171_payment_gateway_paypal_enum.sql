-- 0171_payment_gateway_paypal_enum.sql — payment_gateway um 'paypal' erweitern
--
-- PayPal wird als eigener Zahlungs-Gateway neben Stripe unterstützt (Multiparty:
-- verbundene Verkäufer + Plattform-Provision). Der Enum-Wert MUSS in einer
-- EIGENEN Migration hinzugefügt werden: Postgres verbietet die Nutzung eines neu
-- angelegten Enum-Werts in derselben Transaktion (apply-migrations.sh wrappt jede
-- Datei in EIN begin/commit) — sonst „unsafe use of new value 'paypal'". Die
-- Spalten/Policies/Indizes, die den Wert verwenden, folgen in 0172.
alter type public.payment_gateway add value if not exists 'paypal';
