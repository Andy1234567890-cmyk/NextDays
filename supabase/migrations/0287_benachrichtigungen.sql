-- 0287 — In-App-Benachrichtigungen (die Glocke).
--
-- WARUM EINE EIGENE TABELLE UND KEIN VIERTER KANAL IM DISPATCHER ALLEIN:
-- E-Mail und SMS sind FLÜCHTIG — abgeschickt und weg. Eine In-App-Meldung muss
-- bleiben, bis der Nutzer sie gesehen hat, und sie braucht einen Lesestatus.
-- Der Dispatcher bekommt dafür den Kanal `inapp`, der hier eine Zeile schreibt,
-- statt zu versenden; die Präferenz-Prüfung bleibt dieselbe (0225-Katalog).
--
-- EMPFÄNGER IST EIN NUTZER, NICHT DER MANDANT. Eine Benachrichtigung an „den
-- Betrieb" gibt es nicht: Gelesen-Status, Rollen-Sicht und die Glocke hängen an
-- genau einer Person. `tenant_id` steht trotzdem daneben — für den Mandanten-
-- Scope der Policies und damit ein Objektbezug nicht über Tenant-Grenzen zeigt.

create table if not exists public.notifications (
    id           uuid primary key default gen_random_uuid(),
    tenant_id    uuid not null references public.tenants(id) on delete cascade,
    -- Der Mensch, dem die Glocke leuchtet.
    user_id      uuid not null references public.users(id) on delete cascade,
    -- Katalog-Schlüssel aus notification_settings/katalog.py
    -- (z. B. `listing_activity`). KEIN eigener Enum: der Katalog ist die eine
    -- Quelle der Wahrheit, und eine zweite Liste in der DB liefe auseinander
    -- (Wurzel 4).
    kategorie    text not null,
    titel        text not null,
    -- Fließtext, optional — kurze Meldungen kommen mit dem Titel aus.
    text         text,
    -- Wohin der Klick führt (relativer Pfad, z. B. `/objekte/<id>/fotos`).
    -- Relativ, damit ein Domänenwechsel (.com → .dk) keine toten Links
    -- hinterlässt.
    ziel_pfad    text,
    -- Objektbezug, falls die Meldung zu einem Objekt gehört: erlaubt der UI, sie
    -- am Objekt zu zeigen, und räumt sie mit, wenn das Objekt verschwindet.
    property_id  uuid references public.properties(id) on delete cascade,
    -- Fachlicher Schlüssel gegen Doppelmeldungen (Wurzel 2): „Balkon hat kein
    -- Foto" darf bei jedem Sync neu geprüft, aber nicht neu gemeldet werden.
    -- NULL = keine Entdopplung gewünscht (echte Einzelereignisse).
    dedup_key    text,
    gelesen_am   timestamptz,
    created_at   timestamptz not null default now()
);

-- Ein OFFENER Eintrag je dedup_key und Nutzer. Partiell auf `gelesen_am is
-- null`: hat der Nutzer die Meldung gelesen und tritt der Zustand später erneut
-- ein, darf sie wieder erscheinen — sonst bliebe ein zweites Auftreten für immer
-- stumm.
create unique index if not exists notifications_dedup_offen_uq
    on public.notifications (user_id, dedup_key)
    where dedup_key is not null and gelesen_am is null;

-- Die Glocke fragt genau das: meine ungelesenen, neueste zuerst.
create index if not exists notifications_user_offen_idx
    on public.notifications (user_id, created_at desc)
    where gelesen_am is null;
create index if not exists notifications_user_idx
    on public.notifications (user_id, created_at desc);
create index if not exists notifications_property_idx
    on public.notifications (property_id)
    where property_id is not null;

alter table public.notifications enable row level security;

-- Wurzel 6: `enable rls` + Tenant-Policy reicht NICHT. Ein Client mit gültigem
-- JWT + anon-Key spricht PostgREST direkt an und umgeht FastAPI.
--   * Schreiben darf ausschließlich der Server (service_role) — sonst könnte
--     sich jeder eingeloggte Nutzer selbst (oder einem Kollegen) beliebige
--     Meldungen unterschieben.
--   * LESEN muss `authenticated` erlaubt sein, sonst ist das Realtime-Abo der
--     Glocke eine stumme Attrappe (die UI sähe live aus und aktualisierte nie).
--     Welche ZEILEN, entscheidet die Policy unten.
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;

-- Nur die EIGENEN Meldungen, und nur im eigenen Mandanten. `auth.uid()` ist der
-- eingeloggte Nutzer — ein fremder `user_id` ist damit unsichtbar, auch per
-- direktem `curl` gegen /rest/v1/notifications.
create policy notifications_select_eigene on public.notifications
    for select to authenticated
    using (user_id = auth.uid() and tenant_id = public.current_tenant_id());

-- Restriktiv für ALLE Kommandos: schließt den Schreibpfad mit, nicht nur select
-- (Wurzel 6 — ein reines `for select` lässt insert/update/delete offen).
create policy notifications_tenant_restrict on public.notifications
    as restrictive for all
    using (tenant_id = public.current_tenant_id());

-- Realtime: die Glocke abonniert diese Tabelle. Grant (oben) UND Publikation
-- müssen BEIDE stimmen, sonst ist das Abo eine Attrappe.
do $$
begin
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'notifications'
    ) then
        alter publication supabase_realtime add table public.notifications;
    end if;
end $$;

comment on table public.notifications is
    'In-App-Benachrichtigungen (Glocke). Empfänger ist ein NUTZER, nicht der '
    'Mandant — Lesestatus hängt an einer Person. Geschrieben nur vom Server '
    'über den Dispatcher-Kanal `inapp`, gelesen nur vom Empfänger selbst.';
comment on column public.notifications.kategorie is
    'Schlüssel aus notification_settings/katalog.py — kein eigener DB-Enum, '
    'sonst zwei Listen, die auseinanderlaufen.';
comment on column public.notifications.dedup_key is
    'Fachlicher Schlüssel gegen Doppelmeldungen. Der UNIQUE-Index greift nur '
    'für UNGELESENE: nach dem Lesen darf derselbe Zustand erneut melden.';
