-- 0494 — KI-Autoantwort: die Warteschlange
--
-- WARUM eine eigene Tabelle und nicht `automation_scheduled_message`: dort ist
-- `automation_id` NOT NULL und zeigt auf eine Zeile in `inbox_automation`. Eine
-- KI-Antwort hat keine Automation — sie entsteht aus einer Gastfrage, einer
-- Regel und dem Kontext. Die Spalte nullable zu machen hiesse, den
-- Dedup-Index (automation_id, thread_id) zu verlieren, an dem die
-- Abwesenheitsantwort haengt; ihn zu behalten und eine Schein-Automation
-- anzulegen hiesse, eine Zeile zu erfinden, die niemand gepflegt hat
-- (Wurzel 4).
--
-- WARUM ueberhaupt eine Warteschlange und nicht der direkte Versand im
-- Webhook: die Verzoegerung ist der Kern der Funktion. Zwischen der Gastfrage
-- und der automatischen Antwort liegen standardmaessig fuenf Minuten, damit
-- ein Mitarbeiter zuvorkommen kann. Wer in dieser Zeit selbst antwortet, soll
-- den Gast nicht kurz darauf ein zweites Mal von der KI hoeren.
--
-- DER GEGENZUSTAND (Wurzel 1): Genau dafuer gibt es `status='abgebrochen'` und
-- `abbruch_grund`. Eine wartende Zeile MUSS abgeraeumt werden, wenn
--   * ein Mensch im Thread antwortet,
--   * eine neue Gastnachricht eintrifft (die Antwort passt dann nicht mehr zur
--     Frage — der Gast hat nachgeschoben),
--   * die Autoantwort abgeschaltet oder die Regel deaktiviert wird.
-- Ohne dieses Abraeumen sendet die Warteschlange eine Antwort auf eine Frage,
-- die laengst beantwortet oder ueberholt ist.
--
-- IDEMPOTENZ (Wurzel 2): Der Tick kann doppelt laufen (Retry, zwei Worker).
-- Deshalb ein UNIQUE-Index auf die WARTENDEN Zeilen je Thread: pro Thread
-- kann hoechstens EINE Antwort in der Warteschlange stehen. Ein zweiter
-- Planungsversuch laeuft in einen 23505 und wird als „schon geplant"
-- behandelt, nicht als Fehler.
--
-- SICHERHEIT (Wurzel 6): wie 0493 — RLS, restriktive Policy `for all`, und
-- anon/authenticated bekommen nichts. Die Tabelle enthaelt fertige Texte, die
-- an Gaeste hinausgehen.

create table if not exists public.ki_autoantwort_warteschlange (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants (id) on delete cascade,

    -- Wie im Protokoll: je nach Quelle eine channex_booking- oder eine
    -- whatsapp_conversation-Zeile, deshalb kein Fremdschluessel.
    thread_id text not null,
    quelle text not null check (quelle in ('inbox', 'whatsapp')),

    regel_id uuid references public.ki_regel (id) on delete set null,

    -- Die Gastfrage, auf die geantwortet wird. Sie steht hier, damit beim
    -- Versand geprueft werden kann, ob sie noch die letzte ist.
    frage text not null,
    -- Der fertige Text. Er wird BEIM PLANEN erzeugt, nicht beim Senden: so
    -- sieht der Betrieb im Protokoll sofort, was hinausgehen wird, und ein
    -- Ausfall des KI-Dienstes verzoegert nicht den Versand, sondern
    -- verhindert die Planung.
    antwort text not null,

    send_at timestamptz not null,
    status text not null default 'wartend'
        check (status in ('wartend', 'gesendet', 'abgebrochen', 'fehler')),
    abbruch_grund text,
    letzter_fehler text,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint ki_warteschlange_grund_laenge
        check (abbruch_grund is null or length(abbruch_grund) <= 300)
);

-- Hoechstens EINE wartende Antwort je Thread (Wurzel 2). Partiell, weil
-- gesendete und abgebrochene Zeilen als Spur stehen bleiben sollen.
create unique index if not exists ki_warteschlange_ein_wartender_je_thread
    on public.ki_autoantwort_warteschlange (tenant_id, thread_id)
    where status = 'wartend';

-- Der Tick sucht faellige wartende Zeilen ueber ALLE Betriebe.
create index if not exists ki_warteschlange_faellig_idx
    on public.ki_autoantwort_warteschlange (status, send_at)
    where status = 'wartend';

alter table public.ki_autoantwort_warteschlange enable row level security;

drop policy if exists ki_warteschlange_tenant
    on public.ki_autoantwort_warteschlange;
create policy ki_warteschlange_tenant on public.ki_autoantwort_warteschlange
    for all using (tenant_id = public.current_tenant_id());

drop policy if exists ki_warteschlange_write_restrict
    on public.ki_autoantwort_warteschlange;
create policy ki_warteschlange_write_restrict
    on public.ki_autoantwort_warteschlange
    as restrictive for all using (tenant_id = public.current_tenant_id());

revoke all on public.ki_autoantwort_warteschlange from anon, authenticated;
