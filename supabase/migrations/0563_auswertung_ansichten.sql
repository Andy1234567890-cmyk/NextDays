-- 0563 — Gespeicherte Ansichten der Auswertung (Hostaway „Custom Views").
--
-- WAS EINE ANSICHT IST: der komplette Filterstand eines Reiters (Zeitraum
-- oder Schnellwahl, Bezug, Objekte, Kanäle, Status, Vergleich) plus die
-- Spaltenwahl und -reihenfolge der Tabelle. Hostaway speichert das je NUTZER,
-- nicht je Konto: „Die Ansichten werden benutzerbezogen gespeichert, sodass
-- jeder Benutzer seine eigenen, auf seine Bedürfnisse zugeschnittenen
-- Ansichten erstellen kann." Wir übernehmen das — eine Ansicht ist
-- Arbeitswerkzeug einer Person, keine Konto-Einstellung.
--
-- SCHNELLWAHL BLEIBT DYNAMISCH: steht im Filter `schnell = 'vormonat'`, wird
-- beim Laden der Ansicht der Vormonat VON HEUTE gesetzt, nicht das Datum vom
-- Tag des Speicherns. Nur eine frei gewählte Spanne speichert feste Daten.
-- Das ist Hostaways Zusage „keine Aktualisierung der Daten erforderlich".
--
-- WURZEL 6: Lesen nur die EIGENEN Zeilen (tenant UND user), Schreiben
-- ausschließlich über die API (revoke). Eine Ansicht trägt keine Finanzdaten,
-- aber Objektlisten und Filter — die eines Kollegen gehen niemanden etwas an.

create table if not exists public.auswertung_ansichten (
    id          uuid primary key default gen_random_uuid(),
    tenant_id   uuid not null references public.tenants (id) on delete cascade,
    user_id     uuid not null references public.users (id) on delete cascade,
    name        text not null check (length(btrim(name)) between 1 and 80),
    -- Welcher Reiter die Ansicht trägt (Spaltenwahl gilt je Tabelle).
    reiter      text not null check (length(reiter) between 1 and 40),
    -- Der Filterstand: {schnell, von, bis, bezug, propertyIds, channels,
    -- status, vergleich}. JSON, weil die Filterleiste wächst — jede neue
    -- Dimension eine Spalte zu geben hieße für jeden Filter eine Migration.
    filter      jsonb not null default '{}'::jsonb,
    -- Sichtbare Spalten in Anzeigereihenfolge.
    spalten     jsonb not null default '[]'::jsonb,
    -- Umschalter des Reiters (je Buchung / je Objekt, je Monat, …).
    optionen    jsonb not null default '{}'::jsonb,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now(),
    unique (user_id, reiter, name)
);

create index if not exists auswertung_ansichten_user_idx
    on public.auswertung_ansichten (user_id, reiter);

drop trigger if exists set_updated_at on public.auswertung_ansichten;
create trigger set_updated_at before update on public.auswertung_ansichten
    for each row execute function public.set_updated_at();

alter table public.auswertung_ansichten enable row level security;

drop policy if exists auswertung_ansichten_eigene on public.auswertung_ansichten;
create policy auswertung_ansichten_eigene on public.auswertung_ansichten
    for select
    using (
        tenant_id = public.current_tenant_id()
        and user_id = auth.uid()
    );

revoke all on public.auswertung_ansichten from anon, authenticated;
grant select on public.auswertung_ansichten to authenticated;

comment on table public.auswertung_ansichten is
    'Gespeicherte Filter-/Spaltenansichten der Auswertung, je Nutzer (Hostaway Custom Views). Schreiben nur über die API.';
