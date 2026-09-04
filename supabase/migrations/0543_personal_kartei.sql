-- 0543 — Personalakte auf den Stand der Taskilo-Kartei (Freigabe des
-- Betreibers 04.09.2026): Verträge + Nachträge, Disziplinarmaßnahmen +
-- Vorfälle, Gespräche/Feedback, Nachweise (Ausbildung, Zertifikate, Sprachen,
-- Fähigkeiten, Berufserfahrung), Schulungen/Belehrungen, Compliance-Felder an
-- Dokumenten, Lohnmerkmale + Arbeitgeber-Aufschlag an der Akte.
--
-- Alles (§): NUR der Server liest und schreibt (Wurzel 6) — es sind
-- Personalakten-Inhalte (Abmahnungen, Gespräche, Verträge), die auch die
-- Schichtleitung nicht sieht (§4.3). Grants werden per Default-Privileges
-- (0187/0229) nicht vergeben; `revoke` steht trotzdem explizit da.
--
-- Was bewusst NICHT 1:1 aus Taskilo kommt:
--   * Steuerklasse/Kirchensteuer/Kinderfreibetrag als deutsche Auswahlliste —
--     bei 27 Ländern sind das freie Lohnmerkmale (`lohnmerkmale`, Paare
--     Schlüssel/Wert je Land), keine erfundenen Defaults (Wurzel 4).
--   * Zuschläge je Person — bleiben Betriebsregel (`personal_regeln`).
--   * Kostenrechnung mit hart 19,5 % Sozialabgaben — hier ein Aufschlag in
--     Prozent JE AKTE, den der Betrieb selbst einträgt; ohne Wert keine
--     Kostenzahl, kein Ersatzwert.

-- ============================================================================
-- 1) Akte: Lohnmerkmale, Arbeitgeber-Aufschlag, Familienstand, Kinder
-- ============================================================================
alter table public.personal_akten
    add column if not exists lohnmerkmale jsonb not null default '[]'::jsonb,
    add column if not exists arbeitgeber_aufschlag_pct numeric(5,2)
        check (arbeitgeber_aufschlag_pct is null or arbeitgeber_aufschlag_pct between 0 and 200),
    add column if not exists familienstand text
        check (familienstand is null or familienstand in
            ('ledig', 'verheiratet', 'partnerschaft', 'geschieden', 'verwitwet')),
    add column if not exists kinder_anzahl smallint
        check (kinder_anzahl is null or kinder_anzahl between 0 and 30);
comment on column public.personal_akten.lohnmerkmale is
    'Freie Lohnmerkmale je Land als Liste {schluessel, wert} (z. B. DE Steuerklasse, '
    'DK Skattekort-Typ). Keine Auswahlliste eines einzelnen Landes (Wurzel 4).';
comment on column public.personal_akten.arbeitgeber_aufschlag_pct is
    'Arbeitgeber-Nebenkosten in Prozent auf Lohn/Gehalt für die Kostenkachel. '
    'NULL = nicht erfasst → keine Kostenzahl, kein Ersatzwert.';

-- ============================================================================
-- 2) Dokumente: Compliance-Felder + zwei Arten
-- ============================================================================
alter table public.personal_dokumente
    add column if not exists dokument_nummer text,
    add column if not exists ausgestellt_am date,
    add column if not exists behoerde text;
alter table public.personal_dokumente drop constraint if exists personal_dokumente_art_check;
alter table public.personal_dokumente add constraint personal_dokumente_art_check
    check (art in (
        'vertrag', 'ausweis', 'arbeitserlaubnis', 'fuehrungszeugnis',
        'gesundheitszeugnis', 'belehrung', 'zertifikat', 'attest',
        'datenschutz', 'betriebsvereinbarung', 'sonstiges'
    ));

-- ============================================================================
-- 3) Verträge & Nachträge
-- ============================================================================
create table if not exists public.personal_vertraege (
    id               uuid primary key default gen_random_uuid(),
    tenant_id        uuid not null references public.tenants (id) on delete cascade,
    user_id          uuid not null references public.users (id) on delete cascade,
    art              text not null check (art in (
        'arbeitsvertrag', 'aenderung', 'verschwiegenheit', 'wettbewerbsverbot',
        'bonus', 'zielvereinbarung', 'sonstiges'
    )),
    titel            text not null,
    beschreibung     text,
    status           text not null default 'aktiv'
        check (status in ('entwurf', 'aktiv', 'abgelaufen', 'beendet')),
    version          text,
    unterzeichnet_am date,
    gueltig_ab       date,
    gueltig_bis      date,
    -- Namen der Unterzeichner (Freitext-Liste) und Vertragsbedingungen als
    -- Paare {schluessel, wert} — wie in der Taskilo-Kartei.
    unterzeichner    jsonb not null default '[]'::jsonb,
    bedingungen      jsonb not null default '[]'::jsonb,
    verlaengerung    text,
    kuendigung       text,
    dokument_id      uuid references public.personal_dokumente (id) on delete set null,
    erstellt_von     uuid references public.users (id) on delete set null,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now(),
    constraint personal_vertraege_bis_nach_ab
        check (gueltig_bis is null or gueltig_ab is null or gueltig_bis >= gueltig_ab)
);
create index if not exists personal_vertraege_user_idx on public.personal_vertraege (tenant_id, user_id);
alter table public.personal_vertraege enable row level security;
drop policy if exists personal_vertraege_tenant on public.personal_vertraege;
create policy personal_vertraege_tenant on public.personal_vertraege
    for all using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
revoke all on public.personal_vertraege from anon, authenticated;
drop trigger if exists personal_vertraege_updated_at on public.personal_vertraege;
create trigger personal_vertraege_updated_at
    before update on public.personal_vertraege
    for each row execute function public.set_updated_at();

create table if not exists public.personal_vertrag_nachtraege (
    id              uuid primary key default gen_random_uuid(),
    tenant_id       uuid not null references public.tenants (id) on delete cascade,
    vertrag_id      uuid not null references public.personal_vertraege (id) on delete cascade,
    datum           date not null,
    beschreibung    text not null,
    grund           text,
    -- [{feld, alt, neu}]
    aenderungen     jsonb not null default '[]'::jsonb,
    autorisiert_von uuid references public.users (id) on delete set null,
    created_at      timestamptz not null default now()
);
create index if not exists personal_vertrag_nachtraege_vertrag_idx
    on public.personal_vertrag_nachtraege (tenant_id, vertrag_id);
alter table public.personal_vertrag_nachtraege enable row level security;
drop policy if exists personal_vertrag_nachtraege_tenant on public.personal_vertrag_nachtraege;
create policy personal_vertrag_nachtraege_tenant on public.personal_vertrag_nachtraege
    for all using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
revoke all on public.personal_vertrag_nachtraege from anon, authenticated;

-- ============================================================================
-- 4) Disziplin: Maßnahmen + Vorfälle
-- ============================================================================
create table if not exists public.personal_massnahmen (
    id               uuid primary key default gen_random_uuid(),
    tenant_id        uuid not null references public.tenants (id) on delete cascade,
    user_id          uuid not null references public.users (id) on delete cascade,
    art              text not null check (art in (
        'ermahnung', 'abmahnung', 'letzte_abmahnung', 'freistellung', 'kuendigung'
    )),
    datum            date not null,
    grund            text not null,
    beschreibung     text,
    ausgestellt_von  uuid references public.users (id) on delete set null,
    zeuge            text,
    stellungnahme    text,
    folgetermin      date,
    geloest          boolean not null default false,
    geloest_am       date,
    loesung          text,
    dokument_id      uuid references public.personal_dokumente (id) on delete set null,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now()
);
create index if not exists personal_massnahmen_user_idx on public.personal_massnahmen (tenant_id, user_id);
alter table public.personal_massnahmen enable row level security;
drop policy if exists personal_massnahmen_tenant on public.personal_massnahmen;
create policy personal_massnahmen_tenant on public.personal_massnahmen
    for all using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
revoke all on public.personal_massnahmen from anon, authenticated;
drop trigger if exists personal_massnahmen_updated_at on public.personal_massnahmen;
create trigger personal_massnahmen_updated_at
    before update on public.personal_massnahmen
    for each row execute function public.set_updated_at();

create table if not exists public.personal_vorfaelle (
    id             uuid primary key default gen_random_uuid(),
    tenant_id      uuid not null references public.tenants (id) on delete cascade,
    user_id        uuid not null references public.users (id) on delete cascade,
    datum          date not null,
    art            text not null check (art in (
        'unfall', 'fehlverhalten', 'regelverstoss', 'leistung', 'sonstiges'
    )),
    schwere        text not null default 'gering'
        check (schwere in ('gering', 'mittel', 'hoch', 'kritisch')),
    ort            text,
    beschreibung   text not null,
    zeugen         jsonb not null default '[]'::jsonb,
    massnahmen     text,
    praevention    text,
    gemeldet_von   uuid references public.users (id) on delete set null,
    folge_noetig   boolean not null default false,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);
create index if not exists personal_vorfaelle_user_idx on public.personal_vorfaelle (tenant_id, user_id);
alter table public.personal_vorfaelle enable row level security;
drop policy if exists personal_vorfaelle_tenant on public.personal_vorfaelle;
create policy personal_vorfaelle_tenant on public.personal_vorfaelle
    for all using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
revoke all on public.personal_vorfaelle from anon, authenticated;
drop trigger if exists personal_vorfaelle_updated_at on public.personal_vorfaelle;
create trigger personal_vorfaelle_updated_at
    before update on public.personal_vorfaelle
    for each row execute function public.set_updated_at();

-- ============================================================================
-- 5) Gespräche / Feedback
-- ============================================================================
create table if not exists public.personal_gespraeche (
    id            uuid primary key default gen_random_uuid(),
    tenant_id     uuid not null references public.tenants (id) on delete cascade,
    user_id       uuid not null references public.users (id) on delete cascade,
    datum         date not null,
    art           text not null default 'feedback' check (art in (
        'feedback', 'jahresgespraech', 'probezeit', 'zielgespraech', 'sonstiges'
    )),
    bewertung     smallint check (bewertung is null or bewertung between 1 and 5),
    notizen       text,
    ziele         jsonb not null default '[]'::jsonb,
    erfolge       jsonb not null default '[]'::jsonb,
    entwicklung   jsonb not null default '[]'::jsonb,
    gefuehrt_von  uuid references public.users (id) on delete set null,
    naechstes_am  date,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);
create index if not exists personal_gespraeche_user_idx on public.personal_gespraeche (tenant_id, user_id);
alter table public.personal_gespraeche enable row level security;
drop policy if exists personal_gespraeche_tenant on public.personal_gespraeche;
create policy personal_gespraeche_tenant on public.personal_gespraeche
    for all using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
revoke all on public.personal_gespraeche from anon, authenticated;
drop trigger if exists personal_gespraeche_updated_at on public.personal_gespraeche;
create trigger personal_gespraeche_updated_at
    before update on public.personal_gespraeche
    for each row execute function public.set_updated_at();

-- ============================================================================
-- 6) Nachweise (Ausbildung, Zertifikate, Sprachen, Fähigkeiten, Erfahrung)
-- ============================================================================
-- Ergänzt `personal_qualifikationen` (Arbeitsbereich × Objekt × Stufe = was
-- die Person im Dienstplan übernehmen darf) um die Kartei-Sicht: was sie
-- gelernt und nachgewiesen hat. Ein Zertifikat mit `ablauf_am` zählt in die
-- Fälligkeiten wie ein Dokument.
create table if not exists public.personal_nachweise (
    id           uuid primary key default gen_random_uuid(),
    tenant_id    uuid not null references public.tenants (id) on delete cascade,
    user_id      uuid not null references public.users (id) on delete cascade,
    art          text not null check (art in (
        'ausbildung', 'zertifikat', 'sprache', 'faehigkeit', 'erfahrung'
    )),
    titel        text not null,
    -- Institution, Aussteller, Arbeitgeber — je nach Art.
    stelle       text,
    -- Sprache: a1…c2/muttersprache; Fähigkeit: grund/fortgeschritten/experte;
    -- Ausbildung: Note. Freitext, weil die Skalen je Art verschieden sind.
    stufe        text,
    von          date,
    bis          date,
    ablauf_am    date,
    kennung      text,
    notiz        text,
    dokument_id  uuid references public.personal_dokumente (id) on delete set null,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now(),
    constraint personal_nachweise_bis_nach_von
        check (bis is null or von is null or bis >= von)
);
create index if not exists personal_nachweise_user_idx on public.personal_nachweise (tenant_id, user_id);
create index if not exists personal_nachweise_ablauf_idx
    on public.personal_nachweise (tenant_id, ablauf_am) where ablauf_am is not null;
alter table public.personal_nachweise enable row level security;
drop policy if exists personal_nachweise_tenant on public.personal_nachweise;
create policy personal_nachweise_tenant on public.personal_nachweise
    for all using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
revoke all on public.personal_nachweise from anon, authenticated;
drop trigger if exists personal_nachweise_updated_at on public.personal_nachweise;
create trigger personal_nachweise_updated_at
    before update on public.personal_nachweise
    for each row execute function public.set_updated_at();

-- ============================================================================
-- 7) Schulungen / Belehrungen (Compliance)
-- ============================================================================
create table if not exists public.personal_schulungen (
    id                uuid primary key default gen_random_uuid(),
    tenant_id         uuid not null references public.tenants (id) on delete cascade,
    user_id           uuid not null references public.users (id) on delete cascade,
    titel             text not null,
    trainer           text,
    abgeschlossen_am  date not null,
    gueltig_bis       date,
    notiz             text,
    dokument_id       uuid references public.personal_dokumente (id) on delete set null,
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now()
);
create index if not exists personal_schulungen_user_idx on public.personal_schulungen (tenant_id, user_id);
create index if not exists personal_schulungen_ablauf_idx
    on public.personal_schulungen (tenant_id, gueltig_bis) where gueltig_bis is not null;
alter table public.personal_schulungen enable row level security;
drop policy if exists personal_schulungen_tenant on public.personal_schulungen;
create policy personal_schulungen_tenant on public.personal_schulungen
    for all using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
revoke all on public.personal_schulungen from anon, authenticated;
drop trigger if exists personal_schulungen_updated_at on public.personal_schulungen;
create trigger personal_schulungen_updated_at
    before update on public.personal_schulungen
    for each row execute function public.set_updated_at();
