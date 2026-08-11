-- 0359 — Vertragsende blockiert keine bestehende und keine importierte Buchung
--
-- ANLASS (live gefunden am 10.08.2026, direkt nach 0355): Das Setzen eines
-- Vertragsendes wurde abgelehnt, solange eine Buchung dahinter lag — mit der
-- Aufforderung „Storniere sie oder wähle ein späteres Datum". Genau diese
-- Stornierung ist für die Mehrzahl der Buchungen aber gar nicht möglich:
-- `ReservationsService.cancel` lehnt jede Buchung mit
-- `source_channex_booking_id` ab (409), weil ein lokaler Storno die Nächte
-- freigäbe und `availability=1` an Channex pushte, während der Gast bei
-- Booking.com weiter gebucht ist — eine Überbuchung. Live sind 66 von 93
-- künftigen Buchungen genau solche OTA-Buchungen. Der Nutzer stand also vor
-- einer Anweisung, die er nicht befolgen konnte.
--
-- FACHLICH RICHTIG IST OHNEHIN DAS ANDERE: Eine bestätigte Booking.com-Buchung
-- verschwindet nicht dadurch, dass der Vermarktungsvertrag endet. Sie wird
-- bedient, der Vertrag läuft für sie aus. Das Vertragsende sperrt die FREIEN
-- Tage ab dem Endtag — es entwertet keine bestehende Zusage an einen Gast.
--
-- WARUM DER TRIGGER GANZ FÄLLT und nicht nur gelockert wird:
-- Er sollte NEUE unvertragliche Buchungen verhindern (Wurzel 6: Schutz an den
-- Daten, nicht nur im Codepfad). Der reale Weg für eine Buchung nach dem
-- Enddatum ist aber der OTA-IMPORT — und der darf auf keinen Fall scheitern:
-- die Buchung existiert dann bei Booking.com, nur bei uns nicht. Der Gast
-- stünde vor der Tür, ohne dass ihn jemand erwartet, und der Kalender wäre
-- nicht mehr die Wahrheit über das, was real gebucht ist. Ein Trigger, der
-- zwischen „eigener Buchungsweg" und „Import" unterscheidet, müsste den
-- Aufrufer erraten — dieselbe Zeile entsteht auf beiden Wegen.
--
-- Der Schutz gegen unvertragliche NEUBUCHUNGEN bleibt trotzdem bestehen, und
-- zwar an der wirksameren Stelle: die Sperrnächte in `availability`
-- (`source='contract_end'`, 0355). Sie machen die Tage im eigenen Kalender zu
-- und melden sie den Portalen als nicht verfügbar — dort, wo die Buchung
-- entsteht. Eine Buchung, die trotzdem hereinkommt (Portal war schneller als
-- der Push), ist ein Fall für den Betrieb, kein Fall für einen 500er.

drop trigger if exists pruefe_vertragsende on public.reservations;
drop function if exists public.pruefe_vertragsende_bei_reservierung();

comment on column public.properties.contract_end_date is
    'Erster Tag OHNE Vermarktungsvertrag (Grenze ausschliesslich, wie '
    'owner_billing_terms.gueltig_bis). Ab diesem Tag werden die FREIEN Tage '
    'gesperrt (availability.source=contract_end) — im eigenen Kalender, auf '
    'myBestDays und bei den Portalen. BESTEHENDE Buchungen dahinter bleiben '
    'gueltig und werden bedient: eine bestaetigte Portal-Buchung verschwindet '
    'nicht dadurch, dass der Vertrag endet (0359). NULL = unbefristet, kein '
    'Ersatzdatum (Wurzel 4, 0355).';
