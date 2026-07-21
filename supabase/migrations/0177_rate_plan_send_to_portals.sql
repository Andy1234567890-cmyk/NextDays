-- Steuerung PRO PREIS, ob er an die Buchungsportale (Booking & Co.) geht.
-- Standard ist der GRUNDPREIS: der erste/Standard-Preis eines Objekts wird immer
-- an die Portale gesendet. Weitere Preise gehen NUR an die Portale, wenn der Kunde
-- das für diesen Preis ausdrücklich einschaltet (send_to_portals = true). So bleibt
-- der Grundpreis der Normalfall; erweiterte Preise sind opt-in je Preis.
alter table public.rate_plans
  add column if not exists send_to_portals boolean not null default false;

comment on column public.rate_plans.send_to_portals is
  'Nur-für-erweiterte-Preise-Flag: true = dieser Preis wird zusätzlich zum '
  'Grundpreis an die Buchungsportale gesendet. Der Grundpreis (Standard-Preis '
  'des Objekts) geht immer, unabhängig von diesem Flag.';
