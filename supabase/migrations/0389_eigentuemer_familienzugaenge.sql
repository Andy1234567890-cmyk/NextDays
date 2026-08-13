-- 0389 — Familienzugänge des Eigentümers + zweistufige Sperrantrags-Freigabe.
--
-- WARUM:
-- Ein Ferienhaus gehört einer Familie, nicht einer Person. Bisher hatte genau
-- EIN Mensch den Portalzugang (owner_property_assignments, 0058) — Ehepartner,
-- Kinder und Freunde teilten sich dessen Passwort oder riefen an. Beides ist
-- schlecht: ein geteiltes Passwort hat keinen Urheber (wer hat die Sperrung
-- beantragt?), und der Anruf landet bei der Agentur, die den Wunsch gar nicht
-- beurteilen kann — ob Tante Inge im Juli darf, weiß nur die Familie selbst.
--
-- Diese Migration bringt zwei Dinge:
--   1. Familienmitglieder mit EIGENEM Login, eingeladen vom Eigentümer.
--   2. Deren Sperrwünsche laufen ERST über den Eigentümer, dann zur Agentur.
--
-- KEINE NEUE ROLLE, sondern eine Stufe je Zuordnung. Vorbild ist
-- property_cohosts (0213) mit COHOST_CAPABILITIES: dort hängen abgestufte
-- Rechte an der ZUORDNUNG, nicht an public.users.role. Das ist hier zwingend,
-- nicht nur schöner:
--   * `user_role` ist eine globale Achse. Ein neuer Wert müsste in JEDER
--     Prüfstelle nachgezogen werden — und in `_PM_UMBRELLA_ROLES`
--     (permissions.py) steht `owner` bewusst NICHT drin; eine vergessene neue
--     owner-nahe Rolle verlöre dort VIEW_CALENDAR und das Portal antwortete
--     403, ohne dass jemand die Ursache sähe.
--   * Die Stufe ist pro Objekt verschieden: die Tochter darf am Ferienhaus
--     mitreden, am zweiten Objekt des Vaters nicht. Eine Rolle am User kann
--     das konstruktiv nicht abbilden.
--
-- Das Familienmitglied bleibt damit `role='owner'`; was es DARF, steht hier.

-- == 1. Zugriffsstufen ======================================================
-- Zwei Stufen, weil es genau zwei Fragen gibt, die der Eigentümer beantworten
-- muss: Darf die Person das Haus mitbenutzen? Und darf sie die Finanzen sehen?
--
-- `nutzung` ist die engere Stufe und die Voreinstellung der Oberfläche — nicht
-- weil die Software die Entscheidung trifft, sondern weil ein Häkchen, das man
-- bewusst setzt, der einzige Weg ist, auf dem der Eigentümer wirklich
-- entscheidet. Vorbelegt wäre es eine Entscheidung, die niemand getroffen hat
-- (Art. 25 Abs. 2 DSGVO, dasselbe Muster wie der Freitext-Scope in 0388).
--
-- Umsatz, Abrechnung und Auszahlung sind Geschäftsdaten des Eigentümers, keine
-- Familienangelegenheit: ein Neffe, der eine Woche im Juli möchte, braucht
-- dafür keinen Blick auf den Jahresumsatz.
create type public.owner_family_access as enum ('nutzung', 'nutzung_berichte');

comment on type public.owner_family_access is
    'Was ein Familienzugang darf. nutzung = Kalender sehen + Sperrzeit '
    'beantragen. nutzung_berichte = zusätzlich Umsatz/Abrechnung/Auszahlung. '
    'Die Stufe entscheidet der Eigentümer je Person und je Objekt.';

-- == 2. Familienmitglied ↔ Objekt ===========================================
-- Bewusst NICHT als Spalte an owner_property_assignments (0058): dort steht die
-- reine Sichtbarkeit, und die gilt auch für den Eigentümer selbst. Eine
-- Stufenspalte dort müsste für ihn NULL sein und für Familienmitglieder
-- gefüllt — ein Feld mit zwei Bedeutungen. Getrennte Tabelle heißt: wer hier
-- drinsteht, IST ein Familienmitglied, und die Abwesenheit einer Zeile ist eine
-- klare Aussage (Wurzel 5).
create table public.owner_family_members (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants (id) on delete cascade,
    -- Der Login des Familienmitglieds (public.users, role='owner').
    user_id uuid not null references public.users (id) on delete cascade,
    -- Der Eigentümer-Login, der eingeladen hat und freigibt. Das ist der
    -- Anker der ganzen Konstruktion: über ihn läuft die Freigabe-Stufe, und
    -- über ihn wird geprüft, wer die Zuordnung ändern darf.
    owner_user_id uuid not null references public.users (id) on delete cascade,
    property_id uuid not null references public.properties (id) on delete cascade,
    access public.owner_family_access not null default 'nutzung',
    -- Wer die Einladung ausgelöst hat. Im Normalfall == owner_user_id; die
    -- Agentur darf einem Eigentümer aber aushelfen, und dann soll nachlesbar
    -- sein, dass nicht der Eigentümer selbst geklickt hat.
    invited_by uuid references public.users (id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    -- Eine Person hat je Objekt genau eine Stufe (Wurzel 2: ein zweiter Klick
    -- auf „Einladen" darf keine zweite Zeile mit anderer Stufe erzeugen).
    unique (user_id, property_id),
    -- Sich selbst zum eigenen Familienmitglied zu machen ergäbe einen Zyklus
    -- in der Freigabe: der Antrag wartete auf die Freigabe des Antragstellers.
    constraint owner_family_members_nicht_selbst check (user_id <> owner_user_id)
);

comment on table public.owner_family_members is
    'Familienmitglieder/Freunde mit eigenem Portalzugang, eingeladen vom '
    'Eigentümer. Trägt die Zugriffsstufe je Objekt. Die reine Sichtbarkeit '
    'steht wie bei jedem Eigentümer in owner_property_assignments (0058) — '
    'diese Tabelle sagt zusätzlich, WER eingeladen hat und WAS erlaubt ist.';

comment on column public.owner_family_members.owner_user_id is
    'Der Eigentümer, der einlädt und Sperranträge dieses Mitglieds freigibt. '
    'Ankerpunkt der zweistufigen Freigabe.';

create index owner_family_members_tenant_idx
    on public.owner_family_members (tenant_id);
create index owner_family_members_user_idx
    on public.owner_family_members (user_id);
-- Trägt die Liste „meine Familienzugänge" im Portal.
create index owner_family_members_owner_idx
    on public.owner_family_members (owner_user_id);
create index owner_family_members_property_idx
    on public.owner_family_members (property_id);

create trigger set_updated_at before update on public.owner_family_members
    for each row execute function public.set_updated_at();

-- == 3. Zweistufige Freigabe der Sperranträge ===============================
-- Der Antrag eines Familienmitglieds braucht eine Stufe VOR der Agentur: der
-- Eigentümer muss zustimmen, bevor die Agentur den Vorgang überhaupt sieht.
--
-- KEIN neuer Wert im Enum block_request_status, sondern eine eigene Spalte.
-- Zwei Gründe, beide zwingend:
--
--   1. TECHNISCH: apply-migrations.sh fährt jede Migration in EINER
--      Transaktion (`begin; … commit;`). Postgres verbietet, einen per
--      `alter type … add value` erzeugten Enum-Wert in derselben Transaktion
--      zu verwenden („unsafe use of new value of enum type") — jeder Index
--      oder CHECK darauf ließe die Migration hart fehlschlagen.
--
--   2. FACHLICH, und das ist der wichtigere: `status = 'approved'` ist ein
--      scharf geladener Wert. Der EXCLUDE-Constraint
--      block_requests_kein_ueberlapp (0377) hängt daran, und `genehmigen`
--      (calendar/sperrantraege.py) legt bei diesem Übergang eine RESERVIERUNG
--      an — mit Advisory-Lock, Kalenderbelegung, ARI-Outbox und Channex-Push
--      an die Portale. Je weniger Zustände in diesen Enum wandern, desto
--      kleiner die Chance, dass eine Verzweigung irgendwo den neuen Wert
--      vergisst und ein Haus verkauft, das gesperrt sein sollte.
--
-- `status` bleibt deshalb unverändert die Sicht der AGENTUR (pending →
-- approved/rejected). `owner_freigabe` ist die davor liegende Stufe der
-- FAMILIE. Ein Antrag ist für die Agentur erst sichtbar, wenn beides stimmt:
-- status='pending' UND owner_freigabe in ('nicht_noetig','freigegeben').
create type public.owner_freigabe_status as enum (
    'nicht_noetig',   -- Antrag des Eigentümers selbst — keine Stufe 1 nötig
    'offen',          -- wartet auf den Eigentümer; für die Agentur unsichtbar
    'freigegeben',    -- Eigentümer ist einverstanden, geht an die Agentur
    'abgelehnt'       -- Eigentümer lehnt ab; erreicht die Agentur nie
);

comment on type public.owner_freigabe_status is
    'Stufe 1 der Sperrantrags-Freigabe (Eigentümer). Stufe 2 ist '
    'block_requests.status (Agentur). Getrennt, weil nur status '
    'Kalender-/Portal-Wirkung auslöst.';

-- Der Zustandsautomat ab hier:
--
--   Eigentümer stellt Antrag
--     owner_freigabe='nicht_noetig' ─┐
--                                    ├─→ status: pending → approved → rejected
--   Mitglied stellt Antrag           │        (Agentur, MIT Kalenderwirkung)
--     'offen' → 'freigegeben' ───────┘
--         └──→ 'abgelehnt'  (Ende — die Agentur sieht den Antrag nie)
--
-- Stufe 1 hat KEINE Kalenderwirkung. Bis der Eigentümer freigibt und die
-- Agentur genehmigt, bleibt das Objekt normal verkäuflich.

alter table public.block_requests
    add column if not exists owner_freigabe public.owner_freigabe_status
        not null default 'nicht_noetig',
    add column if not exists owner_decided_by uuid
        references public.users (id) on delete set null,
    add column if not exists owner_decided_at timestamptz,
    add column if not exists owner_decision_note text;

comment on column public.block_requests.owner_freigabe is
    'Stufe 1: Freigabe durch den Eigentümer. Default nicht_noetig — der '
    'Altbestand und jeder Antrag des Eigentümers selbst gehen direkt an die '
    'Agentur. Nur Anträge von Familienmitgliedern starten auf offen.';

comment on column public.block_requests.owner_decided_by is
    'Der Eigentümer, der den Antrag eines Familienmitglieds in Stufe 1 '
    'freigegeben oder abgelehnt hat. NULL bei Anträgen des Eigentümers selbst '
    '(die starten direkt in Stufe 2).';

comment on column public.block_requests.owner_decided_at is
    'Zeitpunkt der Eigentümer-Entscheidung. UNSERE Uhr ist hier korrekt: die '
    'Entscheidung fällt in diesem System (Wurzel 5b greift nicht).';

comment on column public.block_requests.owner_decision_note is
    'Begründung des Eigentümers, sichtbar für das Familienmitglied.';

-- Ein Datum darf nur dastehen, wenn auch jemand entschieden hat — sonst
-- behauptete die Zeile eine Entscheidung ohne Entscheider (fail-closed,
-- Wurzel 5; dasselbe Muster wie block_requests_kuendigung_datum in 0377).
alter table public.block_requests
    drop constraint if exists block_requests_owner_entscheidung;
alter table public.block_requests
    add constraint block_requests_owner_entscheidung check (
        (owner_decided_at is null) = (owner_decided_by is null)
    );

-- Eine entschiedene Stufe 1 braucht einen Entscheider, eine unentschiedene
-- darf keinen haben. Ohne diesen Riegel könnte eine Zeile „freigegeben"
-- behaupten, ohne dass jemand freigegeben hat (Wurzel 5).
alter table public.block_requests
    drop constraint if exists block_requests_owner_freigabe_spur;
alter table public.block_requests
    add constraint block_requests_owner_freigabe_spur check (
        (owner_freigabe in ('freigegeben', 'abgelehnt')) = (owner_decided_at is not null)
    );

-- Die Warteschlange des Eigentümers: „was wartet auf MEINE Freigabe".
-- Partiell, weil nur offene Anträge gesucht werden — der Index bleibt klein,
-- auch wenn die Historie wächst (Vorbild: 0332).
create index if not exists block_requests_owner_offen_idx
    on public.block_requests (property_id, created_at)
    where owner_freigabe = 'offen';

-- == 4. RLS + Grants (Wurzel 6) =============================================
-- Die Tabelle sagt, WER zu einer Familie gehört und was er darf. Das ist
-- Personen- und Rechtebezug in einem — beides gehört nicht in die Hand eines
-- Clients mit anon-Key.
alter table public.owner_family_members enable row level security;

-- Kein Direktpfad: gelesen und geschrieben wird ausschließlich über die API
-- mit service_role, die den Scope selbst erzwingt (wie block_requests seit
-- 0332). Ein Realtime-Abo auf diese Tabelle wäre damit eine stumme Attrappe —
-- die Oberfläche schreibt die Server-Antwort direkt in ihren Zustand.
revoke select, insert, update, delete
    on public.owner_family_members from anon, authenticated;

-- Tenant-Grenze als permissive Policy (Muster wie owners, 0063).
create policy owner_family_members_tenant on public.owner_family_members
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- Restriktiv obendrauf: gilt zusätzlich zu jeder anderen Policy und schließt
-- den Schreibpfad tenant-weit ein (Wurzel 6 — `for all`, nicht nur `select`;
-- eine reine SELECT-Restriktion ließe INSERT/UPDATE offen).
create policy owner_family_members_restrict on public.owner_family_members
    as restrictive
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- == 5. Neuer Zweck für den Einladungs-Token =================================
-- user_auth_tokens (0334) trägt eine `zweck`-Spalte mit CHECK. Die Migration
-- dort hält fest, ein neuer Zweck solle eine bewusste Migration sein — genau
-- das ist hier der Fall.
--
-- Warum ein eigener Zweck statt 'invite': Die Familien-Einladung wird vom
-- EIGENTÜMER ausgelöst, nicht von der Agentur. Beim Nachlesen („wer hat diesen
-- Zugang veranlasst?") ist das der Unterschied zwischen einer Handlung des
-- Betriebs und einer Handlung des Kunden. Mit demselben Zweck wären beide
-- ununterscheidbar.
--
-- Der Token-Lebenszyklus (Ausgabe, Ablauf, Einmaligkeit per Compare-and-Set,
-- Entwertung) bleibt unverändert derselbe Code — kein zweiter Einladungsweg,
-- der beim nächsten Sicherheitsfix vergessen wird.
alter table public.user_auth_tokens
    drop constraint if exists user_auth_tokens_zweck_check;
alter table public.user_auth_tokens
    add constraint user_auth_tokens_zweck_check
    check (zweck in ('invite', 'reset', 'owner_family'));

comment on column public.user_auth_tokens.zweck is
    'invite = Einladung durch die Agentur, reset = Passwort vergessen, '
    'owner_family = Einladung eines Familienmitglieds durch den Eigentümer '
    '(0389). Der Zweck trennt die Herkunft, nicht den Ablauf.';
