-- Eigentümer-Aufenthalt (Owner Stay).
--
-- Nutzt der Eigentümer sein eigenes Objekt — oder jemand in seinem Auftrag —,
-- ist das eine echte Belegung: der Zeitraum muss im Kalender gesperrt sein und
-- an die Portale gemeldet werden, sonst entsteht eine Doppelbuchung. Es ist
-- aber KEIN Umsatz. Bisher gab es dafür nur zwei schlechte Wege:
--
--   1. Sperrzeitraum (availability/manual): sperrt zwar, taucht aber nirgends
--      als Aufenthalt auf — weder in der Buchungsliste noch in der
--      Eigentümer-Abrechnung ist erkennbar, WER wann da war.
--   2. Reservierung mit Betrag 0: sperrt korrekt, zählt aber als Buchung mit
--      Umsatz 0 in Umsatz-Kennzahlen und Owner-Statement mit — eine „Buchung",
--      die die Auslastungs- und Ertragszahlen des Betriebs verwässert.
--
-- Deshalb eine eigene Kennzeichnung an der Reservierung. Sie erbt den gesamten
-- Belegungs- und Channex-Pfad (ein Weg, keine zweite Buchungslogik — Wurzel 1)
-- und wird auf den Geldpfaden ausgeschlossen.
--
-- Der CHECK ist bewusst hart (fail-closed, Wurzel 5): ein Eigentümer-Aufenthalt
-- kann keinen Betrag tragen. Ein späterer Fehler im Service, der doch einen
-- Preis setzt, scheitert dann an der Datenbank statt still Erträge zu erfinden,
-- die dem Eigentümer in Rechnung gestellt würden.

alter table public.reservations
  add column if not exists is_owner_stay boolean not null default false;

comment on column public.reservations.is_owner_stay is
  'Eigentümer-Aufenthalt: der Eigentümer nutzt das Objekt selbst. Sperrt den '
  'Kalender wie jede Buchung (inkl. Channex-Push), ist aber kein Umsatz — '
  'Betrag/Anzahlung/Kanalgebühr sind 0, keine Rechnung, keine Provision, nicht '
  'im Owner-Statement, nicht in der Umsatz-Kennzahl.';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'reservations_owner_stay_kostenlos'
  ) then
    alter table public.reservations
      add constraint reservations_owner_stay_kostenlos
      check (
        not is_owner_stay
        or (total_amount = 0 and paid_amount = 0 and channel_fee = 0)
      );
  end if;
end $$;

-- Die Abrechnungs- und Kennzahlpfade filtern auf genau diese Spalte, jeweils
-- zusammen mit tenant_id; ohne Index läuft der Ausschluss auf einen Seq-Scan.
create index if not exists reservations_owner_stay_idx
  on public.reservations (tenant_id, check_in)
  where is_owner_stay;

-- RLS/Grants: reservations trägt bereits Policies und Grants; eine zusätzliche
-- boolesche Spalte ist weder ein Geheimnis noch ein Rechte-Feld und braucht
-- deshalb keinen eigenen revoke (Wurzel 6 geprüft: die Spalte verrät nichts,
-- was die Zeile nicht ohnehin preisgibt).
