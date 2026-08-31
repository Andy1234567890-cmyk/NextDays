-- Fortschritt des Datei-Bestandsimports (Portal-Export .xls/.xlsx/.csv).
--
-- WARUM: Der Import lief bis zum 31.08.2026 in EINER HTTP-Anfrage. Live
-- gemessen an einem Booking.com-Export mit 252 Zeilen: 3,6 s je Zeile, also
-- rund 15 Minuten — der Browser bricht lange vorher ab und zeigt „Backend
-- nicht erreichbar.", waehrend der Server unbeirrt weiterschreibt. Der Betrieb
-- sah einen Fehler und hatte trotzdem einen halb angelegten Bestand; ein
-- zweiter Versuch wirkte wie ein Neuanfang, war aber ein Nachtrag (die
-- Idempotenz ueber die externe ID hat das abgefangen, sichtbar war es nicht).
--
-- Derselbe Weg wie beim Airbnb-Historien-Import (0301): der Klick reiht einen
-- Job ein, der Worker arbeitet ihn ab und schreibt seinen Stand hierher, die
-- Oberflaeche liest ihn per Realtime. Die Seite darf geschlossen werden.
--
-- EINE Zeile je Lauf: der Fortschritt beantwortet „wie weit ist mein Import",
-- nicht „was ist mit Zeile 137".
create table if not exists public.bestandsimport_lauf (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  -- Wer ihn gestartet hat — bekommt am Ende die Glocken-Meldung.
  gestartet_von uuid references auth.users(id) on delete set null,
  status        text not null default 'laeuft'
                check (status in ('laeuft', 'fertig', 'unvollstaendig', 'fehler')),
  -- Woher der Export stammt (Booking.com, Airbnb, …) — steht in der Anzeige,
  -- damit bei mehreren Portalen klar ist, welcher Import gerade laeuft.
  quelle        text,
  zeilen_gesamt integer not null default 0,
  zeilen_fertig integer not null default 0,
  -- Getrennt zaehlen wie in 0301: „0 neu, 252 vorhanden" ist die Aussage, die
  -- belegt, dass ein zweiter Upload nichts doppelt angelegt hat. Eine Summe
  -- wuerde genau das verstecken.
  angelegt      integer not null default 0,
  uebersprungen integer not null default 0,
  fehlerhaft    integer not null default 0,
  -- Objekt/Gast der Zeile, die gerade laeuft — die Zeile unter dem Balken.
  aktuelle_zeile text,
  -- Zeilen, die nicht durchliefen, namentlich mit Grund. Kein stilles
  -- Ueberspringen: was fehlt, muss nachbesserbar sein (Wurzel 5).
  gescheitert   jsonb not null default '[]'::jsonb,
  fehler        text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  beendet_at    timestamptz
);

create index if not exists bestandsimport_lauf_tenant_idx
  on public.bestandsimport_lauf (tenant_id, created_at desc);

-- Hoechstens EIN laufender Import je Betrieb. Zwei gleichzeitige Laeufe
-- schrieben dieselben Buchungen parallel und ueberholten sich (Wurzel 2) — der
-- zweite Klick soll den ersten FINDEN, nicht verdoppeln.
create unique index if not exists bestandsimport_lauf_offen_uq
  on public.bestandsimport_lauf (tenant_id)
  where status = 'laeuft';

alter table public.bestandsimport_lauf enable row level security;

-- Nur der eigene Betrieb sieht seine Laeufe. Geschrieben wird ausschliesslich
-- vom Server (service_role) — kein insert/update/delete fuer die Client-Rollen
-- (Wurzel 6): sonst koennte ein eingeloggter Nutzer per anon-Key-curl einen
-- Lauf als „fertig" markieren, den es nie gab, oder fremde Zeilen faelschen.
drop policy if exists bestandsimport_lauf_select on public.bestandsimport_lauf;
create policy bestandsimport_lauf_select on public.bestandsimport_lauf
  for select using (tenant_id = public.current_tenant_id());

revoke insert, update, delete on public.bestandsimport_lauf
  from anon, authenticated;
grant select on public.bestandsimport_lauf to authenticated;

-- Zusaetzlich eine RESTRIKTIVE Policy `for all` — nicht nur `for select`.
--
-- WARUM BEIDES: Der Vorgaenger `airbnb_historie_lauf` (0301) hatte genau die
-- permissive select-Policy von oben und sonst nichts. 0337 musste ihn deshalb
-- nachtraeglich schliessen, mit der Begruendung „0 restriktive Policies,
-- Schreibpfad tenant-weit offen: ein Angreifer kann den Lauf-Status fremd
-- ueberschreiben und den Import kippen". Das GRANT allein haette dort schon
-- gereicht — die restriktive Policy ist der zweite Riegel fuer den Fall, dass
-- ein spaeteres `grant` das erste wieder aufmacht (Wurzel 6: nicht auf EINE
-- Massnahme verlassen).
--
-- Anders als bei `airbnb_historie_lauf` bleibt SELECT hier bewusst offen: die
-- Zeile traegt keine Gastdaten (der Dateiinhalt geht in die Job-Payload, nicht
-- in diese Tabelle — siehe `bestandsimport_starten`), und ohne SELECT waere das
-- Realtime-Abo eine stumme Attrappe. Genau daran ist der Fortschrittsbalken des
-- Airbnb-Imports gestorben: er laeuft seit 0337 nicht mehr live mit.
drop policy if exists bestandsimport_lauf_tenant_restrict
  on public.bestandsimport_lauf;
create policy bestandsimport_lauf_tenant_restrict on public.bestandsimport_lauf
  as restrictive for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- Realtime: die Oberflaeche haengt am Balken. Ohne Publikation waere das Abo
-- eine stumme Attrappe — die UI saehe live aus und aktualisierte nie.
alter publication supabase_realtime add table public.bestandsimport_lauf;

comment on table public.bestandsimport_lauf is
  'Fortschritt eines Datei-Bestandsimports (Portal-Export). Wird vom Worker '
  'geschrieben, von der Oberflaeche per Realtime gelesen — der Betrieb muss '
  'die Seite nicht offenhalten.';
