-- 0393_worker_resolution_jsonb.sql — `resolution` als jsonb, wie beim Webhook
--
-- 0392 legte `worker_ereignis.resolution` als `text` an. `channex_webhook_event`
-- führt dieselbe Spalte seit 0378 als `jsonb`. Zwei Monitore mit derselben Geste
-- („Ereignis abhaken, Notiz dazu") dürfen nicht zwei Datentypen haben — sonst
-- braucht jede spätere Auswertung zwei Wege, und der eine wird vergessen.
--
-- Nachgezogen statt 0392 zu ändern: Die Migration war live eingespielt, als der
-- Unterschied auffiel. Eine bereits angewendete Datei nachträglich zu editieren
-- hiesse, dass zwei Umgebungen mit derselben Versionsnummer verschiedene
-- Schemata haben — der Runner spielt sie nicht erneut ein.
--
-- Gefahrlos: Die Spalte ist zum Zeitpunkt dieser Migration leer (live geprüft,
-- 0 gefüllte Zeilen), es geht also nichts verloren. `using null` ist deshalb
-- korrekt und nicht faul — ein Textwert wäre hier ohnehin kein gültiges JSON.
alter table public.worker_ereignis
    alter column resolution type jsonb using null;

comment on column public.worker_ereignis.resolution is
    'Notiz beim Abhaken (jsonb wie channex_webhook_event.resolution). '
    'NULL = ohne Notiz erledigt.';
