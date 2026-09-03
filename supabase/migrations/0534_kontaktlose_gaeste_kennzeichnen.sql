-- 0534 — Gäste ohne jeden Kontakt als prüfbedürftig kennzeichnen (Bestand).
--
-- BEFUND (live am 03.09.2026, Gästekartei des Beta-Betriebs): „Andreas Dumler"
-- stand zweimal in der Liste. Eine Zeile ohne E-Mail und ohne Telefon
-- (Aufenthalt 2026-08-16), eine mit Booking-Alias-Mail und Rufnummer
-- (2027-07-31). Kein Anzeigefehler — zwei Datensätze ohne Verbindung.
--
-- URSACHE der Dublette: `resolve_or_create_guest` mergt bewusst NIE über den
-- Namen (zwei echte „Andreas Müller" dürfen nicht verschmelzen). Kommt dieselbe
-- Person einmal ohne Kontaktmerkmal herein, gibt es keinen Schlüssel — die
-- nächste Buchung legt neu an.
--
-- URSACHE der Unsichtbarkeit: `needs_review` wurde bis 0506 nur am fehlenden
-- NAMEN abgeleitet. Ein Gast MIT Namen und ohne jeden Kontakt galt damit als
-- gepflegt, obwohl ihn niemand erreichen kann und obwohl genau er die Dubletten
-- erzeugt. Der Filter „Nur unvollständige" fand ihn deshalb nicht — die Zeile,
-- die die Dublette verursacht, war die einzige, die man nicht finden konnte.
--
-- Der Code ist in derselben Änderung an der Wurzel korrigiert
-- (`identity.py::_create_guest` leitet `needs_review` jetzt auch aus dem
-- fehlenden Kontakt ab). Diese Migration zieht den BESTAND nach — ohne sie
-- bleiben die vorhandenen Zeilen unmarkiert, weil sie nie wieder durch den
-- Insert-Pfad laufen (Lehre aus 0430→0439: eine angewendete Migration läuft
-- nicht erneut, Korrekturen brauchen eine neue Nummer).
--
-- KEIN Datenverlust: `needs_review` ist eine Markierung, kein Inhalt. Was der
-- Kanal nicht geliefert hat, wird nicht erfunden (Wurzel 4).
--
-- Anonymisierte Gäste bleiben ausgenommen: sie sind DSGVO-gelöscht oder bereits
-- zusammengeführt (`merge` nullt Name und Kontakt). Sie zu markieren würde die
-- Nachpflege-Liste mit Zeilen füllen, die absichtlich leer sind.

update public.guests
   set needs_review = true
 where needs_review = false
   and anonymized_at is null
   and coalesce(btrim(email), '') = ''
   and coalesce(btrim(phone), '') = '';

-- Der Dubletten-Vorschlag (/api/v1/guests/duplicates) gruppiert nach
-- normalisiertem Namen bzw. Kontakt über alle Gäste eines Tenants. Der
-- Teilindex aus 0506 deckt nur `needs_review = true` ab; dieser trägt den
-- vollständigen Scan je Tenant.
create index if not exists guests_dubletten_scan_idx
  on public.guests (tenant_id, created_at)
  where anonymized_at is null;

comment on column public.guests.needs_review is
  'Gast ist unvollständig und braucht manuelle Pflege: kein echter Name (der '
  'Kanal liefert keinen — Airbnb etwa nie), KEIN Kontakt (weder E-Mail noch '
  'Telefon — dann fehlt dem Resolver der Schlüssel und dieselbe Person wird '
  'bei der nächsten Buchung erneut angelegt), oder E-Mail und Telefon zeigten '
  'beim Anlegen auf verschiedene Bestandsgäste. Wird in `_create_guest` aus '
  'dem Ergebnis abgeleitet, nicht vom Aufrufer gesetzt.';
