-- 0698_positionen_abrechnungsbasis.sql
-- Beleg-Positionen für Übernachtungsbetriebe (Hotel, Ferienobjekt, Camping).
--
-- Befund (Recherche 13.09.2026 über Smoobu, Hostaway, Guesty, Beds24,
-- Cloudbeds, Mews, apaleo, Newbook, Campspot, igumbi): jede Position trägt
-- eine ABRECHNUNGSBASIS aus einer festen Menge — pauschal, je Nacht, je Person,
-- je Person und Nacht, je Stück — plus ihren eigenen Steuersatz; die Übernachtung
-- ist EINE Zeile „Nächte × Preis". Der übernommene Editor kannte nur eine
-- Freitext-Einheit („Stk", „m²", „lfm") aus dem Handwerk.
--
-- Deshalb:
--   * `basis` an Positionen (invoice_line_items, quote_line_items) und am
--     Artikelstamm (billing_items). Am Beleg nullable — Altbestand hat keine.
--     Am Artikel NOT NULL mit Vorgabe 'per_unit': das ist keine erfundene
--     Fachaussage (Wurzel 4), sondern die neutrale Form „Preis je Stück", die
--     jeder bestehende Artikel bereits hatte.
--   * Kopfdaten am Beleg: Aufenthalt (stay_from/stay_to) und Personenzahl
--     (guest_count), aus denen die Mengen der Positionen gerechnet werden.
-- Die Werte spiegeln `addons.schemas.AddonBasis` (per_stay|per_night|
-- per_guest|per_unit) plus `per_guest_night` (Kurtaxe, Frühstück).
alter table public.billing_items
    add column if not exists basis text not null default 'per_unit';
alter table public.billing_items drop constraint if exists billing_items_basis_chk;
alter table public.billing_items add constraint billing_items_basis_chk check (
    basis in ('per_stay', 'per_night', 'per_guest', 'per_guest_night', 'per_unit')
);

alter table public.invoice_line_items add column if not exists basis text;
alter table public.invoice_line_items drop constraint if exists invoice_line_items_basis_chk;
alter table public.invoice_line_items add constraint invoice_line_items_basis_chk check (
    basis is null or basis in ('per_stay', 'per_night', 'per_guest', 'per_guest_night', 'per_unit')
);

alter table public.quote_line_items add column if not exists basis text;
alter table public.quote_line_items drop constraint if exists quote_line_items_basis_chk;
alter table public.quote_line_items add constraint quote_line_items_basis_chk check (
    basis is null or basis in ('per_stay', 'per_night', 'per_guest', 'per_guest_night', 'per_unit')
);

alter table public.invoices
    add column if not exists stay_from   date,
    add column if not exists stay_to     date,
    add column if not exists guest_count integer check (guest_count is null or guest_count >= 0);
alter table public.quotes
    add column if not exists stay_from   date,
    add column if not exists stay_to     date,
    add column if not exists guest_count integer check (guest_count is null or guest_count >= 0);

comment on column public.invoice_line_items.basis is
    'Abrechnungsbasis der Position: per_stay (pauschal), per_night, per_guest, per_guest_night, per_unit. Die Menge ergibt sich aus Basis × Nächte/Personen des Belegkopfs.';
