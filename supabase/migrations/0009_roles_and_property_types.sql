-- 0009_roles_and_property_types.sql — Lastenheft: Rollen + Beherbergungs-Typen
--
-- Erweitert bestehende Enums/Tabellen. Additiv (frühere Migrationen unverändert).

-- Neue Rollen (Lastenheft §4): admin, co_admin zusätzlich zu owner/staff/cleaner.
-- ALTER TYPE ... ADD VALUE muss außerhalb einer Transaktion laufen; Supabase-CLI
-- führt jede Migration einzeln aus. IF NOT EXISTS macht es idempotent.
alter type public.user_role add value if not exists 'admin';
alter type public.user_role add value if not exists 'co_admin';

-- Beherbergungs-Typ (ADR-0007): steuert Checklisten/Shortcodes/Onboarding.
create type public.property_type as enum (
    'ferienhaus', 'appartement', 'glamping', 'tiny_house', 'stellplatz', 'hausboot'
);

alter table public.properties
    add column property_type public.property_type not null default 'ferienhaus',
    -- typ-spezifische Attribute (ADR-0007): im Service typabhängig validiert.
    add column type_attributes jsonb not null default '{}',
    -- Adress-Split (Lastenheft §6): strukturiert statt Freitext. Nullable, da
    -- Bestand 'address' (Freitext) erhalten bleibt.
    add column street text,
    add column house_number text,
    add column postal_code text,
    add column city text,
    add column country text,
    -- DK-Onboarding-Felder (nullable, global nicht erzwungen).
    add column bfe_number text,
    add column boligtype text;
