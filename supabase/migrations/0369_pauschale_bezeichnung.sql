-- Die Pauschale braucht einen NAMEN, sonst ist sie in der Abrechnung anonym.
--
-- Ein Vertrag kann mehrere Pauschalen tragen, und sie bedeuten Verschiedenes.
-- Die Abrechnung des Betriebs für 021 Stjerneskud benennt beide ausdrücklich:
--
--     Kaffee&Co Gebühr von Eigentümer     −50,00
--     NK-Pauschale an Eigentümer         +200,00
--
-- Stünde dort zweimal nur „Pauschale", könnte der Eigentümer die Zeile nicht
-- nachvollziehen — und genau das muss eine Abrechnung leisten. Die Bezeichnung
-- ist deshalb Teil der Vereinbarung, nicht ein Label in der Oberfläche.
--
-- Sie gehört zur Pauschale-Gruppe (vollständig oder leer), wie Betrag, Währung,
-- Basis, Zeitpunkt und Richtung. Bestandsverträge bekommen den Namen aus ihrer
-- Richtung, damit keine Zeile ohne Beschriftung dasteht.

alter table public.owner_billing_terms
  add column if not exists pauschale_bezeichnung text;

alter table public.owner_billing_terms
  drop constraint if exists owner_billing_terms_pauschale_bezeichnung_check;
alter table public.owner_billing_terms
  add constraint owner_billing_terms_pauschale_bezeichnung_check
  check (
    pauschale_bezeichnung is null
    or (length(btrim(pauschale_bezeichnung)) between 1 and 80)
  );

-- Bestandsverträge: aus der Richtung ableiten, damit keine Zeile namenlos ist.
update public.owner_billing_terms
   set pauschale_bezeichnung = case pauschale_richtung
         when 'gutschrift' then 'Pauschale an Eigentümer'
         else 'Pauschale'
       end
 where pauschale_betrag is not null
   and pauschale_bezeichnung is null;

-- Die Gruppe ist vollständig oder leer — jetzt zu sechst.
alter table public.owner_billing_terms
  drop constraint if exists owner_billing_terms_check2;
alter table public.owner_billing_terms
  add constraint owner_billing_terms_check2
  check (
    (pauschale_betrag is null and pauschale_currency is null
     and pauschale_basis is null and pauschale_zeitpunkt is null
     and pauschale_richtung is null and pauschale_bezeichnung is null)
    or
    (pauschale_betrag is not null and pauschale_currency is not null
     and pauschale_basis is not null and pauschale_zeitpunkt is not null
     and pauschale_richtung is not null and pauschale_bezeichnung is not null)
  );

comment on column public.owner_billing_terms.pauschale_bezeichnung is
  'Wie die Pauschale in der Abrechnung heisst (z. B. "NK-Pauschale an '
  'Eigentuemer"). Gehoert zur Pauschale-Gruppe: vollstaendig oder leer.';

-- Gegenprobe: keine Pauschale ohne Namen.
do $$
declare
  kaputt int;
begin
  select count(*) into kaputt
    from public.owner_billing_terms
   where (pauschale_betrag is not null) <> (pauschale_bezeichnung is not null);
  if kaputt > 0 then
    raise exception '% Vertraege mit Pauschale ohne Bezeichnung (oder umgekehrt)', kaputt;
  end if;
end $$;
