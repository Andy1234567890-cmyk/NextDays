-- Wann wurde die Autorisierung ANGESTOSSEN? — die Angabe, die bisher fehlte.
--
-- ANLASS (29.08.2026): Im Onboarding eines frischen Betriebs stand die Meldung
--
--     „Keine Bestätigung von Airbnb erhalten. Das passiert vor allem, wenn in
--      deinem Airbnb-Konto bereits eine andere Software verbunden ist …"
--
-- obwohl NIEMAND je auf „verbinden" geklickt hatte. Airbnb hatte nichts
-- abgelehnt; es war schlicht nie gefragt worden.
--
-- Der Grund: `airbnb_oauth.parse_connection_status` schliesst aus
-- `settings is None` („Channex hat den Kanal seit der Anlage nicht angefasst")
-- auf eine Ablehnung durch Airbnb. Dieser Zustand ist aber DERSELBE direkt nach
-- dem Anlegen des Kanals — und der Kanal entsteht schon beim Vorbereiten der
-- Uebernahme, nicht erst beim Klick. Aus „noch nichts passiert" wurde so eine
-- Anschuldigung gegen das Portal, der der Kunde nachging: er suchte in seinem
-- Airbnb-Konto nach einer Verbindung, die es nie gab.
--
-- `settings` allein KANN die beiden Faelle nicht trennen — die Information,
-- ob jemand den Vorgang gestartet hat, existiert nur bei uns. Genau die haelt
-- diese Spalte fest.
--
-- Sie ist bewusst UNSERE Uhr und heisst deshalb `oauth_versuch_at`, nicht
-- `connected_at`: sie sagt „wir haben die Autorisierung angestossen", nicht
-- „das Portal hat bestaetigt" (Wurzel 5b). Der Zeitpunkt der Bestaetigung steht
-- weiterhin ausschliesslich in `ota_account.connected_at` und kommt aus der
-- Antwort des Portals.

alter table public.channex_channel_connection
  add column if not exists oauth_versuch_at timestamptz;

comment on column public.channex_channel_connection.oauth_versuch_at is
  'Zeitpunkt, zu dem WIR die OAuth-Autorisierung angestossen haben (Klick auf '
  '„verbinden", Ausgabe der Portal-URL). NICHT der Zeitpunkt einer Bestaetigung '
  'durch das Portal — der steht in ota_account.connected_at. Ist die Spalte '
  'leer, wurde nie ein Versuch gestartet: dann darf keine Meldung behaupten, '
  'das Portal habe die Verbindung abgelehnt.';

-- Bestand: Kanaele, die bereits eine Host-ID tragen, hatten offensichtlich
-- einen erfolgreichen Versuch. Ihr genauer Zeitpunkt ist nicht rekonstruierbar
-- — `created_at` waere geraten (Wurzel 4/5b). Stattdessen bleibt die Spalte
-- leer und die Auswertung stuetzt sich fuer diese Zeilen auf die Host-ID
-- selbst, die ohnehin der staerkere Beleg ist.
