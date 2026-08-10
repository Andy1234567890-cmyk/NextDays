-- 0355 — Vertragsende je Objekt: ab dem Tag zu, überall
--
-- ANLASS (Kunde, 10.08.2026): Ein Objekt-Anbieter kündigt den Vermarktungs-
-- vertrag zum 02.01.2027. Ab diesem Tag darf das Objekt nirgends mehr
-- verkauft werden: nicht im eigenen Kalender, nicht auf myBestDays, nicht bei
-- Booking/Airbnb/Expedia. Heute gibt es dafür kein Feld — der Betrieb müsste
-- sich das Datum merken und von Hand Jahr für Jahr sperren. Genau das geht
-- schief: irgendwann kommt eine Buchung für einen Tag, für den es keinen
-- Vertrag mehr gibt.
--
-- WARUM AM OBJEKT UND NICHT AM EIGENTÜMER:
-- Ein Eigentümer kann mehrere Objekte haben und nur EINES herausnehmen (er
-- verkauft ein Haus, behält das andere in der Vermarktung). Das Enddatum ist
-- daher eine Eigenschaft des Vermarktungsverhältnisses zu DIESEM Objekt.
-- Beendet der Eigentümer alles, setzt der Betrieb es auf jedem seiner Objekte
-- — das ist derselbe Vorgang, nur mehrfach, und braucht keine zweite Ebene.
-- (Muster wie owner_billing_terms 0343: Objekt schlägt Eigentümer; hier ohne
-- Eigentümer-Vorgabe, weil es die Anforderung nicht verlangt.)
--
-- WARUM EIN DATUM UND KEIN FLAG:
-- Ein `vermarktung_beendet boolean` verliert die Zeitachse: bis zum 01.01.2027
-- ist das Objekt normal buchbar und muss auch normal verkauft werden. Erst der
-- 02.01.2027 ist zu. Ein Flag, das man am Endtag manuell umlegt, wäre eine
-- Aufgabe für einen Menschen an einem bestimmten Tag — also ein Fehler, der
-- irgendwann passiert.
--
-- SEMANTIK: `contract_end_date` ist der ERSTE GESPERRTE TAG (Grenze
-- ausschließlich, wie `gueltig_bis` in 0343 und wie `DateRange.end` im
-- Kalender). 02.01.2027 heißt: die Nacht vom 01. auf den 02.01. wird noch
-- verkauft, die Nacht vom 02. auf den 03. nicht mehr. Das ist die
-- Abreise-Logik, die der Betrieb kennt — der Gast der letzten Vertragsnacht
-- checkt am Endtag aus.
--
-- NULL = unbefristet. Ein echter Zustand, kein Fantasie-Datum 9999-12-31
-- (Wurzel 4).

alter table public.properties
  add column if not exists contract_end_date date;

comment on column public.properties.contract_end_date is
    'Erster Tag OHNE Vermarktungsvertrag (Grenze ausschliesslich, wie '
    'owner_billing_terms.gueltig_bis). Ab diesem Tag ist das Objekt auf ALLEN '
    'Kanaelen gesperrt: eigener Kalender, myBestDays, OTAs. NULL = '
    'unbefristet, kein Ersatzdatum (Wurzel 4, 0355).';


-- =========================================================================
-- Eigener Sperr-Grund `contract_end` in availability_source
-- =========================================================================
-- WARUM NICHT `manual`: `CalendarService._unblock` hebt Sperren mit
-- `source in ('manual','portal')` auf (0354-Nachlauf). Eine Vertragssperre,
-- die als `manual` in der Tabelle liegt, wäre damit über „Sperre aufheben" im
-- Kalender mit einem Klick weg — und das Objekt bei den Portalen wieder
-- verkaufbar, obwohl es keinen Vertrag mehr gibt. Der eigene Wert macht sie
-- für diesen Weg unerreichbar: sie verschwindet NUR, wenn das Enddatum
-- selbst geändert oder entfernt wird (Wurzel 1 — Gegenzustand am selben
-- Schalter).
--
-- Zusätzlich ist die Herkunft damit auf dem Balken ablesbar: „gesperrt, weil
-- der Vertrag endet" ist eine andere Aussage als „jemand hat zugemacht".
alter type public.availability_source add value if not exists 'contract_end';


-- =========================================================================
-- Backstop auf DB-Ebene: keine Reservierung nach dem Endtag
-- =========================================================================
-- Der Service prüft das beim Anlegen (422). Wurzel 6: ein Client mit gültigem
-- JWT und dem öffentlichen anon-Key spricht PostgREST direkt an und umgeht den
-- FastAPI-Layer komplett. `reservations` ist für `authenticated` zwar nicht
-- schreibbar, aber der Trigger kostet nichts und deckt auch den Fall ab, dass
-- ein künftiger Servicepfad die Prüfung vergisst — die Sperre gehört an die
-- Daten, nicht nur an einen Codepfad.
--
-- Geprüft wird die ANKUNFT: liegt sie am Endtag oder später, gibt es für die
-- gesamte Buchung keinen Vertrag. Eine Buchung, die VOR dem Endtag anreist und
-- darüber hinausreicht, wird ebenfalls abgelehnt — die Nächte ab dem Endtag
-- wären unvertraglich, und ein stilles Kürzen des Zeitraums wäre eine
-- Falschaussage gegenüber dem Gast (Wurzel 4/5).
create or replace function public.pruefe_vertragsende_bei_reservierung()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_ende date;
begin
    -- Storno braucht keine Prüfung: eine Buchung zurückzunehmen ist immer
    -- erlaubt, auch wenn der Vertrag inzwischen endet.
    if new.status = 'cancelled' then
        return new;
    end if;

    select p.contract_end_date into v_ende
    from public.properties p
    where p.id = new.property_id;

    if v_ende is null then
        return new;
    end if;

    -- check_out ist die Abreise (ausschließlich): eine Buchung, die AM Endtag
    -- abreist, belegt nur Nächte davor und ist gültig.
    if new.check_out > v_ende then
        raise exception
            'Vermarktungsvertrag endet am %, Buchung reicht bis % (Objekt %)',
            v_ende, new.check_out, new.property_id
            using errcode = 'check_violation';
    end if;

    return new;
end;
$$;

revoke execute on function public.pruefe_vertragsende_bei_reservierung()
    from anon, authenticated;

drop trigger if exists pruefe_vertragsende on public.reservations;
create trigger pruefe_vertragsende
    before insert or update of check_in, check_out, property_id, status
    on public.reservations
    for each row execute function public.pruefe_vertragsende_bei_reservierung();

comment on function public.pruefe_vertragsende_bei_reservierung() is
    'Backstop (Wurzel 6): verhindert Reservierungen, die ueber '
    'properties.contract_end_date hinausreichen — auch auf dem '
    'PostgREST-Direktpfad am FastAPI-Layer vorbei. Storno ausgenommen (0355).';
