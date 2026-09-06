-- 0575 — Tippfehler in `seam_zugang.am_gerraet_at` korrigieren
--
-- DER FEHLER: 0573 legte die Spalte als `am_gerraet_at` an (doppeltes „r"),
-- der Python-Code schreibt und liest sie aber als `am_geraet_at`. Beides
-- entstand im selben Zug, deshalb fiel es beim Schreiben nicht auf.
--
-- WAS DAS ANGERICHTET HÄTTE — der Fund ist kein Schönheitsfehler:
--   * `webhook.py` setzt genau dieses Feld, wenn Seam meldet, dass der Code am
--     Gerät angekommen ist. Der `update` wäre gegen eine nicht existierende
--     Spalte gelaufen → PostgREST-Fehler → der Handler fängt nur
--     ValueError/KeyError/TypeError, ein APIError fliegt durch → HTTP 500 →
--     Svix wiederholt 18 Stunden lang, und `status` bliebe für immer auf
--     `angelegt`. Der Zustand „Code ist wirklich am Schloss" wäre nie
--     erreichbar gewesen.
--   * `zugang_zu_buchung` liest das Feld mit → die Türcode-Anzeige JEDER
--     Buchung hätte 500 geantwortet.
--
-- WARUM ES DIE TESTS NICHT FANDEN: die In-Memory-Fake-DB nimmt beliebige
-- Spaltennamen an. Genau die im Projekt dokumentierte Schwäche („Live-E2E
-- findet, was pytest nicht kann"). Gefunden hat es ein Review-Agent, der
-- Migration und Code gegeneinander gelesen hat.
--
-- WARUM EINE NEUE MIGRATION UND KEIN EDIT AN 0573: eine angewendete Migration
-- läuft nie wieder. Eine Korrektur IN 0573 wäre auf der Live-DB wirkungslos
-- und hätte die Abweichung nur unsichtbar gemacht (Projektregel).

-- Idempotent: läuft nur, wenn die falsch benannte Spalte noch existiert und
-- die richtige noch nicht.
do $$
begin
    if exists (
        select 1 from information_schema.columns
         where table_schema = 'public'
           and table_name = 'seam_zugang'
           and column_name = 'am_gerraet_at'
    ) and not exists (
        select 1 from information_schema.columns
         where table_schema = 'public'
           and table_name = 'seam_zugang'
           and column_name = 'am_geraet_at'
    ) then
        alter table public.seam_zugang
            rename column am_gerraet_at to am_geraet_at;
    end if;
end
$$;

comment on column public.seam_zugang.am_geraet_at is
    'Wann der Code WIRKLICH am Geraet ankam — gesetzt vom Seam-Webhook, nicht '
    'aus dem Erfolg des Anlege-Aufrufs geschlossen. Ein HTTP-200 beim Anlegen '
    'beweist nur, dass Seam den Auftrag annahm.';
