-- Lesestand für Posteingangs-Verläufe, die KEINE Zeile in `channex_booking`
-- haben (Buchungsanfragen, Marktplatz, Übernahmen, WhatsApp).
--
-- WARUM: Ihr Lesestand wurde bisher NICHT gespeichert, sondern bei jedem Laden
-- neu abgeleitet — bei Anfragen aus „wer hat zuletzt geschrieben"
-- (`anfragen.py`: `is_read = letzte.sender == "property"`). Solange der Gast
-- der Letzte war, galt der Verlauf dauerhaft als ungelesen, EGAL wie oft ihn
-- jemand öffnete. Das Markieren lief zusätzlich ins Leere: der Schreibpfad
-- (`update_thread_flags`) verlangt eine `channex_booking`-Zeile und antwortete
-- für diese IDs mit 404.
--
-- Live gemeldet am 31.08.2026: zwei Anfragen („Unbekannter Gast", „Anne")
-- standen unverändert auf „Ungelesen", der Zähler blieb bei 2. Der Betrieb
-- hatte sie gelesen; das System konnte sich das nicht merken.
--
-- EIGENE TABELLE statt einer Spalte an `channex_webhook_event`: dort liegt ein
-- Ereignis-Journal, das andere Pfade mitnutzen (Diagnose, Auflösung von
-- Störungen). Ein Lesestand des Posteingangs gehört fachlich nicht hinein, und
-- er betrifft VIER Quellen mit verschiedenen Herkunftstabellen — die eine
-- Klammer darüber ist die Thread-Kennung, wie der Posteingang sie führt.
create table if not exists public.inbox_nebenquelle_lesestand (
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  -- Die Thread-Kennung MIT Präfix, genau wie der Posteingang sie führt
  -- („anfrage:<event_id>", „mb:…", „ue:…", „wa:…"). Kein Fremdschlüssel: die
  -- vier Quellen liegen in verschiedenen Tabellen, und ein Verlauf darf seinen
  -- Lesestand behalten, auch wenn die Quellzeile später aufgeräumt wird.
  thread_id  text not null,
  -- WANN gelesen wurde. Der Zeitpunkt, nicht ein Ja/Nein: „gelesen" gilt nur
  -- bis zur nächsten Gastnachricht — dieselbe Regel wie bei
  -- `channex_booking.read_at` (0302) und `service._ist_gelesen`. Ein blosses
  -- Flag bliebe für immer stehen, und eine neue Gastnachricht fiele niemandem
  -- mehr auf.
  read_at    timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, thread_id)
);

alter table public.inbox_nebenquelle_lesestand enable row level security;

-- Wurzel 6: geschrieben wird ausschliesslich vom Server (service_role). Ohne
-- den Entzug könnte ein eingeloggter Nutzer per anon-Key-curl fremde Verläufe
-- als gelesen markieren — und in einem Betrieb mit mehreren Mitarbeitern ist
-- „hat das schon jemand bearbeitet" eine Aussage, die stimmen muss.
revoke insert, update, delete on public.inbox_nebenquelle_lesestand
  from anon, authenticated;
grant select on public.inbox_nebenquelle_lesestand to authenticated;

drop policy if exists inbox_nebenquelle_lesestand_select
  on public.inbox_nebenquelle_lesestand;
create policy inbox_nebenquelle_lesestand_select
  on public.inbox_nebenquelle_lesestand
  for select using (tenant_id = public.current_tenant_id());

drop policy if exists inbox_nebenquelle_lesestand_restrict
  on public.inbox_nebenquelle_lesestand;
create policy inbox_nebenquelle_lesestand_restrict
  on public.inbox_nebenquelle_lesestand
  as restrictive for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

comment on table public.inbox_nebenquelle_lesestand is
  'Lesestand der Posteingangs-Verläufe ohne channex_booking-Zeile '
  '(anfrage:/mb:/ue:/wa:). Der Zeitpunkt, nicht ein Flag: gelesen gilt nur bis '
  'zur nächsten Gastnachricht.';
