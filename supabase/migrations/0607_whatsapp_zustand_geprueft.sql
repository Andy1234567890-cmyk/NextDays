-- 0607_whatsapp_zustand_geprueft.sql — wann wurde Metas Sendezustand zuletzt geholt?
--
-- `quality_rating` und `messaging_limit_tier` standen bisher genau so in der
-- Zeile, wie sie beim Embedded Signup waren — und blieben dort unverändert
-- stehen. Ein Betrieb, dessen Nummer Meta später heruntergestuft oder gesperrt
-- hat, sah im Kanalmanager weiter den Zustand vom Tag der Verbindung. Das ist
-- kein leeres Feld, sondern eine plausible Falschaussage (dieselbe Klasse wie
-- Wurzel 5b: ein Wert, der aussieht, als beschreibe er das Jetzt).
--
-- Der Service frischt beide Werte jetzt bei `onboarding_status` auf, aber nur,
-- wenn der letzte Abruf älter als 15 Minuten ist. Ohne diesen Zeitstempel
-- wüsste er nicht, wann das war, und würde bei JEDEM Seitenaufruf bei Meta
-- nachfragen. Metas Grenze liegt bei 200 Aufrufen pro Stunde je App UND je
-- WABA; da jeder Betrieb eine eigene WABA hat, kostet die Auffrischung dort
-- höchstens 4 von 200 (2 %). Geschützt wird das APP-weite Budget, in das alle
-- Betriebe gemeinsam einzahlen.
--
-- Bewusst NULL-fähig und ohne Default: eine bestehende Zeile hat nachweislich
-- nie eine Prüfung gesehen, und `null` sagt genau das. Ein Default `now()`
-- würde behaupten, alle Altzeilen seien gerade geprüft worden (Wurzel 4).

alter table public.whatsapp_account
    add column if not exists zustand_geprueft_at timestamptz;

comment on column public.whatsapp_account.zustand_geprueft_at is
    'Wann quality_rating/messaging_limit_tier zuletzt bei Meta abgeholt wurden. '
    'NULL = noch nie (Altbestand vor 0607). Steuert die 15-Minuten-Sperre gegen '
    'unnötige Graph-Aufrufe.';

-- Kein neuer Grant und keine neue Policy: die Tabelle ist seit 0255 komplett
-- für anon/authenticated gesperrt (revoke all + restriktive Policy `false`),
-- weil sie das Kundentoken trägt. Eine zusätzliche Spalte ändert daran nichts —
-- sie erbt die Sperre der Tabelle (Wurzel 6).
