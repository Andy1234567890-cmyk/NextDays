-- Serverseitiger Historien-Import: der Lauf-Zustand, damit der Betrieb den
-- Fortschritt sieht, OHNE die Seite offenhalten zu müssen.
--
-- Vorher fuhr die Oberfläche die Objekte selbst durch: Tab schließen hieß
-- Abbruch mitten im Lauf. Ein Import über 18 Objekte dauert Minuten — so lange
-- bleibt niemand auf der Seite. Jetzt reiht der Klick nur einen Job ein, der
-- Worker arbeitet ihn ab und schreibt seinen Stand hierher; die Oberfläche
-- liest ihn (Realtime) und kann jederzeit verlassen und wieder geöffnet werden.
--
-- EINE Zeile je Lauf, nicht je Objekt: der Fortschritt ist die Frage „wie weit
-- ist mein Import", nicht „was ist mit Objekt X".
create table if not exists public.airbnb_historie_lauf (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  -- Wer ihn gestartet hat — bekommt am Ende die Glocken-Meldung.
  gestartet_von uuid references auth.users(id) on delete set null,
  status        text not null default 'laeuft'
                check (status in ('laeuft', 'fertig', 'unvollstaendig', 'fehler')),
  von           date not null,
  bis           date not null,
  objekte_gesamt   integer not null default 0,
  objekte_fertig   integer not null default 0,
  -- Getrennt zählen: „139 aktualisiert, 0 neu" ist die Aussage, die zeigt, dass
  -- nichts doppelt angelegt wurde. Eine Summe würde das verstecken.
  angelegt      integer not null default 0,
  aktualisiert  integer not null default 0,
  uebersprungen integer not null default 0,
  -- Titel des Objekts, das gerade läuft — die Zeile unter dem Balken.
  aktuelles_objekt text,
  -- Objekte, die nicht durchliefen, namentlich mit Grund. Kein stilles
  -- Überspringen: fehlende Buchungen müssen sichtbar sein (Wurzel 5).
  gescheitert   jsonb not null default '[]'::jsonb,
  fehler        text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  beendet_at    timestamptz
);

create index if not exists airbnb_historie_lauf_tenant_idx
  on public.airbnb_historie_lauf (tenant_id, created_at desc);

-- Höchstens EIN laufender Import je Betrieb. Zwei gleichzeitige Läufe würden
-- dieselben Buchungen parallel schreiben und sich gegenseitig überholen
-- (Wurzel 2) — der zweite Klick soll den ersten finden, nicht verdoppeln.
create unique index if not exists airbnb_historie_lauf_offen_uq
  on public.airbnb_historie_lauf (tenant_id)
  where status = 'laeuft';

alter table public.airbnb_historie_lauf enable row level security;

-- Nur der eigene Betrieb sieht seine Läufe. Geschrieben wird ausschließlich
-- vom Server (service_role) — deshalb kein insert/update/delete für die
-- Client-Rollen (Wurzel 6): sonst könnte ein eingeloggter Nutzer per
-- anon-Key-curl einen Lauf als „fertig" markieren, den es nie gab.
drop policy if exists airbnb_historie_lauf_select on public.airbnb_historie_lauf;
create policy airbnb_historie_lauf_select on public.airbnb_historie_lauf
  for select using (tenant_id = public.current_tenant_id());

revoke insert, update, delete on public.airbnb_historie_lauf
  from anon, authenticated;
grant select on public.airbnb_historie_lauf to authenticated;

-- Realtime: die Oberfläche hört auf diese Tabelle, sonst wäre der Balken eine
-- Attrappe, die nie aktualisiert.
alter publication supabase_realtime add table public.airbnb_historie_lauf;

comment on table public.airbnb_historie_lauf is
  'Fortschritt eines serverseitigen Airbnb-Historien-Imports. Wird vom Worker '
  'geschrieben, von der Oberfläche per Realtime gelesen — der Betrieb muss die '
  'Seite nicht offenhalten.';
