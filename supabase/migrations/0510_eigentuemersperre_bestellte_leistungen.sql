-- Bestellte Leistungen zu einer Eigentümersperrung.
--
-- WAS BISHER PASSIERTE: Eine genehmigte Sperre wird als Reservierung mit
-- `is_owner_stay=true` gebucht (0241/0353, `sperrantraege._eigennutzung_anlegen`)
-- — bewusst über den normalen Reservierungs-Schreibpfad, damit Advisory-Lock,
-- Einheitenwahl, Kalenderbelegung und ARI-Outbox EINEN Weg haben. An genau
-- diesem Weg hängt aber auch die Aufgaben-Automatik
-- (`reservations._base._sync_task_rules` → `tasks.engine.sync_for_reservation`),
-- und die kennt `is_owner_stay` nicht: der String kommt im gesamten
-- Aufgaben-Slice kein einziges Mal vor. Eine Eigentümersperrung erzeugte
-- deshalb dieselbe Regelkette wie eine Gastbuchung — Anreise-Vorbereitung,
-- Endreinigung, Wäsche.
--
-- Warum das falsch ist: Der Eigentümer fährt in sein eigenes Haus. Es gibt
-- keinen Gast, der empfangen wird, und die Reinigung nach seiner Abreise ist
-- eine LEISTUNG, die jemand bestellt und die jemand bezahlt — keine Folge des
-- Kalenders. Die Aufgabe entstand trotzdem, landete beim Reinigungspersonal
-- und wurde ausgeführt. Fachlich ist das Arbeit ohne Auftrag; für den Betrieb
-- eine Position, die er dem Eigentümer nicht in Rechnung stellen kann, weil
-- niemand sie bestellt hat.
--
-- Die Umkehrung — gar keine Aufgaben mehr bei Eigennutzung — wäre genauso
-- falsch: der Normalfall IST, dass der Eigentümer nach seinem Aufenthalt eine
-- Reinigung möchte. Nur eben, weil er sie bestellt hat.
--
-- DIE ENTSCHEIDUNG: Der Eigentümer kreuzt seine Leistungen beim BEANTRAGEN an.
-- Die Auswahl steht am Antrag, die Agentur sieht sie beim Genehmigen, und aus
-- der genehmigten Sperre entstehen ausschließlich die angekreuzten Aufgaben.
-- Nicht angekreuzt = keine Aufgabe. Der Freitext `reason` bleibt Freitext: aus
-- ihm wird NICHTS abgeleitet (eine Wortsuche in 24 Sprachen als Grundlage
-- einer Arbeitsanweisung wäre ein erfundener Wert, Wurzel 4) — dieselbe Linie
-- wie bei `ist_kuendigung` (0377).
--
-- WARUM EINE TABELLE UND KEIN jsonb-ARRAY an block_requests: Die Bestellung
-- zeigt auf `task_rules` und muss mit ihr mitgehen. Wird eine Regel gelöscht,
-- muss die Bestellung verschwinden (`on delete cascade`) — ein Array aus IDs
-- zeigte danach ins Leere, und der Genehmigungslauf legte eine Aufgabe zu
-- einer Regel an, die es nicht mehr gibt. Dieselbe Bauform wie
-- `task_rule_assignments` (0012): Zuordnungstabelle mit UNIQUE, kein Array.

create table if not exists public.block_request_services (
    id               uuid primary key default gen_random_uuid(),
    block_request_id uuid not null
        references public.block_requests (id) on delete cascade,
    rule_id          uuid not null
        references public.task_rules (id) on delete cascade,
    created_at       timestamptz not null default now(),
    -- Zweimal dieselbe Leistung am selben Antrag ist keine doppelte
    -- Bestellung, sondern ein Doppelklick (Wurzel 2). Der UNIQUE macht das
    -- Einfügen idempotent statt zwei Aufgaben zu erzeugen.
    unique (block_request_id, rule_id)
);

comment on table public.block_request_services is
    'Leistungen, die der Eigentümer zu seiner Sperrung BESTELLT hat. Ohne '
    'Zeile entsteht zu dieser Sperrung keine Aufgabe aus der Regel — eine '
    'Eigennutzung ist kein Gastaufenthalt, ihre Reinigung ist ein Auftrag.';

comment on column public.block_request_services.rule_id is
    'Die planmäßige Regel (task_rules.kind=auto), aus der die Aufgabe '
    'entstehen soll. Zeigt auf die BESTEHENDE Regelliste des Betriebs — es '
    'gibt bewusst keinen zweiten Leistungskatalog daneben, der auseinander '
    'laufen könnte.';

create index if not exists block_request_services_request_idx
    on public.block_request_services (block_request_id);

-- Für den Gegenzustand beim Löschen einer Regel und für die Frage „welche
-- Anträge bestellen diese Leistung".
create index if not exists block_request_services_rule_idx
    on public.block_request_services (rule_id);

-- === RLS (Wurzel 6) ===
-- Dieselbe Lage wie die Muttertabelle: `block_requests` trägt für anon und
-- authenticated WEDER select NOCH insert/update/delete (nachgemessen an der
-- Live-DB: nur REFERENCES/TRIGGER/TRUNCATE). Gelesen und geschrieben wird
-- ausschließlich über die API mit service_role, die den Scope selbst erzwingt.
-- Eine Bestellung sagt aus, wer wann welche bezahlte Leistung geordert hat —
-- das geht eine Reinigungskraft desselben Mandanten nichts an (§4.3), und
-- schreibbar darf sie erst recht nicht sein: wer sich selbst eine Bestellung
-- einträgt, erzeugt einen Arbeitsauftrag, den niemand erteilt hat.
alter table public.block_request_services enable row level security;

revoke all on public.block_request_services from anon, authenticated;

-- Mandantengrenze über die Muttertabelle: die Zeile selbst trägt keine
-- tenant_id (sie hinge sonst als zweite Wahrheit neben der des Antrags und
-- könnte von ihr abweichen). service_role umgeht RLS ohnehin — die Policy ist
-- der Backstop für den Fall, dass jemand später ein Grant vergibt.
drop policy if exists block_request_services_tenant on public.block_request_services;
create policy block_request_services_tenant on public.block_request_services
    for all
    using (
        exists (
            select 1
            from public.block_requests br
            where br.id = block_request_services.block_request_id
              and br.tenant_id = public.current_tenant_id()
        )
    )
    with check (
        exists (
            select 1
            from public.block_requests br
            where br.id = block_request_services.block_request_id
              and br.tenant_id = public.current_tenant_id()
        )
    );

-- === Spur an der entstandenen Aufgabe ===
-- Ohne sie ließe sich später nicht mehr sagen, WARUM eine Aufgabe zu einer
-- Eigennutzung existiert: „hat der Eigentümer sie bestellt, oder ist sie doch
-- wieder automatisch entstanden?". Genau diese Frage ist der Anlass dieser
-- Migration, und sie muss an der Aufgabe selbst beantwortbar sein — nicht per
-- Rückschluss über drei Tabellen, der nach dem Widerruf der Sperre nicht mehr
-- funktioniert.
alter table public.tasks
    add column if not exists ordered_by_owner boolean not null default false;

comment on column public.tasks.ordered_by_owner is
    'Diese Aufgabe entstand aus einer BESTELLUNG des Eigentümers zu seiner '
    'Sperrung (block_request_services), nicht aus dem gewöhnlichen Lauf der '
    'planmäßigen Regeln. Relevant für die Abrechnung: bestellte Leistung.';
