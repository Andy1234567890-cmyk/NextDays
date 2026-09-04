-- 0546 — Personal: KI-Bedarfsprognose, Autoplanung, Assistent
--
-- Drei Werkzeuge, ehrlich getrennt (Freigabe 04.09.2026):
--   * Bedarfsprognose  Buchungslage (Anreisen, Abreisen, Gäste, Belegung),
--                      Feiertage/Ferien und die eigene Historie → Bedarf je
--                      Bereich und Tag. Die Zahl rechnet der Server aus den
--                      Produktivitätsannahmen; Gemini (Vertex AI, regional)
--                      erklärt Ausreißer und erkennt Muster/Events. Jede
--                      Ausgabe trägt content_origin (EU AI Act Art. 50).
--   * Autoplanung      verteilt die Schichthüllen auf Personen nach einem der
--                      sieben Planungstypen (Gastromatic) als Gewichtung. Die
--                      Zuteilung rechnet ein Solver (OR-Tools CP-SAT), NICHT
--                      das Sprachmodell — ein Sprachmodell hält Ruhezeiten und
--                      Doppelbelegungen nicht verlässlich ein. Ergebnis sind
--                      Varianten als ENTWURF; veröffentlicht wird von Hand.
--   * Assistent        Fragen zum Plan („wer kann Samstag Housekeeping?") —
--                      Antwort aus den Plandaten, mit Gemini formuliert.
--
-- Alle KI-Aufrufe laufen über den Tagesdeckel je Betrieb (site_ai_usage, 0465).

-- ============================================================================
-- 1) Prognosen (§)
-- ============================================================================
create table if not exists public.personal_prognosen (
    id             uuid primary key default gen_random_uuid(),
    tenant_id      uuid not null references public.tenants (id) on delete cascade,
    woche_start    date not null,
    status         text not null default 'fertig' check (status in ('fertig', 'fehler')),
    -- Was hineinging: je Tag anreisen/abreisen/gaeste/einheiten_belegt/
    -- einheiten_gesamt/feiertag/ferien, Historie der letzten Wochen, Annahmen.
    eingaben       jsonb not null default '{}'::jsonb,
    -- Was herauskam: je Tag je Arbeitsbereich stunden + anzahl, Stundenlimit,
    -- Hinweise. Wird als personal_bedarf (quelle 'prognose') übernommen.
    ausgabe        jsonb not null default '{}'::jsonb,
    -- Erklärung des Sprachmodells (Ausreißer, Muster) — als erzeugt gekennzeichnet.
    erklaerung     text,
    content_origin text not null default 'ki' check (content_origin in ('ki', 'ki_bearbeitet')),
    modell         text,
    region         text,
    tokens_ein     integer,
    tokens_aus     integer,
    dauer_ms       integer,
    fehler         text,
    uebernommen_am timestamptz,
    erstellt_von   uuid references public.users (id) on delete set null,
    created_at     timestamptz not null default now()
);
create index if not exists personal_prognosen_woche_idx on public.personal_prognosen (tenant_id, woche_start);
alter table public.personal_prognosen enable row level security;
drop policy if exists personal_prognosen_tenant on public.personal_prognosen;
create policy personal_prognosen_tenant on public.personal_prognosen
    for all using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
revoke all on public.personal_prognosen from anon, authenticated;

alter table public.personal_bedarf drop constraint if exists personal_bedarf_prognose_fk;
alter table public.personal_bedarf add constraint personal_bedarf_prognose_fk
    foreign key (prognose_id) references public.personal_prognosen (id) on delete set null;
alter table public.personal_umsatzbuch drop constraint if exists personal_umsatzbuch_prognose_fk;
alter table public.personal_umsatzbuch add constraint personal_umsatzbuch_prognose_fk
    foreign key (prognose_id) references public.personal_prognosen (id) on delete set null;

-- ============================================================================
-- 2) Planungsläufe (Autoplanung, §)
-- ============================================================================
create table if not exists public.personal_planungslaeufe (
    id                 uuid primary key default gen_random_uuid(),
    tenant_id          uuid not null references public.tenants (id) on delete cascade,
    woche_start        date not null,
    -- Die sieben Planungstypen (Gastromatic) als Gewichtung Fairness/Skills/Zeit.
    planungstyp        text not null check (planungstyp in (
        'performer', 'alleskoenner', 'superfaire', 'zeitschwaermer',
        'talentscout', 'faire', 'philanthrop'
    )),
    status             text not null default 'laeuft'
        check (status in ('laeuft', 'fertig', 'fehler', 'uebernommen')),
    solver             text,
    -- [{"name": "A", "schichten": [{bedarf_id, user_id, start_at, end_at,
    --   pause_min, arbeitsbereich_id, property_id}], "kennzahlen": {...},
    --   "konflikte": n, "unbesetzt": n}]
    varianten          jsonb not null default '[]'::jsonb,
    gewaehlte_variante smallint,
    -- Erklärung des Sprachmodells zur Variantenwahl — als erzeugt gekennzeichnet.
    erklaerung         text,
    content_origin     text not null default 'ki',
    dauer_ms           integer,
    fehler             text,
    uebernommen_am     timestamptz,
    erstellt_von       uuid references public.users (id) on delete set null,
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now(),
    constraint personal_planungslaeufe_varianten_liste check (jsonb_typeof(varianten) = 'array')
);
create index if not exists personal_planungslaeufe_woche_idx
    on public.personal_planungslaeufe (tenant_id, woche_start);
alter table public.personal_planungslaeufe enable row level security;
drop policy if exists personal_planungslaeufe_tenant on public.personal_planungslaeufe;
create policy personal_planungslaeufe_tenant on public.personal_planungslaeufe
    for all using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
revoke all on public.personal_planungslaeufe from anon, authenticated;
drop trigger if exists personal_planungslaeufe_updated_at on public.personal_planungslaeufe;
create trigger personal_planungslaeufe_updated_at
    before update on public.personal_planungslaeufe
    for each row execute function public.set_updated_at();

-- Herkunft einer Schicht aus einem Planungslauf (Rückweg: Lauf verwerfen =
-- seine Entwurfs-Schichten löschen, nur die).
alter table public.personal_schichten
    add column if not exists planungslauf_id uuid references public.personal_planungslaeufe (id) on delete set null;
create index if not exists personal_schichten_planungslauf_idx
    on public.personal_schichten (planungslauf_id) where planungslauf_id is not null;

-- ============================================================================
-- 3) Zähler: drei neue KI-Funktionen im Tagesdeckel
-- ============================================================================
-- ZWEI STELLEN, IMMER GEMEINSAM: dieser Constraint UND `FUNKTIONEN` in
-- `apps/api/src/features/site_config/ki_nutzung.py`.
alter table public.site_ai_usage
  drop constraint if exists site_ai_usage_funktion_check;
alter table public.site_ai_usage
  add constraint site_ai_usage_funktion_check check (
    funktion in (
      'umschreiben',
      'seo',
      'alt_text',
      'abschnitt',
      'blogbeitrag',
      'profil_vorschlag',
      'seite_uebersetzen',
      'gast_antwort',
      'wissen_import',
      'wissen_lernen',
      'bewertung_deuten',
      'bewertung_bilanz',
      'addon_uebersetzen',
      -- Personal (0546): Erklärung der Bedarfsprognose, Variantenerklärung
      -- der Autoplanung, Assistent im Dienstplan. Getrennt, damit der Deckel
      -- sagt, welcher Aufruf ihn sprengt.
      'personal_prognose',
      'personal_autoplan',
      'personal_assistent'
    )
  );

comment on table public.personal_prognosen is
  'KI-Bedarfsprognose je Woche (0546): Eingaben aus der Buchungslage, Ausgabe je '
  'Tag/Bereich, Erklärung aus Gemini mit content_origin. Übernahme schreibt personal_bedarf.';
comment on table public.personal_planungslaeufe is
  'Autoplanung (0546): Varianten aus dem Solver (OR-Tools) je Planungstyp; Übernahme '
  'legt Entwurfs-Schichten mit planungslauf_id an, Verwerfen löscht genau diese.';
