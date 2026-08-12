-- Worker-Verlauf: WAS getan wurde, nicht nur DASS etwas lief.
--
-- DER LIVE-BEFUND (12.08.2026): Der Verlauf unter /worker zeigte je Zeile
-- Richtung, Vorgang, Dauer und Ergebnis — und damit die Frage „was hat der
-- Worker gemacht?" nicht. Ein `sync_bookings_feed · ok · 92.501 ms` sagt nicht,
-- ob 12 Buchungen ankamen oder null; ein `taxes · ok` nicht, ob eine
-- Reinigungsgebühr von 795 DKK rausging.
--
-- Die Angaben WAREN vorhanden, nur nicht dort:
--   * Die Handler hielten ihr Ergebnis (`saved`/`skipped`/`errors`) in der Hand,
--     schrieben es ins Log und gaben `None` zurück — der Verlauf sah es nie.
--   * Die Portal-Aufrufe trugen ihren vollständigen Request-Body in
--     `channex_debug_log`, aber `worker_ereignis.quelle_id` blieb NULL (der
--     Insert holte die neue ID nicht zurück). Alle 5 `gesendet`-Zeilen waren
--     deshalb nicht aufklappbar: die Bodies lagen da, unerreichbar.
--
-- Diese Migration schafft den Platz für das Ergebnis. Das Nachreichen der
-- `quelle_id` und die Handler-Rückgaben sind Code (kein Schema).
--
-- WARUM ZWEI SPALTEN:
-- `zusammenfassung` ist der Satz für die Tabelle — sofort lesbar, ohne
-- Aufklappen. `kennzahlen` trägt dieselben Angaben maschinenlesbar, damit
-- später darauf gefiltert/gerechnet werden kann („zeig Läufe mit errors > 0"),
-- ohne einen Text zu parsen.
--
-- WARUM KEINE NUTZLASTEN AUCH HIER NICHT:
-- Die Tabelle ist per Grant für `authenticated` lesbar (nötig fürs Realtime-Abo)
-- und bleibt es. `zusammenfassung` darf deshalb NUR tragen, was der Betrieb
-- ohnehin über sich selbst sehen darf: Mengen, Titel, Beträge der EIGENEN
-- Abgaben. Keine Gastdaten, keine Portal-Zugänge, keine fremden Mandanten
-- (Wurzel 6). Die vollen Bodies bleiben in `channex_debug_log` und kommen
-- ausschliesslich über den service-role-Endpunkt hinter `is_platform_admin()`.

alter table public.worker_ereignis
    add column if not exists zusammenfassung text,
    add column if not exists kennzahlen jsonb;

-- Kein Nachtragen für vorhandene Zeilen: die Ergebnisse jener Läufe wurden
-- nirgends gespeichert, sie sind nicht rekonstruierbar. Ein plausibler Text
-- wäre erfunden (Wurzel 4) — dort bleibt NULL, und die Oberfläche zeigt das
-- als „—", nicht als Leerstring.

comment on column public.worker_ereignis.zusammenfassung is
    'Was der Vorgang getan hat, in einem Satz fuer die Verlaufs-Tabelle: '
    '„12 Revisionen geholt, 3 gespeichert" / „Reinigungsgebuehr 795,00 DKK pro '
    'Buchung". NUR aus echten Rueckgabewerten bzw. dem echten Request-Body — '
    'nie ein geratener Text (Wurzel 4). NULL, wenn der Vorgang nichts '
    'berichtet hat.';
comment on column public.worker_ereignis.kennzahlen is
    'Dieselben Angaben maschinenlesbar (z. B. {"geholt":12,"gespeichert":3,'
    '"fehler":2}), damit man filtern/rechnen kann, ohne den Text zu parsen.';
