-- 0397_addon_storno_grund_protokoll.sql — Storno/Rücknahme einer Zusatzleistung
-- mit Grund und Nachvollziehbarkeit.
--
-- ANLASS (14.08.2026, live): Bei einer Booking-Buchung („Wäschepaket", 600 DKK)
-- wurde die Zusatzleistung versehentlich auf „Bezahlt" gesetzt. Danach gab es
-- KEINEN Weg zurück: `cancel_reservation_addon` und `change_qty` lehnen eine
-- bezahlte Position mit 409 ab („bitte zuerst die Zahlung rückabwickeln"), und
-- eine Route, die genau das täte, existierte nicht. Die Zeile war eine
-- Sackgasse — der falsche Betrag stand fest in Rechnung und
-- Eigentümer-Abrechnung.
--
-- Zusätzlich protokollierte der bestehende Storno NUR, DASS storniert wurde
-- (`log.info` in der Anwendung, nicht in der DB) — nicht WARUM und nicht von
-- WEM. Für einen Geldbetrag, der aus einer Abrechnung verschwindet, ist das zu
-- wenig: ohne Grund am Datensatz lässt sich später nicht mehr unterscheiden, ob
-- eine Leistung nie erbracht, kulanz-erlassen oder falsch erfasst wurde.
--
-- WAS DIESE MIGRATION TUT: drei Spalten an `reservation_addons`, die den Grund
-- und die Herkunft der Status-Rücknahme AM DATENSATZ festhalten. Der
-- Ereignis-Verlauf selbst läuft über die bestehende Zeitleiste
-- (`reservation_events`, 0122) — es entsteht bewusst KEINE zweite Log-Tabelle
-- (Muster: denormalisierte Felder am Datensatz + append-only Zeitleiste, wie
-- 0050/0122).
--
-- Warum ein Freitext-Grund und keine Enum-Liste: die realen Gründe sind
-- kaufmännisch und nicht abschließend aufzählbar (falsch erfasst, Gast hat
-- abbestellt, Kulanz, Doppelerfassung, Leistung nicht erbracht). Eine Enum
-- hätte beim ersten unpassenden Fall einen „sonstiges"-Wert erzwungen und die
-- Auskunft damit wertlos gemacht. Die Länge ist begrenzt (Wurzel 8), damit
-- kein unbegrenzter Text in die Zeile läuft.

alter table public.reservation_addons
    -- Warum die Position storniert bzw. die Bezahlt-Markierung zurückgenommen
    -- wurde. Pflicht auf dem Schreibpfad (der Service lehnt Leertext mit 422
    -- ab); hier nullable, weil Bestandszeilen und der Gast-Kaufpfad keinen
    -- Grund haben und NIE ein erfundener Ersatztext eingesetzt wird (Wurzel 4).
    add column if not exists cancel_reason text
        check (cancel_reason is null
               or (length(btrim(cancel_reason)) between 3 and 500)),
    -- Wer die Rücknahme ausgelöst hat. `on delete set null`: scheidet der
    -- Mitarbeiter aus, bleibt der Grund erhalten (der Beleg ist die Auskunft,
    -- nicht die Person).
    add column if not exists cancelled_by uuid
        references public.users (id) on delete set null,
    -- Wann. Getrennt von `charged_at` (Zahl-Zeitpunkt) und `created_at`
    -- (Kauf-Zeitpunkt): drei verschiedene Ereignisse, drei Zeitstempel.
    -- Unsere Uhr ist hier korrekt — es ist UNSERE Handlung (Wurzel 5b).
    add column if not exists cancelled_at timestamptz;

comment on column public.reservation_addons.cancel_reason is
    'Grund für Storno/Rücknahme der Bezahlt-Markierung (Pflicht auf dem '
    'Schreibpfad, 3-500 Zeichen). Nachvollziehbarkeit eines Betrags, der aus '
    'Rechnung und Eigentümer-Abrechnung herausfällt.';
comment on column public.reservation_addons.cancelled_by is
    'Mitarbeiter, der Storno/Rücknahme ausgelöst hat (null bei System/Gast).';
comment on column public.reservation_addons.cancelled_at is
    'Zeitpunkt von Storno/Rücknahme (unsere Handlung, unsere Uhr).';

-- Wurzel 6 — der DB-Direktpfad. `reservation_addons` trägt Beträge und ist
-- bereits per 0224 (write_lockdown) für anon/authenticated schreibgesperrt;
-- diese Migration fügt nur Spalten hinzu und öffnet nichts. Der Vollständigkeit
-- halber wird der Entzug hier idempotent wiederholt: sonst hinge die Annahme
-- „ist ja schon gesperrt" an einer anderen Datei, und ein Client könnte
-- `cancel_reason` selbst setzen (Grund fälschen) bzw. `status` direkt auf
-- 'cancelled' schreiben und damit Betrag ohne jede Spur aus der Abrechnung
-- nehmen. Lesen bleibt erlaubt (RLS-tenant-Policy aus 0075 entscheidet, welche
-- Zeilen) — die Oberfläche zeigt Grund und Datum an.
revoke insert, update, delete on public.reservation_addons from anon, authenticated;
