-- 0290 — Die Airbnb-Raumart mitspeichern, weil die Raum-ID FLÜCHTIG ist.
--
-- DER FEHLER, DEN DAS BEHEBT (live 05.08.2026, Listing 1675950565421151420):
-- Der Betrieb löschte den Balkon im Airbnb-Extranet, unser Zimmer-Sync legte
-- ihn wieder an — und Airbnb vergab eine NEUE Kennung (817240083 → 817255403).
-- Jede irgendwo gemerkte Raum-ID (offene Seite, Zeile in dieser Tabelle) zeigte
-- danach ins Leere: `PUT listing_photos/… {"room_id": "817240083"}` antwortete
-- „Room 817240083 not found for listing …". Für den Betrieb sah das aus wie ein
-- Fehler unseres Systems, obwohl niemand etwas falsch gemacht hatte.
--
-- Das passiert bei JEDEM Löschen-und-wieder-Anlegen, also beliebig oft. Airbnb
-- kennt keinen Weg, einen Raum über die Schnittstelle zu löschen (acht Formen
-- gemessen, alle „Route not found") — der Betrieb MUSS es im Extranet tun, und
-- genau dabei entsteht die neue Kennung.
--
-- DIE STABILE KENNUNG IST DIE ART, NICHT DIE ID: `balcony` bleibt `balcony`,
-- egal wie oft die Zeile neu entsteht. Mit der Art lässt sich eine tote ID
-- wieder auf das heutige Zimmer auflösen. Bei mehreren Zimmern derselben Art
-- (zwei Schlafzimmer) ist das nicht eindeutig — dann wird bewusst abgebrochen
-- statt geraten (Wurzel 4).

alter table public.airbnb_foto_raum
    add column if not exists airbnb_room_art text;

comment on column public.airbnb_foto_raum.airbnb_room_art is
    'Airbnbs Raumart (`balcony`, `bedroom`, …) zur Raum-ID. Die ID ist '
    'flüchtig — sie wechselt bei jedem Löschen/Neuanlegen im Extranet; die Art '
    'bleibt und erlaubt das erneute Auflösen.';
