-- „Professionelle Tools" — der Schalter, der die Massenbearbeitung freigibt.
--
-- QUELLE 1 · AIRBNB (Hilfe-Artikel 2499, deutsche und englische Fassung,
-- abgerufen 17.09.2026). Airbnb führt in den Kontoeinstellungen genau EINEN
-- Schalter: „Professionelle Tools nutzen". Er schaltet sechs Werkzeuge frei —
-- Multi-Kalender, Belegungssteuer, Einblicke, Reihen von Regeln, Zusätzliche
-- Gebühren, Aufgaben. Beim Abschalten heißt es dort wörtlich: „it'll take 1–2
-- days to remove your access and delete the data" für Preis- und
-- Verfügbarkeitsregeln, Regelsätze und Standardgebühren.
--
-- QUELLE 2 · BOOKING.COM (Lösungsseite „Gruppen-Extranet", deutsche und
-- englische Fassung, abgerufen 17.09.2026). Dort gibt es keinen Schalter,
-- sondern ein Kriterium: „Sie müssen mehr als eine Unterkunft auf Booking.com
-- verwalten." Herzstück ist die MASSENBEARBEITUNG: „Ganz gleich, ob Sie die
-- Check-in-Zeiten anpassen, Richtlinien aktualisieren oder Angebote für
-- verschiedene Einträge ändern müssen – mit der Massenbearbeitungsfunktion im
-- Gruppen-Extranet können Sie Änderungen für mehrere Unterkünfte ganz einfach
-- vornehmen."
--
-- WAS WIR ÜBERNEHMEN UND WAS NICHT.
--   • Airbnbs Schalter: ja. Eine Änderung, die mit einem Klick zwanzig Objekte
--     trifft, gehört nicht in die Standardoberfläche eines Gastgebers mit
--     einem Objekt.
--   • Bookings Kriterium: ja. Unterhalb von zwei Objekten hat die
--     Massenbearbeitung keinen Gegenstand.
--   • Airbnbs Löschung beim Abschalten: NEIN, und das ist Absicht. Dort sind
--     Regelsätze ein Zusatzprodukt; bei uns IST ein Regelsatz eine Saison
--     (0572), die jeder Gastgeber benutzt. Ein Schalter, der beim Umlegen
--     Saisons löscht, wäre eine Datenvernichtung mit harmloser Beschriftung.
--     Aus stehen hier also nur die WERKZEUGE, nie die DATEN.
--
-- KEIN ZWEITER ZUSTAND. Der Schalter steht am Betrieb, nicht am Nutzer: die
-- Massenbearbeitung ändert Objekte des Betriebs, und zwei Co-Gastgeber mit
-- verschiedenen Schalterstellungen wären zwei Antworten auf dieselbe Frage.
alter table public.tenants
    add column if not exists professional_tools boolean not null default false;

comment on column public.tenants.professional_tools is
    'Airbnb „Professionelle Tools nutzen" (Hilfe-Artikel 2499): schaltet die '
    'Massenbearbeitung frei. Vorgabe false — die Funktion ist neu, niemand '
    'verliert durch die Vorgabe etwas. Abschalten löscht NICHTS (anders als '
    'bei Airbnb), es nimmt nur die Werkzeuge weg.';

-- Kein `revoke` nötig, und das ist gemessen, nicht angenommen: `tenants` trägt
-- für anon und authenticated keinerlei select/insert/update/delete — nur
-- REFERENCES/TRIGGER/TRUNCATE aus der Supabase-Grundausstattung. Die neue
-- Spalte erbt genau das (ein Spalten-GRANT entsteht nicht von selbst), der
-- DB-Direktpfad bleibt also zu (Wurzel 6). Geschrieben wird ausschließlich
-- serverseitig mit service_role, geprüft über MANAGE_PROPERTIES.
