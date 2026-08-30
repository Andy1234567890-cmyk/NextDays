-- 0498 — Der Eskalationshinweis am Thread
--
-- WARUM EINE EIGENE TABELLE statt Spalten an der Thread-Tabelle:
--
-- Ein Thread liegt bei uns in EINER VON ZWEI Tabellen — `channex_booking`
-- (Portale) oder `whatsapp_conversation` (WhatsApp). Der Plan sah Spalten an
-- `channex_booking` vor; das wäre die Hälfte der Wahrheit gewesen: derselbe
-- Gast, der über WhatsApp schreibt, hätte nie eskalieren können, und niemand
-- hätte gemerkt, warum. Die Alternative — dieselben drei Spalten zweimal —
-- ist genau die Doppelung, die in ein paar Monaten auseinanderläuft.
--
-- Deshalb eine Zeile je eskaliertem Thread, mit `quelle` daneben. Das ist
-- dieselbe Form, die `ki_antwort_protokoll` (0493) bereits nutzt, und aus
-- demselben Grund: ein Fremdschlüssel auf eine von zwei Tabellen geht nicht.
--
-- Der zweite Vorteil zeigt sich bei der Ansicht „Eskaliert": ein Index über
-- diese kleine Tabelle beantwortet „welche Threads sind offen eskaliert"
-- ohne Scan über 556 Reservierungen und alle WhatsApp-Gespräche.
--
-- ZURÜCKNEHMBAR, und das ist keine Nebensache. Eine Eskalation, die nur die
-- KI setzen und niemand aufheben kann, ist eine dauerhafte Markierung statt
-- einer Aufgabe — nach zwei Wochen wäre jeder zweite Thread rot und niemand
-- sähe mehr hin. `erledigt_at` + `erledigt_von` machen daraus einen Vorgang
-- mit Ende.

create table if not exists public.ki_eskalation (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants (id) on delete cascade,

    thread_id text not null,
    quelle text not null check (quelle in ('inbox', 'whatsapp')),

    -- Womit die Eskalation ausgelöst wurde:
    --   'stimmung' = das Modell hat negativen Tenor erkannt (11b)
    --   'regel'    = eine Regel mit ist_eskalation hat gegriffen
    ausloeser text not null check (ausloeser in ('stimmung', 'regel')),

    -- Nur bei ausloeser='regel'. on delete set null: wird die Regel gelöscht,
    -- bleibt die Eskalation stehen — sie ist ein Ereignis, das stattgefunden
    -- hat, kein Verweis auf eine Einstellung.
    regel_id uuid references public.ki_regel (id) on delete set null,

    -- Der Satz, der im Thread-Kasten steht: „Gast ist verärgert über
    -- fehlendes warmes Wasser". Vom Modell formuliert bzw. der Regelname.
    grund text not null,

    -- Auszug der auslösenden Nachricht — damit im Protokoll nachvollziehbar
    -- ist, WORAUF die Einschätzung fusste. Ohne ihn bliebe nur „negativ"
    -- ohne Beleg, und eine Fehleinschätzung wäre nicht überprüfbar.
    nachricht_auszug text,

    erledigt_at timestamptz,
    erledigt_von uuid references public.users (id) on delete set null,

    created_at timestamptz not null default now(),

    constraint ki_eskalation_grund_laenge
        check (length(btrim(grund)) between 1 and 500),
    constraint ki_eskalation_auszug_laenge
        check (nachricht_auszug is null or length(nachricht_auszug) <= 2000),
    -- Wer erledigt hat, muss auch WANN haben und umgekehrt: eine halbe
    -- Erledigung ist ein Datenfehler, kein Zwischenzustand.
    constraint ki_eskalation_erledigt_paar
        check ((erledigt_at is null) = (erledigt_von is null))
);

-- Ein Thread ist entweder eskaliert oder nicht — zwei offene Eskalationen
-- desselben Threads wären zwei rote Kästen übereinander. Nach dem Erledigen
-- darf er erneut eskalieren (deshalb partiell auf erledigt_at is null).
create unique index if not exists ki_eskalation_ein_offener_je_thread
    on public.ki_eskalation (tenant_id, quelle, thread_id)
    where erledigt_at is null;

-- Die Ansicht „Eskaliert": alle offenen, neueste zuerst.
create index if not exists ki_eskalation_offen_idx
    on public.ki_eskalation (tenant_id, created_at desc)
    where erledigt_at is null;

-- --------------------------------------------------------------------------
-- RLS + Rechte (Wurzel 6)
-- --------------------------------------------------------------------------
-- `nachricht_auszug` enthält den Wortlaut einer echten Gastbeschwerde, `grund`
-- eine Einschätzung über einen namentlich bekannten Gast. Beides ist genau die
-- Art Datum, die ein eingeloggter cleaner mit dem anon-Key nicht per
-- `curl /rest/v1/ki_eskalation` abgreifen können darf.
alter table public.ki_eskalation enable row level security;

drop policy if exists ki_eskalation_tenant on public.ki_eskalation;
create policy ki_eskalation_tenant on public.ki_eskalation
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

drop policy if exists ki_eskalation_write_restrict on public.ki_eskalation;
create policy ki_eskalation_write_restrict on public.ki_eskalation
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke all on public.ki_eskalation from anon, authenticated;

comment on table public.ki_eskalation is
    'Ein eskalierter Thread. Eigene Tabelle statt Spalten an channex_booking, '
    'weil ein Thread auch eine whatsapp_conversation sein kann. Zurücknehmbar '
    'über erledigt_at — sonst wäre es eine Markierung statt einer Aufgabe.';
