-- 0547 — Personal: Lohnläufe mit Statuskette (Entwurf → geprüft → freigegeben
-- → exportiert) und Monatsabschluss-Assistent (Plausibilitäts- und
-- Vollständigkeitsprüfung, Gastromatic).
--
-- Bisher war der Lohnexport ein Knopf ohne Zustand: wer exportiert hatte,
-- stand nirgends, und ob alle Zeiten bestätigt und alle Monate abgeschlossen
-- waren, prüfte niemand. Der Lohnlauf macht den Monat zu einem Vorgang:
--   * pruefungen  Ergebnis des Assistenten: unbestätigte Zeiten, offene
--                 Stempelungen, fehlende Monatsabschlüsse, Personen ohne Lohn/
--                 Währung, fehlende Lohnarten, Verdienstgrenzen überschritten.
--   * Nur freigegebene Läufe dürfen exportieren; nur bestätigte Zeiten gehen
--                 in den Export (Gastromatic: „nur freigegebene Zeiten").
-- Finanzen: kein grant, kein Direktpfad (Wurzel 6).

create table if not exists public.personal_lohnlaeufe (
    id               uuid primary key default gen_random_uuid(),
    tenant_id        uuid not null references public.tenants (id) on delete cascade,
    jahr             smallint not null check (jahr between 2000 and 2100),
    monat            smallint not null check (monat between 1 and 12),
    status           text not null default 'entwurf'
        check (status in ('entwurf', 'geprueft', 'freigegeben', 'exportiert')),
    -- {"geprueft_am": "...", "fehler": [{"art": "...", "user_id": "...", "werte": {...}}],
    --  "warnungen": [...], "personen": n, "zeiten": n}
    pruefungen       jsonb not null default '{}'::jsonb,
    geprueft_von     uuid references public.users (id) on delete set null,
    geprueft_am      timestamptz,
    freigegeben_von  uuid references public.users (id) on delete set null,
    freigegeben_am   timestamptz,
    exportiert_von   uuid references public.users (id) on delete set null,
    exportiert_am    timestamptz,
    export_format    text check (export_format is null or export_format in ('csv', 'datev_lodas')),
    export_name      text,
    notiz            text,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now(),
    unique (tenant_id, jahr, monat),
    -- Die Kette ist gerichtet: freigegeben setzt geprüft voraus, exportiert freigegeben.
    constraint personal_lohnlaeufe_kette check (
        (status = 'entwurf')
        or (status = 'geprueft' and geprueft_am is not null)
        or (status = 'freigegeben' and geprueft_am is not null and freigegeben_am is not null)
        or (status = 'exportiert' and geprueft_am is not null and freigegeben_am is not null
            and exportiert_am is not null and export_format is not null)
    )
);
alter table public.personal_lohnlaeufe enable row level security;
drop policy if exists personal_lohnlaeufe_tenant on public.personal_lohnlaeufe;
create policy personal_lohnlaeufe_tenant on public.personal_lohnlaeufe
    for all using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
revoke all on public.personal_lohnlaeufe from anon, authenticated;
drop trigger if exists personal_lohnlaeufe_updated_at on public.personal_lohnlaeufe;
create trigger personal_lohnlaeufe_updated_at
    before update on public.personal_lohnlaeufe
    for each row execute function public.set_updated_at();

comment on table public.personal_lohnlaeufe is
  'Lohnlauf je Monat (0547): Statuskette entwurf→geprueft→freigegeben→exportiert mit '
  'Prüfergebnis des Monatsabschluss-Assistenten. Export nur aus freigegebenem Lauf.';
