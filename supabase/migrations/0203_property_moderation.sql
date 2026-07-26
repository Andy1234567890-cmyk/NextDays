-- Objekt-Freigabe für den Plattform-Marktplatz (AP4 des Admin-Dashboards).
--
-- BISHER: Ein Gastgeber schaltet sein Objekt selbst live. publish() setzt
-- status='active' + listed_on_marketplace=true; es gab keinerlei Prüfung durch
-- den Plattformbetreiber (kein moderation_status, kein Approve-Endpunkt).
--
-- NEU: Der EIGENE Marktplatz bekommt eine Freigabe. Bewusst NUR dieser Kanal:
--   • OTA-Vertrieb (channex_property_map.sync_enabled) und
--   • eigene Website (listed_on_website)
-- laufen ungeprüft weiter — der Betreiber ist dort nicht der Herausgeber, und
-- eine Freigabepflicht würde Gastgeber ohne Not blockieren. Auf dem eigenen
-- Marktplatz tritt myNextDays dagegen als Anbieter auf und haftet mit.
--
-- Die Sichtbarkeit auf dem Marktplatz ist damit eine UND-Verknüpfung aus drei
-- unabhängigen Achsen (keine ersetzt die andere):
--   status='active'  AND  listed_on_marketplace  AND  moderation_status='approved'
--
-- BESTANDSSCHUTZ (Wurzel 1: den Gegenzustand mitpflegen): Objekte, die HEUTE
-- live sind, müssen live bleiben. Sie werden unten auf 'approved' gesetzt —
-- ohne diesen Schritt würden sie beim Deploy schlagartig aus dem Marktplatz
-- fallen.

do $$
begin
    if not exists (select 1 from pg_type where typname = 'property_moderation_status') then
        create type public.property_moderation_status as enum (
            -- Noch nie zur Prüfung eingereicht (Neuanlage, Entwurf).
            'draft',
            -- Eingereicht, wartet auf den Betreiber.
            'pending',
            -- Freigegeben — erst dieser Zustand macht das Objekt marktplatz-sichtbar.
            'approved',
            -- Abgelehnt; der Grund steht in moderation_note.
            'rejected'
        );
    end if;
end $$;

alter table public.properties
    add column if not exists moderation_status public.property_moderation_status
        not null default 'draft',
    -- Begründung des Betreibers (bei Ablehnung Pflicht, sonst optional).
    add column if not exists moderation_note text,
    -- Wer zuletzt entschieden hat (Plattform-Admin) und wann.
    add column if not exists moderation_reviewed_by uuid
        references auth.users (id) on delete set null,
    add column if not exists moderation_reviewed_at timestamptz,
    -- Wann der Gastgeber zuletzt eingereicht hat (für die Warteschlange).
    add column if not exists moderation_submitted_at timestamptz;

comment on column public.properties.moderation_status is
    'Freigabe für den EIGENEN Marktplatz (Airbnb-artige Prüfung). Sichtbar ist '
    'ein Objekt nur bei status=active AND listed_on_marketplace AND '
    'moderation_status=approved. OTA/Website sind davon NICHT betroffen.';

-- Warteschlange des Backoffice: die wartenden zuerst, älteste oben.
create index if not exists properties_moderation_pending_idx
    on public.properties (moderation_status, moderation_submitted_at)
    where moderation_status = 'pending';

-- --- Bestandsschutz ---------------------------------------------------------
-- Alles, was bereits aktiv ist, gilt als geprüft. Idempotent: der Filter auf
-- 'draft' sorgt dafür, dass ein erneuter Lauf nichts überschreibt, was der
-- Betreiber inzwischen bewusst abgelehnt hat.
update public.properties
   set moderation_status = 'approved',
       moderation_reviewed_at = now()
 where status = 'active'
   and moderation_status = 'draft';
