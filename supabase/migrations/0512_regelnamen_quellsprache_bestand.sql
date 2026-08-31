-- 0512 — Ausgangssprache der zwoelf Bestandsregeln, und ein korrigierter
-- Spaltenkommentar aus 0511.
--
-- 0511 hat `task_rules.quellsprache` bewusst OHNE Default angelegt: ein
-- geratener Wert waere an diesen Daten nachweislich falsch. Damit stand die
-- Spalte fuer den gesamten Bestand auf NULL, und der Uebersetzungslauf
-- uebersprang jede Regel — richtig, aber unbrauchbar.
--
-- Hier wird sie EINMALIG je Regel gesetzt, nicht per Muster. Gemessen am
-- 31.08.2026 sind die zwoelf Regeln des einzigen Betriebs mit Regeln (AirSmil)
-- gemischt benannt, und die Zuordnung ist am Namen abzulesen:
--
--   daenisch (da):  Reng T, Reng J, Velk T, Velk J   (rengoering, velkomst)
--                   Viceværtrunde hele året, Viceværtrunde vinter
--                   Vinduer 4-uger, Vinduer 8-uger, Græss - saison, levere
--   deutsch  (de):  Anreisecheck, Endreinigung
--
-- Je Zeile eine ID, kein `like '%Reng%'`: ein Muster traefe morgen eine neue
-- Regel mit aehnlichem Namen und etikettierte sie ungefragt. Diese Migration
-- soll GENAU diese zwoelf Zeilen anfassen und nie wieder etwas.
--
-- `where quellsprache is null` als Idempotenz-Riegel (Wurzel 2): laeuft die
-- Migration erneut oder hat jemand die Sprache inzwischen im Dialog korrigiert,
-- bleibt seine Angabe stehen. Eine spaetere Handkorrektur ist die bessere
-- Auskunft als diese Ableitung.

update public.task_rules set quellsprache = 'da'
where quellsprache is null and id in (
    '2eaca61f-1e84-4d49-a624-b9e433979fa7',  -- Reng J
    '360d52f1-66d9-49bd-ae26-e8b60109bb78',  -- Reng T
    '68bcb698-fb92-4297-b663-362df51bcc42',  -- Velk J
    '36c4c8f9-ff83-4008-8ac9-2fd7c80c6ec0',  -- Velk T
    '9b9864c0-74c9-4909-8247-c65137f1e042',  -- Græss - saison
    '7a128570-1d8e-4d4a-8bbc-1c71169f6f8d',  -- Viceværtrunde hele året
    '9ff4637a-e74c-4985-9f3f-71893db9bd00',  -- Viceværtrunde vinter
    '4ddf0555-12c2-4710-a251-75f0d1da583c',  -- Vinduer 4-uger
    '0d6a3960-57e0-4cfa-afaf-02cc42ddf8ba',  -- Vinduer 8-uger
    '45090ea2-257a-4625-bcc9-99b480dfd817'   -- levere
);

update public.task_rules set quellsprache = 'de'
where quellsprache is null and id in (
    'dabaa38e-44a9-4c69-8a31-24aab1bbe6c3',  -- Anreisecheck
    '03af26ee-ba50-4d4e-837a-821c1bfe3c44'   -- Endreinigung
);

-- Korrektur des Kommentars aus 0511: uebersetzt wird nur der NAME. Die
-- Beschreibung bleibt draussen (internes Arbeitsdetail, live in einer anderen
-- Sprache als der Name derselben Regel) — der alte Kommentar behauptete etwas
-- anderes, und ein Kommentar, der nicht stimmt, ist schlimmer als keiner.
comment on column public.task_rules.quellsprache is
    'In welcher Sprache `name` verfasst ist (0511/0512). NULL = unbekannt: der '
    'Uebersetzungslauf ueberspringt die Regel und meldet sie, statt eine '
    'Ausgangssprache zu raten. Ein Default waere nachweislich falsch — ein '
    'Betrieb fuehrt deutsche UND daenische Regelnamen nebeneinander.';

comment on column public.task_rule_translations.description is
    'ANGELEGT, ABER UNGENUTZT: uebersetzt wird nur der Name (0512). Bleibt '
    'stehen, falls die Beschreibung spaeter doch uebersetzt werden soll.';
