-- Die Pauschale je Buchung kann dem Eigentümer auch GUTGESCHRIEBEN werden.
--
-- Bis jetzt kannte `owner_billing_terms.pauschale_betrag` nur eine Richtung: sie
-- zog ab. Die Abrechnung des Betriebs führt aber zwei Pauschalen mit
-- entgegengesetztem Vorzeichen — belegt an der Zeile für 021 Stjerneskud,
-- Booking, 21.–29.08.2026:
--
--     AirSmil 20 %                      −746,28
--     Kaffee&Co Gebühr von Eigentümer    −50,00   ← Forderung an den Eigentümer
--     NK-Pauschale an Eigentümer        +200,00   ← Gutschrift an den Eigentümer
--     Auszahlung Eigentümer            3.135,10
--
-- Das über ein negatives `pauschale_betrag` zu lösen war nicht möglich (und wäre
-- auch falsch gewesen): der Check `pauschale_betrag >= 0` verbietet es, und ein
-- Betrag, dessen Vorzeichen die Bedeutung trägt, ist in einer Maske nicht
-- erklärbar — „Betrag: -200" liest niemand als „Gutschrift".
--
-- Darum eine eigene Achse. `richtung` ist Teil der Pauschale-Gruppe und
-- unterliegt derselben Vollständigkeitsregel wie Betrag/Währung/Basis/Zeitpunkt:
-- entweder alle fünf oder keins. Der Default 'abzug' hält jeden bestehenden
-- Vertrag bei seiner heutigen Bedeutung.

alter table public.owner_billing_terms
  add column if not exists pauschale_richtung text;

alter table public.owner_billing_terms
  drop constraint if exists owner_billing_terms_pauschale_richtung_check;
alter table public.owner_billing_terms
  add constraint owner_billing_terms_pauschale_richtung_check
  check (pauschale_richtung is null or pauschale_richtung in ('abzug', 'gutschrift'));

-- Bestehende Verträge mit Pauschale behalten ihre Bedeutung.
update public.owner_billing_terms
   set pauschale_richtung = 'abzug'
 where pauschale_betrag is not null
   and pauschale_richtung is null;

-- Die Gruppe ist vollständig oder leer — jetzt zu fünft.
alter table public.owner_billing_terms
  drop constraint if exists owner_billing_terms_check2;
alter table public.owner_billing_terms
  add constraint owner_billing_terms_check2
  check (
    (pauschale_betrag is null and pauschale_currency is null
     and pauschale_basis is null and pauschale_zeitpunkt is null
     and pauschale_richtung is null)
    or
    (pauschale_betrag is not null and pauschale_currency is not null
     and pauschale_basis is not null and pauschale_zeitpunkt is not null
     and pauschale_richtung is not null)
  );

comment on column public.owner_billing_terms.pauschale_richtung is
  'abzug = die Pauschale verringert die Auszahlung (Verwaltungsentgelt); '
  'gutschrift = sie erhoeht sie (z. B. Nebenkosten-Pauschale an den Eigentuemer). '
  'Gehoert zur Pauschale-Gruppe: vollstaendig oder leer.';

-- Gegenprobe: kein Vertrag darf eine halbe Pauschale tragen.
do $$
declare
  kaputt int;
begin
  select count(*) into kaputt
    from public.owner_billing_terms
   where (pauschale_betrag is not null) <> (pauschale_richtung is not null);
  if kaputt > 0 then
    raise exception '% Vertraege mit Pauschale ohne Richtung (oder umgekehrt)', kaputt;
  end if;
end $$;
