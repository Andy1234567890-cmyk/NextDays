-- Zahlungsweg und Portalprovision aus der OTA-Buchung übernehmen.
--
-- Der Aggregator liefert in JEDER Buchungsnachricht drei Angaben, die wir
-- bisher ungelesen in `channex_booking.raw` versenken:
--
--   payment_collect  wer das Geld einzieht: 'property' (wir), 'ota' (das
--                    Portal hat schon kassiert) oder null (dann kassiert
--                    üblicherweise die Unterkunft)
--   payment_type     'credit_card' | 'bank_transfer' | null
--   ota_commission   die vom Portal einbehaltene Provision — laut Doku für
--                    Booking.com und Airbnb verfügbar
--
-- Warum das zählt: Ohne `payment_collect` weiß niemand, ob für eine Buchung
-- noch Geld einzuziehen ist — die Rezeption fragt beim Gast nach, obwohl das
-- Portal längst kassiert hat, oder umgekehrt. Und `ota_commission` ist die
-- einzige belastbare Quelle für den echten Nettoerlös je Portal; ohne sie
-- rechnet jede Auswertung mit Bruttobeträgen und überschätzt den Ertrag.
--
-- Bewusst KEIN Enum: der Aggregator kann Werte ergänzen, und ein unbekannter
-- Wert darf den Buchungsimport nicht kippen (Wurzel 5 — Kontroll-Signal nicht
-- verschlucken). Stattdessen Check-Constraints, die null zulassen.

alter table public.reservations
    -- Wer zieht ein? null = unbekannt/nicht geliefert (nicht „wir").
    add column if not exists payment_collect text,
    -- Wie wird gezahlt?
    add column if not exists payment_method_ota text,
    -- Portalprovision in der Buchungswährung (Bruttobetrag laut Portal).
    add column if not exists ota_commission numeric(12, 2);

do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'reservations_payment_collect_check'
    ) then
        alter table public.reservations
            add constraint reservations_payment_collect_check
            check (payment_collect is null
                   or payment_collect in ('property', 'ota'));
    end if;
    if not exists (
        select 1 from pg_constraint
        where conname = 'reservations_payment_method_ota_check'
    ) then
        alter table public.reservations
            add constraint reservations_payment_method_ota_check
            check (payment_method_ota is null
                   or payment_method_ota in ('credit_card', 'bank_transfer'));
    end if;
    if not exists (
        select 1 from pg_constraint
        where conname = 'reservations_ota_commission_check'
    ) then
        alter table public.reservations
            add constraint reservations_ota_commission_check
            check (ota_commission is null or ota_commission >= 0);
    end if;
end $$;

comment on column public.reservations.payment_collect is
    'Wer zieht das Geld ein: property (wir) oder ota (Portal hat kassiert). '
    'Aus der Buchungsnachricht des Aggregators; null = nicht geliefert.';
comment on column public.reservations.payment_method_ota is
    'Zahlungsart laut Portal: credit_card oder bank_transfer. Heißt bewusst '
    'nicht payment_type — so heißt bereits ein Enum für unsere EIGENEN '
    'Zahlungen (0005), das etwas völlig anderes bedeutet.';
comment on column public.reservations.ota_commission is
    'Vom Portal einbehaltene Provision in Buchungswährung. Grundlage für den '
    'echten Nettoerlös je Kanal.';
