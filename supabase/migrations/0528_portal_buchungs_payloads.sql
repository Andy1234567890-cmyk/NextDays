-- 0528 — Portal-Preisdaten je Buchung, die NICHT über Channex kommen.
--
-- Anlass (02.09.2026): Der Airbnb-Historie-Import las bei Airbnb die volle
-- Reservierung (base_price, extra_guest_fee, standard_fees_details,
-- host_fee_base, payout_amount) und behielt davon zwei Zahlen:
-- total_amount = base_price, paid_amount = payout_amount. Kommentar im Code:
-- „Historie wird nicht rückwirkend abgerechnet." Genau das tut der Betrieb
-- aber. Ohne Payload hielt die Abrechnungskette base_price für den ganzen
-- Übernachtungspreis, legte die Stammdaten-Reinigung obendrauf und verlor den
-- Zusatzgast-Aufschlag: Airbnb 4.166,92, wir 4.116,92 — bei allen 149
-- Historie-Buchungen des Beta-Betriebs. Der Beweis stand die ganze Zeit in
-- unseren Daten: payout 3.521,05 ÷ (1 − 15,5 %) = 4.166,92 auf den Cent.
--
-- Diese Tabelle hält den Original-Payload des Portals für Buchungen, die
-- nicht über Channex hereinkamen (Airbnb-Historie; künftig weitere Quellen),
-- im SELBEN Format wie `channex_booking.raw` (ota_name + raw_message), damit
-- `owner_statements.gebuehren_quelle` sie ohne zweite Auswertungslogik liest.
-- Der Lader `owner_statements.payloads.payloads_laden` legt beide Quellen
-- unter demselben Schlüssel (`reservations.source_channex_booking_id`) ab.
--
-- Nur der Server schreibt und liest (service_role): Preisdaten des Portals
-- sind Betriebszahlen, kein Eigentümer- oder Mitarbeiter-Einblick (Wurzel 6).

create table if not exists public.portal_buchungs_payloads (
    id                   uuid primary key default gen_random_uuid(),
    tenant_id            uuid not null references public.tenants (id) on delete cascade,
    reservation_id       uuid not null references public.reservations (id) on delete cascade,
    -- Herkunft des Payloads: 'airbnb_historie' (Direktabruf bei Airbnb).
    quelle               text not null,
    ota_reservation_code text,
    raw                  jsonb not null,
    created_at           timestamptz not null default now(),
    updated_at           timestamptz not null default now(),
    -- EIN Payload je Buchung: ein zweiter Lauf ersetzt, statt zu verdoppeln
    -- (Wurzel 2 — der Import ist wiederholbar).
    unique (reservation_id)
);

comment on table public.portal_buchungs_payloads is
    'Original-Preisdaten des Portals für Buchungen ohne Channex-Payload '
    '(z. B. Airbnb-Historie-Import). Format wie channex_booking.raw, damit die '
    'Abrechnungskette dieselbe Auswertung nutzt (0528).';
comment on column public.portal_buchungs_payloads.raw is
    '{ota_name, raw_message: {reservation: <Airbnb-Reservierung>}, meta}. Die '
    'Kette liest base_price/extra_guest_fee (Übernachtung), '
    'standard_fees_details (Gebühren) und host_fee_base (Provision) daraus.';

create index if not exists portal_buchungs_payloads_tenant_idx
    on public.portal_buchungs_payloads (tenant_id);
create index if not exists portal_buchungs_payloads_code_idx
    on public.portal_buchungs_payloads (tenant_id, ota_reservation_code);

alter table public.portal_buchungs_payloads enable row level security;
-- Server-only: kein Zugriff über den anon-Key, auch nicht lesend (Wurzel 6).
revoke all on public.portal_buchungs_payloads from anon, authenticated;
