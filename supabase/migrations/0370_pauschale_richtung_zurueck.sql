-- Nimmt 0368 und 0369 zurück: die Pauschale-Achsen am VERTRAG waren der
-- falsche Ort.
--
-- 0368 gab `owner_billing_terms` eine `pauschale_richtung`, 0369 eine
-- `pauschale_bezeichnung` — damit ein Vertrag eine benannte Gutschrift tragen
-- kann (Nebenkosten-Pauschale an den Eigentümer). Der Fehler daran: ein Vertrag
-- hat GENAU EINE Pauschale, die Abrechnung des Betriebs führt aber mehrere mit
-- entgegengesetzter Richtung in einer Zeile:
--
--     Kaffee&Co Gebühr von Eigentümer     −50,00
--     NK-Pauschale an Eigentümer         +200,00
--
-- Für mehrere benannte Posten je Eigentümer existiert bereits
-- `owner_recurring_items` (label, abschnitt, modus, betrag, currency,
-- property_id, aktiv). Dort gehören sie hin; zwei Wege für dieselbe Sache
-- laufen unweigerlich auseinander.
--
-- Rückbau ist gefahrlos: beide Spalten sind seit heute da und nirgends gefüllt
-- außer durch die Vorbelegung aus der Richtung ('abzug' = die Bedeutung, die
-- vorher ohnehin galt). Kein Vertrag verliert eine Vereinbarung.

-- Erst die Gruppen-Regel auf ihren Stand vor 0368 zurück, sonst verhindert der
-- CHECK das Löschen der Spalten.
alter table public.owner_billing_terms
  drop constraint if exists owner_billing_terms_check2;
alter table public.owner_billing_terms
  add constraint owner_billing_terms_check2
  check (
    (pauschale_betrag is null and pauschale_currency is null
     and pauschale_basis is null and pauschale_zeitpunkt is null)
    or
    (pauschale_betrag is not null and pauschale_currency is not null
     and pauschale_basis is not null and pauschale_zeitpunkt is not null)
  );

alter table public.owner_billing_terms
  drop constraint if exists owner_billing_terms_pauschale_richtung_check;
alter table public.owner_billing_terms
  drop constraint if exists owner_billing_terms_pauschale_bezeichnung_check;

alter table public.owner_billing_terms
  drop column if exists pauschale_richtung;
alter table public.owner_billing_terms
  drop column if exists pauschale_bezeichnung;

-- Gegenprobe: beide Spalten sind weg, die Gruppen-Regel steht wieder zu viert.
do $$
declare
  uebrig int;
begin
  select count(*) into uebrig
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'owner_billing_terms'
     and column_name in ('pauschale_richtung', 'pauschale_bezeichnung');
  if uebrig > 0 then
    raise exception 'Rückbau unvollständig: % Spalte(n) noch vorhanden', uebrig;
  end if;
end $$;
