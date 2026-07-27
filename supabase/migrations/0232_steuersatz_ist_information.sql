-- Die Landessaetze sind INFORMATION, kein Einbehaltsauftrag.
--
-- Wir behalten von der Auszahlung des Gastgebers nichts ein. `withholding_bps`
-- las sich aber genau so — "withholding" heisst Einbehalt. Wer die Spalte
-- spaeter im Zahlungspfad findet, koennte sie folgerichtig als Abzugsauftrag
-- verdrahten und Geld einbehalten, das uns nicht zusteht.
--
-- Neuer Name sagt, was es ist: der Satz, den der Gastgeber in diesem Land auf
-- seine Einnahmen schuldet — damit wir ihm die richtige Berechnung anbieten
-- koennen (property_taxes, 0231). Die Werte bleiben unveraendert.

begin;

alter table public.tax_country_rules
  rename column withholding_bps_with_id to host_tax_bps_with_id;
alter table public.tax_country_rules
  rename column withholding_bps_without_id to host_tax_bps_without_id;

alter table public.tax_country_rules
  rename constraint tax_country_rules_bps_bereich
  to tax_country_rules_host_bps_bereich;

comment on column public.tax_country_rules.host_tax_bps_with_id is
  'Steuersatz in Basispunkten, den der Gastgeber im Land schuldet, wenn seine '
  'Steuer-ID vorliegt. NUR Information fuer die Berechnung — die Plattform '
  'behaelt nichts ein.';
comment on column public.tax_country_rules.host_tax_bps_without_id is
  'Erhoehter Satz ohne Steuer-ID (z. B. Kenia 20 % statt 5 %). Ebenfalls nur '
  'Information: wir weisen ihn aus, damit der Gastgeber seine ID hinterlegt.';

-- Vietnam war als eine Zahl (700) hinterlegt. Das sind zwei verschiedene
-- Steuern mit verschiedenen Empfaengern — 5 % VAT und 2 % Einkommensteuer.
-- Als Summe ist es rechnerisch richtig, aber der Gastgeber kann nicht
-- nachvollziehen, was er wem schuldet. Die Aufschluesselung gehoert in die
-- Notizen, bis wir sie strukturiert brauchen.
update public.tax_country_rules
set notes = notes || ' AUFSCHLUESSELUNG: 500 bps VAT + 200 bps '
  || 'Einkommensteuer (PIT) beim inlaendischen Vermieter; beim '
  || 'auslaendischen 500 + 500. Zwei getrennte Steuern, nicht ein Satz.'
where country = 'VN';

commit;
