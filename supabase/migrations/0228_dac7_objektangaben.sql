-- § 14 Abs. 4 PStTG — die objektbezogenen Meldeangaben.
--
-- Rechtlicher Rahmen (gesetze-im-internet.de/psttg/__14.html), Nummern 1-6:
--   Nr. 1  Anschrift jeder inserierten Immobilieneinheit          PFLICHT
--   Nr. 2  Vergütung je Einheit, JE QUARTAL                       PFLICHT (gerechnet)
--   Nr. 3  Anzahl relevanter Tätigkeiten je Einheit               PFLICHT (gerechnet)
--   Nr. 4  Art der Einheit            „sofern vorhanden"          abgeleitet
--   Nr. 5  Anzahl der Vermietungstage „sofern vorhanden"          gerechnet
--   Nr. 6  Grundbuchnummer/gleichwertig „sofern vorhanden"        ERFASST
--
-- Was hier NICHT als Spalte entsteht, ist Absicht:
-- Nr. 1 steht bereits in properties (street/postal_code/city/country) — eine
-- zweite Anschrift danebenzulegen wäre ein Gegenzustand, der ausei­nanderläuft
-- (Wurzel 1). Nr. 2, 3 und 5 werden aus reservations GERECHNET; als
-- gespeicherte Zahl wären sie ab der ersten Stornierung falsch (Wurzel 4).
-- Nr. 4 wird aus properties.property_type abgeleitet.
--
-- Es bleibt genau EINE erfassbare Angabe: die Grundbuchnummer (Nr. 6). Genau
-- so machen es Airbnb ("Katasternummer … für jede Unterkunft") und Booking
-- ("separately for each property in the Extranet") — Steuerdaten am Konto,
-- Grundbuchnummer am Objekt.

-- Nr. 6: Grundbuchnummer oder gleichwertige Angabe nach dem Recht des
-- Belegenheitsstaats. Der Gesetzeswortlaut lässt Äquivalente ausdrücklich zu
-- ("oder eine gleichwertige Angabe"), in DE/AT ist das die Katasternummer.
-- Nullable, weil das Gesetz die Angabe nur „sofern vorhanden" verlangt: eine
-- NOT-NULL-Spalte würde eine Pflicht erzwingen, die es nicht gibt.
alter table public.properties
    add column if not exists land_registration_number text;

comment on column public.properties.land_registration_number is
    '§ 14 Abs. 4 Nr. 6 PStTG: Grundbuchnummer oder gleichwertige Angabe '
    '(Katasternummer). Nur „sofern vorhanden" — leer ist zulässig und '
    'blockiert weder Buchung noch Auszahlung.';

-- Wer die Nummer wann eingetragen hat. Für die Meldung selbst irrelevant,
-- für den Nachweis der Sorgfaltspflicht (§ 25 Abs. 1 Nr. 6) nicht: der
-- Betreiber muss zeigen können, dass er die Angabe erhoben hat.
alter table public.properties
    add column if not exists land_registration_confirmed_at timestamptz;

comment on column public.properties.land_registration_confirmed_at is
    'Zeitpunkt der letzten Bestätigung der Grundbuchnummer durch den '
    'Gastgeber — Nachweis der Erhebung, auch wenn das Ergebnis leer war.';

-- Der Gastgeber kann erklären, dass es keine Nummer gibt. Ohne dieses Feld
-- wären "noch nicht gefragt" und "gefragt, gibt es nicht" nicht
-- unterscheidbar — und der Betreiber könnte seine Erhebung nicht belegen.
alter table public.properties
    add column if not exists land_registration_unavailable boolean not null
        default false;

comment on column public.properties.land_registration_unavailable is
    'Der Gastgeber hat erklärt, dass für dieses Objekt keine Grundbuch-/'
    'Katasternummer existiert. Unterscheidet „nicht erhoben" von „erhoben, '
    'nicht vorhanden".';

-- Beides zugleich wäre widersprüchlich: entweder es gibt eine Nummer, oder
-- der Gastgeber hat erklärt, dass es keine gibt.
alter table public.properties
    drop constraint if exists properties_land_registration_widerspruch;
alter table public.properties
    add constraint properties_land_registration_widerspruch check (
        not (land_registration_unavailable and land_registration_number is not null)
    );

-- Die Meldung fragt „welche Objekte haben noch keine Angabe?" — ein
-- Teilindex genau auf diese Menge, statt die ganze Tabelle zu scannen.
create index if not exists properties_dac7_offen_idx
    on public.properties (tenant_id)
    where land_registration_number is null
      and land_registration_unavailable = false;

-- Wurzel 6: properties ist für anon/authenticated bereits schreibgesperrt
-- (0194). Die neuen Spalten erben das — es ist dieselbe Tabelle, kein neues
-- GRANT. Ein eigenes revoke wäre hier wirkungslose Kosmetik.
