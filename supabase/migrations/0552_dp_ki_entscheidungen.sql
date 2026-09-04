-- 0552_dp_ki_entscheidungen.sql — der Regel-Berater lernt aus den Entscheidungen
--
-- WARUM
-- =====
-- Ein Berater, der denselben Rat nach dem Ablehnen unverändert wiederholt, ist
-- keine Hilfe, sondern eine Nervensäge — und er wirkt dumm. RateBoards KI lernt
-- ausdrücklich aus zwei Quellen: der Historie UND den Entscheidungen des Kunden.
-- Die Historie werten wir bereits aus; hier kommt die zweite Quelle dazu.
--
-- WAS DAMIT MÖGLICH WIRD
-- ======================
--   * Abgelehnte Vorschläge ruhen (nicht: verschwinden für immer). Ändert sich
--     die Datenlage deutlich, darf derselbe Rat wiederkommen — mit neuer Zahl.
--   * Angenommene Vorschläge sind der Nachweis, dass der Berater etwas bewirkt
--     hat: man kann später prüfen, ob die Auslastung danach gestiegen ist.
--   * Der Betrieb sieht, was er wann entschieden hat.
--
-- WARUM DIE ZAHL MITGESPEICHERT WIRD
-- ==================================
-- Abgelehnt wird nicht "das Thema Wochenendaufschlag", sondern ein KONKRETER
-- Vorschlag ("15 % → 22 %"). Ohne den Wert wüsste der Berater nur, dass das
-- Feld unerwünscht ist, und müsste dauerhaft schweigen — auch wenn ein Jahr
-- später 35 % richtig wären. Mit dem Wert kann er unterscheiden, ob ein neuer
-- Vorschlag wesentlich anders ist.

create table if not exists public.dp_ki_entscheidungen (
    id           uuid primary key default gen_random_uuid(),
    tenant_id    uuid not null references public.tenants (id) on delete cascade,
    property_id  uuid not null references public.properties (id) on delete cascade,
    -- Der Schlüssel in dp_settings, auf den sich der Vorschlag bezog
    -- (z. B. 'weekend_uplift_pct', 'occupancy_steps', 'min_price').
    feld         text not null check (char_length(feld) between 1 and 80),
    entscheidung text not null check (entscheidung in ('angenommen', 'abgelehnt')),
    -- Werte als jsonb, weil ein Vorschlag eine Zahl (min_price) ODER eine ganze
    -- Stufenleiter (occupancy_steps) sein kann.
    wert_alt     jsonb,
    wert_neu     jsonb,
    -- Die Belege, auf denen der Vorschlag beruhte. Sie machen später
    -- nachvollziehbar, WARUM damals so entschieden wurde — ohne sie steht in
    -- einem Jahr eine Zahl ohne Zusammenhang da (Wurzel 5b).
    belege       jsonb not null default '{}'::jsonb,
    entschieden_von uuid references public.users (id) on delete set null,
    created_at   timestamptz not null default now()
);

comment on table public.dp_ki_entscheidungen is
  'Angenommene/abgelehnte Regel-Vorschlaege des DP-KI-Beraters. Der Berater '
  'liest sie, um abgelehnte Raete nicht unveraendert zu wiederholen.';

create index if not exists dp_ki_entscheidungen_property_idx
    on public.dp_ki_entscheidungen (property_id, feld, created_at desc);

alter table public.dp_ki_entscheidungen enable row level security;

drop policy if exists dp_ki_entscheidungen_tenant on public.dp_ki_entscheidungen;
create policy dp_ki_entscheidungen_tenant on public.dp_ki_entscheidungen
    for all
    using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- Wurzel 6: RLS erzwingt nur den MANDANTEN. Geschrieben wird ausschliesslich
-- vom Server (Annehmen/Ablehnen laeuft ueber die FastAPI-Route, die den Wert
-- selbst berechnet) — ein Client mit anon-Key darf hier nichts eintragen,
-- sonst koennte er sich eine Entscheidungshistorie erfinden.
revoke insert, update, delete on public.dp_ki_entscheidungen from anon, authenticated;
grant select on public.dp_ki_entscheidungen to anon, authenticated;
