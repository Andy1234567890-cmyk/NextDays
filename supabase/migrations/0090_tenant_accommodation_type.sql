-- 0090_tenant_accommodation_type.sql — Beherbergungsart des Mandanten
--
-- myNextDays wird für Ferienwohnungs-Vermieter UND Hotels angeboten. Die
-- Beherbergungsart steuert die Dashboard-Navigation (Begriffe wie
-- „Objekte" vs. „Zimmer", Eigentümer-Modul nur für Ferienvermietung) und
-- künftig typspezifische Module. Getrennt von business_type (0066), das
-- das Vermarktungsmodell (agency/self_managed) beschreibt.
--
-- Bestand: alle bisherigen Mandanten sind Ferienwohnungs-Betriebe →
-- Default 'vacation_rental' beschreibt den Bestand korrekt.
alter table public.tenants
    add column if not exists accommodation_type text not null default 'vacation_rental'
        check (accommodation_type in ('vacation_rental', 'hotel'));
