-- 0618 — Altbestand: Dubletten bereinigen, dann `einmalig` fuer die
--        Ereignis-Praefixe nachziehen
--
-- ANLASS: 0617 hat die Spalte `notifications.einmalig` und den zweiten
-- UNIQUE-Index `notifications_dedup_einmalig_uq` angelegt und den Code an den
-- Ereignis-Stellen umgestellt. Damit ist jede KUENFTIGE Meldung geschuetzt.
-- Der BESTAND ist es nicht: alle Zeilen tragen `einmalig = false` (die
-- Vorgabe), und die Dubletten, die der alte Riegel durchgelassen hat, stehen
-- weiter da.
--
-- WARUM DAS EINE EIGENE MIGRATION IST UND KEINE AENDERUNG AN 0617: Eine
-- angewendete Migration laeuft nie wieder — eine Korrektur in der alten Datei
-- ist auf der Live-DB wirkungslos (Lehre aus 0430 → 0439).
--
-- LIVE GEMESSEN am 09.09.2026 gegen die Produktions-DB (30 Tage,
-- Meldungen / dahinterliegende Ereignisse):
--
--     betrieb_buchung            476 / 218   (258 zu viel)
--     nachricht                  198 /  43   (155)
--     buchung                    386 / 237   (149)
--     block_request               21 /  11    (10)
--     eigchat                      8 /   4     (4)
--     block_request_aufhebung      2 /   1     (1)
--     aufgabe_zugewiesen (746), block_decision (13), aufgabe_entzogen (12),
--     airbnb_foto_fehlt (1)                    — KEIN Ueberschuss
--
-- Von 75 Mehrfach-Faellen bei Buchungen waren fast alle Zeilen GELESEN
-- (22/26, 30/30, 16/16) — der Lesestand war der Ausloeser, nicht ein
-- doppelter Aufruf.
--
-- ---------------------------------------------------------------------------
-- WARUM DIE REIHENFOLGE ZWINGEND IST (Bereinigen VOR dem Setzen)
-- ---------------------------------------------------------------------------
-- `notifications_dedup_einmalig_uq` ist ein UNIQUE-Index auf
-- `(user_id, dedup_key) where dedup_key is not null and einmalig`. Wuerde
-- diese Migration `einmalig = true` setzen, WAEHREND die 75 Dubletten noch
-- stehen, schlaegt das `update` mit 23505 fehl und die ganze Migration bricht
-- ab — der Index prueft ja beim Hineinwachsen in seine WHERE-Bedingung.
-- Also: erst entdoppeln, dann kennzeichnen. Ein `update ... on conflict` gibt
-- es nicht, und ein „stilles Ueberspringen" waere Wurzel 5 (der Konflikt ist
-- hier ein Kontroll-Signal, kein Rauschen).
--
-- ---------------------------------------------------------------------------
-- WELCHE ZEILE BLEIBT — UND WARUM DIE JUENGSTE
-- ---------------------------------------------------------------------------
-- Behalten wird die Zeile mit dem GROESSTEN `created_at` (bei Gleichstand die
-- mit der groesseren `id`, damit die Auswahl deterministisch ist und nicht
-- vom Planer abhaengt). Begruendung, gegen die naheliegende Gegenposition
-- „die erste ist das Original":
--
--  1. Die spaeteren Zeilen sind INHALTLICH die besseren. Der Rumpf der
--     Buchungsmeldung ist im Zuge derselben Arbeit gewachsen (Eckdaten,
--     Kanal, uebersetzte Bausteine); eine im Juli erzeugte Zeile traegt
--     womoeglich nur „Otto · None" (der Kanal-Backstop, der das Wort „None"
--     schrieb), die juengste den fertigen Satz.
--  2. Sie traegt den LESESTAND, den der Nutzer zuletzt gesehen hat. Wer die
--     Dublette ungelesen liegen liess, behaelt eine ungelesene Meldung — die
--     Glocke zaehlt danach dasselbe wie vorher. Behielte man die aelteste,
--     bereits gelesene Zeile, verschwaende die Meldung stillschweigend aus
--     dem Ungelesen-Zaehler, obwohl der Nutzer den Vorgang noch offen hat.
--  3. `ziel_pfad` wurde nachgezogen (`/portal/buchungen/{id}` gab es in
--     keiner App und war ein 404 in einer verschickten Mail; heute
--     `/reservierungen/{id}`). Die aelteste Zeile ist also die mit der
--     hoeheren Wahrscheinlichkeit, ins Leere zu fuehren.
--
-- Was BEWUSST NICHT passiert: die Zeilen anderer Praefixe anzutasten. Die
-- Bereinigung laeuft ausschliesslich innerhalb der Ereignis-Praefixe unten
-- (Lehre „Bereinigung nur nach Absicht, nicht Etikett", 0394) — eine
-- wiederholbare Zustandsmeldung, die zweimal dasteht, ist KEINE Dublette,
-- sondern zwei echte Auftreten.

-- ---------------------------------------------------------------------------
-- Die Ereignis-Praefixe — deckungsgleich mit `einmalig=True` im Code
-- ---------------------------------------------------------------------------
-- Diese Liste MUSS zu den Aufrufstellen passen, die `einmalig=True` setzen.
-- Sie steht hier als EINMALIGER Nachtrag fuer den Bestand, nicht als zweite
-- dauerhafte Pflegestelle: neue Meldungsarten entscheiden im Code (siehe
-- 0617, „WARUM EINE SPALTE UND KEINE PRAEFIX-LISTE IM INDEX"), und der Test
-- `notification_settings/tests/test_einmalig_bewusst.py` erzwingt dort die
-- Entscheidung. Wer diese Migration als Vorlage fuer die naechste nimmt:
-- die Liste ist der Stand vom 09.09.2026, kein gepflegtes Register.
--
-- NICHT dabei und mit Grund:
--   * `nachricht`, `anfrage`, `ki_eskalation`, `zustellproblem`,
--     `portal_rate_verwaist`, `systemwarnung`, `airbnb_foto_fehlt`,
--     `airbnb_zimmer_bleibt`, `schicht_offen`, `zeit_*`, `verspaetung`,
--     `block_freigabe` — Zustandsmeldungen, die nach dem Lesen erneut melden
--     duerfen und muessen.
--   * `aufgabe_zugewiesen`, `aufgabe_entzogen`, `vertretung_*` — die
--     Schluessel beschreiben die ZUSTAENDIGKEIT (A → B → A ist echt), siehe
--     `_aufgaben_dedup`. Live ohne Ueberschuss.
--   * `block_request`, `block_request_aufhebung`, `block_decision`,
--     `eigchat` — im Code (noch) nicht entschieden, weil die Dateien am
--     09.09.2026 unfertige Arbeit im Arbeitsverzeichnis trugen. Sie hier
--     schon zu setzen, waere ein Alleingang der DB gegen den Code: die
--     Aufrufer senden weiter `einmalig=false`, neue Zeilen fielen also NICHT
--     unter den Index, waehrend die alten drinstehen — halb gesperrt, und
--     niemand sieht, welche Haelfte. Sie werden mit dem Code nachgezogen.
create temporary table einmalig_praefixe (praefix text primary key) on commit drop;

insert into einmalig_praefixe (praefix) values
    ('buchung'),                        -- Buchung angelegt/storniert (Eigentuemer)
    ('betrieb_buchung'),                -- dieselbe Buchung an die Betriebsleitung
    ('leistung_erledigt'),              -- ein Abschluss je Auftrag
    ('angebot'),                        -- eine Gast-Antwort je Angebot
    ('testphase'),                      -- Stripe `trial_will_end` je Enddatum
    ('dienstplan'),                     -- Woche veroeffentlicht/geaendert
    ('abwesenheit_antrag'),
    ('abwesenheit_entscheidung'),
    ('ueberstunden_antrag'),
    ('ueberstunden_entscheidung'),
    ('tausch');                         -- je Tausch, Ereignis und Empfaenger

-- ---------------------------------------------------------------------------
-- TEIL 1 — Dubletten entfernen (nur innerhalb der Ereignis-Praefixe)
-- ---------------------------------------------------------------------------
-- `split_part(dedup_key, ':', 1)` ist der Praefix. Er ist hier zulaessig,
-- obwohl 0617 einen Ausdrucks-INDEX darauf ausdruecklich verworfen hat: das
-- war eine Absage an eine DAUERHAFTE zweite Pflegestelle, nicht an einer
-- einmaligen Bestandsabfrage.
with kandidaten as (
    select
        n.id,
        row_number() over (
            partition by n.user_id, n.dedup_key
            order by n.created_at desc, n.id desc
        ) as rang
    from public.notifications n
    join einmalig_praefixe p
      on p.praefix = split_part(n.dedup_key, ':', 1)
    where n.dedup_key is not null
)
delete from public.notifications
where id in (select id from kandidaten where rang > 1);

-- ---------------------------------------------------------------------------
-- TEIL 2 — `einmalig` fuer die verbleibenden Ereignis-Zeilen setzen
-- ---------------------------------------------------------------------------
-- WOZU UEBERHAUPT, wenn der Riegel doch fuer neue Meldungen im Code sitzt:
-- Der Index vergleicht die NEUE Zeile mit den BESTEHENDEN, die seine
-- WHERE-Bedingung erfuellen. Bliebe der Bestand auf `einmalig = false`, waere
-- er fuer den neuen Index unsichtbar — die erste Wiederholung einer schon
-- gemeldeten Altbuchung liefe also durch, obwohl der Code sie als einmalig
-- kennzeichnet. Genau das ist der gemeldete Fehler, nur einmal verzoegert.
--
-- `and not einmalig` haelt das `update` idempotent (Wurzel 2): ein zweiter
-- Lauf schreibt nichts und kann damit auch nicht in den UNIQUE-Index laufen.
update public.notifications n
set einmalig = true
from einmalig_praefixe p
where p.praefix = split_part(n.dedup_key, ':', 1)
  and n.dedup_key is not null
  and not n.einmalig;

-- ---------------------------------------------------------------------------
-- TEIL 3 — Beweis statt Vermutung
-- ---------------------------------------------------------------------------
-- Ein `update`, das an einer stehengebliebenen Dublette scheitert, bricht die
-- Transaktion ab — das ist erwuenscht. Diese Probe faengt den umgekehrten
-- Fall: die Bereinigung lief, aber es steht doch noch ein Paar da (etwa weil
-- ein Praefix mehrfach `:` enthaelt und `split_part` anders schneidet als
-- gedacht). Lieber laut scheitern als still eine halb gesperrte Tabelle
-- hinterlassen (Wurzel 5).
do $$
declare
    rest bigint;
begin
    select count(*) into rest
    from (
        select 1
        from public.notifications
        where dedup_key is not null and einmalig
        group by user_id, dedup_key
        having count(*) > 1
    ) doppelt;

    if rest > 0 then
        raise exception
            'Nach der Bereinigung stehen noch % Dubletten unter einmalig=true '
            '— der neue UNIQUE-Index waere nicht herstellbar.', rest;
    end if;
end $$;
