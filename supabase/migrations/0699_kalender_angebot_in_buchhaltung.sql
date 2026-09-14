-- 0699_kalender_angebot_in_buchhaltung.sql
-- Brücke Kalender-Angebot (booking_offers, 0586) ↔ Buchhaltungs-Angebot (quotes).
--
-- Befund 13.09.2026: „Reservierung mit Angebot" im Kalender legt ein
-- booking_offer an (Preis-Snapshot, Mail mit Annahmelink, Zahlungslink). Das
-- Buchhaltungsmodul führt Angebote in `quotes` — die beiden kannten sich nicht,
-- ein aus dem Kalender verschicktes Angebot fehlte unter /buchhaltung/angebote.
--
-- Ab jetzt spiegelt der booking_offers-Slice jedes Angebot als `quotes`-Zeile,
-- sobald der Betrieb das Buchhaltungsmodul gebucht hat (modul3_buchhaltung),
-- und hält den Status nach (sent/accepted/declined/expired/cancelled).
-- Beide Richtungen verweisen aufeinander; der Unique-Index ist der Backstop
-- gegen doppelte Spiegel bei Retry (Wurzel 2).
alter table public.booking_offers
    add column if not exists quote_id uuid references public.quotes(id) on delete set null;
alter table public.quotes
    add column if not exists booking_offer_id uuid references public.booking_offers(id) on delete set null;
create unique index if not exists quotes_booking_offer_uidx
    on public.quotes (booking_offer_id) where booking_offer_id is not null;
comment on column public.quotes.booking_offer_id is
    'Kalender-Angebot (booking_offers), aus dem dieses Buchhaltungs-Angebot gespiegelt wurde.';
