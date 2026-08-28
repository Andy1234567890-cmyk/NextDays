-- 0440 — Personalisierungs-Regeln: Auslöser × Aktion
--
-- Grundlage: docs/HOSTAWAY-BWP-LUECKEN.md, Abschnitt 1. Hostaway (und darunter
-- Duda) trennt WANN etwas passiert von WAS passiert. Bei uns hing der Auslöser
-- bisher am Pop-up selbst (0437). Das reicht für genau einen Fall und bricht bei
-- allen anderen:
--
--   · Dasselbe Pop-up soll Erstbesuchern nach 3 Sekunden und Wiederkehrern erst
--     beim Verlassen erscheinen — mit Auslösern AM Pop-up bräuchte es zwei
--     Kopien desselben Inhalts, die auseinanderlaufen.
--   · Eine Hinweisleiste ist gar kein Pop-up. Sie hat keinen Inhalt aus
--     Abschnitten, sondern EINEN Satz und einen Knopf.
--   · Ein Sommerangebot soll vom 1. Juni bis 31. August laufen und dann von
--     selbst aufhören. Ein Datum am Pop-up wäre eine zweite Bedeutung für ein
--     Feld, das schon „wie oft" heißt.
--
-- WAS ANDERS IST ALS BEI DUDA, und zwar mit Absicht:
--
--   Duda schreibt in seine eigene Doku: „Personalization is not supported on
--   multi-language sites or dynamic pages." Bei uns ist JEDE Seite mehrsprachig
--   (0087) und jede Objektseite dynamisch. Eine Regel, die dort aussetzt, wäre
--   hier wertlos — deshalb kennt die Auswertung keine Sprach- und keine
--   Seitentyp-Ausnahme. Der Preis dafür steht unten bei `seiten`.
--
-- DIE AUSLÖSER STEHEN ALS jsonb, DIE AKTION AUCH. Warum nicht je eine Spalte:
-- Auslöser sind eine offene Menge (Duda hat fünf, wir fangen mit fünf an, der
-- sechste kommt), und jeder trägt eine ANDERE Form — `device` ist ein Wort,
-- `timing` ist ein halber Kalender. Als Spalten wären das zwölf Felder, von
-- denen bei jeder Zeile zehn leer sind. Die Form erzwingt das Pydantic-Schema
-- beim Schreiben; die Datenbank hält nur fest, dass es ein Objekt ist.

create table if not exists public.site_rules (
    id          uuid primary key default gen_random_uuid(),
    tenant_id   uuid not null
                references public.tenants (id) on delete cascade,

    -- Der Name, den der Betrieb vergibt („Sommeraktion", „Willkommen").
    -- Er steht in der Liste und nirgends beim Gast.
    name        text not null,

    -- === WANN ===============================================================
    -- {"device": "mobile"} | {"visits": {"mode": "first"}} | {"timing": {...}}
    -- Ein LEERES Objekt heißt „immer" — das ist Dudas „No trigger" und der
    -- häufigste Fall (ein Willkommens-Pop-up ohne Bedingung).
    triggers    jsonb not null default '{}'::jsonb,

    -- === WAS ================================================================
    --   popup   — ein Pop-up (page_type='popup') einblenden
    --   top_bar — eine klebende Hinweisleiste
    --   effect  — ein Partikel-Effekt über der ganzen Seite
    --   script  — eigenes JavaScript
    action_type text not null,

    -- Die Einstellungen der gewählten Aktion. Form je Art, siehe Schema.
    action      jsonb not null default '{}'::jsonb,

    -- Auf welchen Seiten die Aktion greift. LEER = überall.
    --
    -- Als Slug-Liste und nicht als Fremdschlüssel-Tabelle: die Auswahl ist eine
    -- kurze, ungeordnete Menge ohne eigene Eigenschaften, und der Renderer
    -- kennt beim Auswerten den Slug, nicht die ID. Wird eine Seite gelöscht,
    -- bleibt ihr Slug hier stehen und trifft auf nichts — das ist harmlos und
    -- ehrlicher, als die Regel stillschweigend zu erweitern.
    seiten      text[] not null default '{}',

    -- === Häufigkeit =========================================================
    -- true  = einmal je Besucher, dauerhaft gemerkt (localStorage)
    -- false = einmal je Sitzung (sessionStorage)
    -- Dazu `wieder_nach_tagen`: nach so vielen Tagen darf es WIEDER kommen.
    -- Das ist der Punkt, an dem Squarespace weiter ist als Duda, und für
    -- Ferienwohnungen der wichtigere: ein Gast recherchiert über Wochen. Bei
    -- „einmal je Besucher" sieht er das Angebot genau einmal und nie wieder,
    -- obwohl er noch nicht gebucht hat.
    einmal_je_besucher boolean not null default true,
    wieder_nach_tagen  smallint,

    -- === Zustand ============================================================
    --   draft    — angelegt, wirkt nicht
    --   active   — wirkt
    --   disabled — hat gewirkt, ist abgeschaltet
    -- Drei statt eines Schalters, weil „noch nie scharf" und „bewusst
    -- ausgeschaltet" verschiedene Dinge sind: das erste ist unfertig, das
    -- zweite ist eine Entscheidung.
    status      text not null default 'draft',

    -- Reihenfolge = Vorrang. Bei zwei Regeln derselben Aktionsart auf derselben
    -- Seite gewinnt die kleinere Zahl (oben in der Liste). Verschiedene
    -- Aktionsarten schließen einander nicht aus.
    sort_order  integer not null default 0,

    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now(),

    constraint site_rules_action_type_check check (action_type in (
        'popup', 'top_bar', 'effect', 'script'
    )),
    constraint site_rules_status_check check (status in (
        'draft', 'active', 'disabled'
    )),
    constraint site_rules_name_laenge check (
        char_length(name) between 1 and 120
    ),
    -- Deckel gegen den unbegrenzten Bereich (Wurzel 8): die Auswertung läuft im
    -- Browser JEDES Gastes, und die Seitenliste wandert in jede Antwort.
    constraint site_rules_seiten_deckel check (
        array_length(seiten, 1) is null or array_length(seiten, 1) <= 50
    ),
    constraint site_rules_wieder_bereich check (
        wieder_nach_tagen is null or wieder_nach_tagen between 1 and 365
    ),
    -- jsonb ohne Größengrenze ist eine offene Tür: `script` trägt Code, den ein
    -- Betrieb selbst eintippt, und `action` wird an jeden Gast ausgeliefert.
    constraint site_rules_action_groesse check (
        pg_column_size(action) < 32 * 1024
    ),
    constraint site_rules_triggers_groesse check (
        pg_column_size(triggers) < 8 * 1024
    )
);

-- Der Lesepfad des Renderers: „die aktiven Regeln dieses Betriebs, in ihrer
-- Reihenfolge". Er läuft bei JEDEM Seitenaufbau.
create index if not exists site_rules_aktiv_idx
    on public.site_rules (tenant_id, sort_order)
    where status = 'active';

comment on table public.site_rules is
    'Personalisierungs-Regeln einer Kunden-Website: Auslöser × Aktion. '
    'Ersetzt die Auslöser am Pop-up (0437) durch eine eigene Ebene, damit '
    'dasselbe Pop-up unter mehreren Bedingungen laufen kann und eine Aktion '
    'auch etwas anderes als ein Pop-up sein darf.';
comment on column public.site_rules.triggers is
    'Bedingungen als Objekt. Leer = immer. Form je Auslöser erzwingt das '
    'Pydantic-Schema; die Datenbank hält nur die Größe im Zaum.';
comment on column public.site_rules.seiten is
    'Slugs der Seiten, auf denen die Aktion greift. Leer = überall. Slugs und '
    'keine IDs, weil der Renderer beim Auswerten den Slug kennt.';
comment on column public.site_rules.wieder_nach_tagen is
    'Nach so vielen Tagen darf die Aktion erneut erscheinen. Für Unterkünfte '
    'wichtiger als bei Duda: ein Gast entscheidet über Wochen, nicht in einer '
    'Sitzung.';

alter table public.site_rules enable row level security;

drop policy if exists site_rules_tenant on public.site_rules;
create policy site_rules_tenant on public.site_rules
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- Wurzel 6: Lesen darf bleiben (der Renderer holt die Regeln über die API, aber
-- das Dashboard abonniert die Tabelle per Realtime und braucht dafür `select`).
-- Schreiben NICHT: eine Regel trägt `script` — ausführbaren Code, der bei jedem
-- Gast läuft. Wer den über den Direktpfad setzen könnte, hätte die Website des
-- Betriebs übernommen.
revoke insert, update, delete on public.site_rules from anon, authenticated;

drop policy if exists site_rules_no_insert on public.site_rules;
create policy site_rules_no_insert on public.site_rules
    as restrictive for insert to anon, authenticated with check (false);
drop policy if exists site_rules_no_update on public.site_rules;
create policy site_rules_no_update on public.site_rules
    as restrictive for update to anon, authenticated using (false) with check (false);
drop policy if exists site_rules_no_delete on public.site_rules;
create policy site_rules_no_delete on public.site_rules
    as restrictive for delete to anon, authenticated using (false);

comment on policy site_rules_no_insert on public.site_rules is
    'Regeln tragen ausführbaren Code (action_type=script). Geschrieben wird '
    'ausschließlich über die API mit MANAGE_SITE_CONFIG — nie über PostgREST.';

-- Realtime: die Regel-Liste im Dashboard soll mitlaufen, wenn ein Kollege in
-- einer zweiten Sitzung etwas ändert.
do $$
begin
    if not exists (
        select 1 from pg_publication_tables
         where pubname = 'supabase_realtime'
           and schemaname = 'public'
           and tablename = 'site_rules'
    ) then
        alter publication supabase_realtime add table public.site_rules;
    end if;
end $$;

-- == Pop-up: Position und Vorlage ==========================================
-- Die Position ist Dudas 3×3-Punktraster. Neun Werte, keine Koordinaten: ein
-- Pop-up, das der Kunde pixelgenau schiebt, sitzt auf dem Telefon falsch.
alter table public.site_pages
    add column if not exists popup_position text,
    -- Welche Vorlage das Pop-up beim Anlegen gefüllt hat. Reine Herkunft,
    -- nachträglich ohne Wirkung — aber sie erklärt später, warum ein Pop-up so
    -- aussieht, wie es aussieht.
    add column if not exists popup_template text;

alter table public.site_pages
    drop constraint if exists site_pages_popup_position_check;
alter table public.site_pages
    add constraint site_pages_popup_position_check check (
        popup_position is null or popup_position in (
            'oben-links',   'oben-mitte',   'oben-rechts',
            'mitte-links',  'mitte',        'mitte-rechts',
            'unten-links',  'unten-mitte',  'unten-rechts'
        )
    );

comment on column public.site_pages.popup_position is
    'Position im 3×3-Raster (Dudas Popup position). Neun feste Werte statt '
    'Koordinaten: pixelgenau geschoben sitzt ein Pop-up mobil falsch.';
comment on column public.site_pages.popup_template is
    'Vorlage, die das Pop-up beim Anlegen gefüllt hat. Nur Herkunft.';
