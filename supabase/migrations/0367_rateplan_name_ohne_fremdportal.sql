-- 0367 — „Grundpreis (von Airbnb)" umbenennen: ein Planname nennt kein Portal
--
-- BEFUND (live gelesen am 11.08.2026): 37 Preispläne trugen den Namen
-- „Grundpreis (von Airbnb)", davon 18 in der Form
-- „Grundpreis (von Airbnb) · BookingCom". Die zweite Gruppe sind unsere eigenen,
-- korrekten Kanalpläne (echter Preis, `rate_mode='derived'`,
-- `portal_scope='BookingCom'`) — sie erben nur den Namen des Elternplans und
-- hängen ihr eigenes Portal an.
--
-- WARUM DAS EIN FEHLER BEIM GAST IST: der Planname steht in der
-- Preisaufstellung der Buchung. Ein Gast, der über Booking.com bucht, liest in
-- seiner Bestätigung „Grundpreis (von Airbnb) · BookingCom" — ein fremdes Portal
-- namentlich in der eigenen Buchung. Nachgewiesen an den Live-Buchungen
-- 5648155537 und 6341901680, beide über Booking.com.
--
-- URSACHE (geschlossen in airbnb_objekt_abruf.PLAN_NAME): der Abruf schrieb die
-- Herkunft in den NAMEN. Die Absicht war richtig — der Betrieb soll sehen, dass
-- der Plan aus einem Portal-Abruf stammt und nicht selbst angelegt wurde. Nur
-- gehört diese Information an die Zuordnung (`channex_rate_plan_map`), nicht in
-- ein Feld, das der Gast liest. Ein Name ist Kundentext, kein Ablageort für
-- Metadaten.
--
-- WAS DIESE MIGRATION TUT: sie entfernt genau das Herkunfts-Fragment „ (von
-- Airbnb)" aus dem Namen und lässt alles andere stehen — der Kanalsuffix
-- „ · BookingCom" bleibt, denn er benennt das Portal, zu dem der Plan WIRKLICH
-- gehört. Aus „Grundpreis (von Airbnb) · BookingCom" wird „Grundpreis ·
-- BookingCom", aus „Grundpreis (von Airbnb)" wird „Grundpreis".
--
-- WARUM `replace` UND KEIN PAUSCHALES SETZEN: ein `set name = 'Grundpreis'` über
-- alle Treffer nähme den 18 Kanalplänen ihren Portal-Suffix und machte sie in
-- der Preisliste ununterscheidbar — 19 Zeilen „Grundpreis" am selben Objekt.
-- Ersetzt wird deshalb nur das Fragment.
--
-- IDEMPOTENT: nach dem Lauf enthält kein Name mehr „(von Airbnb)", die
-- `where`-Bedingung trifft also nichts mehr. Mehrfach laufen lassen ist
-- gefahrlos.
--
-- NICHT BETROFFEN: von Menschen angelegte Pläne („Standardpreis",
-- „Übernachtung mit Frühstück") — ihr Name enthält das Fragment nicht.

update public.rate_plans
   set name = trim(replace(name, ' (von Airbnb)', '')),
       updated_at = now()
 where name like '%(von Airbnb)%';

-- Gegenprobe im selben Lauf: bleibt ein Treffer stehen, ist die Ersetzung nicht
-- aufgegangen (z. B. abweichende Schreibweise) — dann soll die Migration
-- FEHLSCHLAGEN statt still einen Teil zu erledigen. Ein halb umbenannter
-- Bestand wäre schlimmer als der Ausgangszustand: niemand wüsste, welche Zeilen
-- schon behandelt sind.
do $$
declare
  offen integer;
begin
  select count(*) into offen from public.rate_plans where name like '%(von Airbnb)%';
  if offen > 0 then
    raise exception
      'Umbenennung unvollstaendig: % Preisplaene tragen weiterhin "(von Airbnb)" im Namen.',
      offen;
  end if;
end $$;
