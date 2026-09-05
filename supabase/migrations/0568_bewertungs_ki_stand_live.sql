-- 0568 — Live-Stand der Bewertungs-KI (Realtime-Signal) + Spiegel-Reparatur.
--
-- Anlass (05.09.2026): Die Bewertungsseite zeigte „20 offen", und niemand
-- konnte sehen, WARUM eine Bewertung offen bleibt und was die KI gerade tut.
-- Die Antwort stand verteilt in drei Tabellen (channex_review,
-- guest_review_queue, review_ki_protokoll), die alle drei für `authenticated`
-- bewusst gesperrt sind (Wurzel 6, 0337/0549) — ein Realtime-Abo darauf wäre
-- eine stumme Attrappe. Der KI-Takt selbst läuft im Worker, stündlich.
--
-- Deshalb EINE kleine Signal-Tabelle ohne Gast-Daten: je Betrieb eine Zeile,
-- die der KI-Lauf und der Versandlauf bei jedem Schritt fortschreiben. Sie
-- ist lesbar für den Betrieb und steht in der Publikation — das Abo auf sie
-- ist das Realtime-Signal, die Diagnose selbst holt die Oberfläche danach
-- über die API (`GET /reviews/ki/diagnose`), serverseitig gescopt.

create table if not exists public.review_ki_stand (
    tenant_id uuid primary key references public.tenants (id) on delete cascade,
    -- Wann der KI-Lauf für diesen Betrieb zuletzt durchgelaufen ist.
    letzter_lauf_at timestamptz,
    -- Was zuletzt passiert ist, als kurzer Satz OHNE Gastnamen/Texte
    -- (z. B. „Lauf gestartet", „Antwort entworfen", „3 Bewertungen ohne
    -- Text übersprungen"). Nur Signal, keine Nutzdaten.
    letzter_schritt text,
    schritt_at timestamptz not null default now(),
    laeufe integer not null default 0,
    updated_at timestamptz not null default now()
);

comment on table public.review_ki_stand is
    'Realtime-Signal der Bewertungs-KI je Betrieb: letzter Lauf, letzter '
    'Schritt. Keine Nutzdaten — die Diagnose liefert die API.';

alter table public.review_ki_stand enable row level security;

drop policy if exists review_ki_stand_tenant on public.review_ki_stand;
create policy review_ki_stand_tenant on public.review_ki_stand
    for all using (tenant_id = public.current_tenant_id());

drop policy if exists review_ki_stand_restrict on public.review_ki_stand;
create policy review_ki_stand_restrict on public.review_ki_stand
    as restrictive for all using (tenant_id = public.current_tenant_id());

-- Nur der Server schreibt (service_role). Der Betrieb liest — mehr nicht.
revoke all on public.review_ki_stand from anon, authenticated;
grant select on public.review_ki_stand to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'review_ki_stand'
  ) then
    alter publication supabase_realtime add table public.review_ki_stand;
  end if;
end $$;

-- --------------------------------------------------------------------------
-- Spiegel-Reparatur (Wurzel 1): Antworten sind beim Portal, der Spiegel sagt
-- „unbeantwortet".
-- --------------------------------------------------------------------------
-- Live 05.09.2026: zwei KI-Antworten (Warteschlange status='gesendet',
-- 11:32 und 12:31 UTC) standen in channex_review weiter mit
-- is_replied=false — ein Portal-Abgleich dazwischen hatte den lokalen Spiegel
-- auf den (noch nachhinkenden) Channex-Stand zurückgesetzt; der Abgleich ist
-- seit c16f524b repariert, die zwei Zeilen nicht. Folge ohne Reparatur: sie
-- zählen als „offen", die KI sieht sie als unbeantwortet, und ein manueller
-- Klick würde eine ZWEITE öffentliche Antwort einreichen.
-- Scope: nur Zeilen, zu denen ein gesendeter Antwort-Eintrag desselben
-- Betriebs existiert. Kein pauschales Update.
do $$
declare
  n integer;
begin
  update public.channex_review r
     set is_replied = true,
         reply      = coalesce(r.reply, q.text),
         reply_at   = coalesce(r.reply_at, q.sent_at)
    from public.guest_review_queue q
   where q.richtung = 'antwort'
     and q.status = 'gesendet'
     and q.antwort_auf_id::text = r.id::text
     and q.tenant_id = r.tenant_id
     and r.is_replied = false;
  get diagnostics n = row_count;
  raise notice '0568: % Bewertungen als beantwortet nachgezogen', n;
end $$;
